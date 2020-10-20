import firebase from 'firebase';
import React, {useEffect, useState, useCallback} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text} from 'react-native-paper';
import {Button} from 'react-native-paper';
import AsyncStorage from '@react-native-community/async-storage';
import {TextInput} from 'react-native-paper';
import Fire from '../backend/Fire.js';
import {useFocusEffect} from '@react-navigation/native';

import InCallManager from 'react-native-incall-manager';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc';

export default function CallScreen({navigation, ...props}) {
  let name;
  let connectedUser;
  const [userId, setUserId] = useState('');
  const [socketActive, setSocketActive] = useState(false);
  const [calling, setCalling] = useState(false);

  const [localStream, setLocalStream] = useState({toURL: () => null});
  const [remoteStream, setRemoteStream] = useState({toURL: () => null});

  const [yourConn, setYourConn] = useState(
    //change the config as you need
    new RTCPeerConnection({
      iceServers: [
        {urls: 'stun:stun.l.google.com:19302',},
        {urls: 'stun:stun1.l.google.com:19302',},
        {urls: 'stun:stun2.l.google.com:19302',},
      ],
      iceCandidatePoolSize: 10,
    }),
  );

  const [callToUsername, setCallToUsername] = useState(null);

  /**
   * Creates a room, sets up local stream incl all callbacks for signaling, creates offer
   *
   * @returns {Promise<void>}
   */
  async function createRoom() {
    // document.querySelector('#createBtn').disabled = true;
    // document.querySelector('#joinBtn').disabled = true;
    console.log('create room & register signal server callbacks');
    // const db = firebase.firestore();
    // const roomRef = await db.collection('rooms').doc();
    // // Code for collecting ICE candidates below
    // const callerCandidatesCollection = roomRef.collection('callerCandidates');
    yourConn.onicecandidate = event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      Fire.shared.addCallerCandidate(event.candidate.toJSON());
      // callerCandidatesCollection.add(event.candidate.toJSON());
    };
    // Code for collecting ICE candidates above

    // Code for creating a room below
    const offer = await yourConn.createOffer();
    await yourConn.setLocalDescription(offer);
    console.log('Created offer:', offer);

/*    const roomWithOffer = {
      'offer': {
        type: offer.type,
        sdp: offer.sdp,
      },
    };
    await roomRef.set(roomWithOffer);*/
    await Fire.shared.sendOffer(offer);

    // document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`;
    // Code for creating a room above
    yourConn.onaddstream = event => {
      console.log('On Add Stream', event);
      setRemoteStream(event.stream);
    };

    // Listening for remote session description below
    Fire.shared.getRoomRef().onSnapshot(async snapshot => {
      const data = snapshot.data();
      if (!yourConn.currentRemoteDescription && data && data.answer) {
        console.log('Got remote description: ', data.answer);
        const rtcSessionDescription = new RTCSessionDescription(data.answer);
        await yourConn.setRemoteDescription(rtcSessionDescription);
      }
    });
    // Listening for remote session description above

    // Listen for remote ICE candidates below
    Fire.shared.getCalleeCandidates().onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await yourConn.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    // Listen for remote ICE candidates above
  }

  function registerPeerConnectionListeners() {
    yourConn.onicegatheringstatechange = () => {
      console.log(`ICE gathering state changed: ${yourConn.iceGatheringState}`);
    };
    yourConn.onconnectionstatechange = () => {
      console.log(`Connection state change: ${yourConn.connectionState}`);
    };
    yourConn.onsignalingstatechange = () => {
      console.log(`Signaling state change: ${yourConn.signalingState}`);
    };
    yourConn.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state change: ${yourConn.iceConnectionState}`,
      );
    };
  }

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect AsyncStorage');

      AsyncStorage.getItem('userId').then(id => {
        console.log(id);
        if (id) {
          setUserId(id);
        } else {
          setUserId('');
          navigation.push('Login');
        }
      });
    }, [userId]),
  );

  useEffect(() => {
    console.log('useFocusEffect setOptions');

    navigation.setOptions({
      title: 'Your ID - ' + userId,
      headerRight: () => (
        <Button mode="text" onPress={onLogout} style={{paddingRight: 10}}>
          Logout
        </Button>
      ),
    });
  }, [userId]);

  /**
   * Calling Stuff
   */

  useEffect(() => {
    console.log('useFocusEffect socketActive');

    if (socketActive && userId.length > 0) {
      try {
        InCallManager.start({media: 'audio'});
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);
      } catch (err) {
        console.log('InApp Caller ---------------------->', err);
      }

      console.log(InCallManager);

      send({
        type: 'login',
        name: userId,
      });
    }
  }, [socketActive, userId]);

  const onLogin = () => {};

  useEffect(() => {
    registerPeerConnectionListeners();

    let isFront = false;
    mediaDevices.enumerateDevices().then(sourceInfos => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind === 'videoinput' &&
          sourceInfo.facing === (isFront ? 'front' : 'environment')
        ) {
          videoSourceId = sourceInfo.deviceId;
        }
      }
      mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            mandatory: {
              minWidth: 500, // Provide your own width, height and frame rate here
              minHeight: 300,
              minFrameRate: 30,
            },
            facingMode: isFront ? 'user' : 'environment',
            optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
          },
        })
        .then(stream => {
          // Got stream!
          console.log('Update Local Stream1 ' + localStream.toURL());
          setLocalStream(stream);
          console.log('Update Local Stream2 ' + localStream.toURL());

          // setup stream listening
          yourConn.addStream(stream);
        })
        .catch(error => {
          console.log('error');
          console.log(error);
        });
    });
  }, []);

  const send = message => {
    console.log('send');
    //attach the other peer username to our messages
    if (connectedUser) {
      message.name = connectedUser;
      console.log('Connected user in end----------', message);
    }
    // conn.send(JSON.stringify(message));
  };

  const onCall = () => {
    console.log('oncall');

    setCalling(true);

    connectedUser = callToUsername;
    console.log('Caling to', callToUsername);
    // create an offer
    createRoom();
    // console.log('Sending Ofer');
  };

  //hang up
  const hangUp = () => {
    console.log('hangUp');
    send({type: 'leave',});
    handleLeave();
  };

  const handleLeave = () => {
    console.log('handleLeave');

    connectedUser = null;
    setRemoteStream({toURL: () => null});

    yourConn.close();
    // yourConn.onicecandidate = null;
    // yourConn.onaddstream = null;
  };

  const onLogout = () => {
    // hangUp();
    console.log('onLogout');

    AsyncStorage.removeItem('userId').then(res => {
      navigation.push('Login');
    });
  };

  /**
   * Calling Stuff Ends
   */
  return (
    <View style={styles.root}>
      <View style={styles.inputField}>
        <TextInput
          label="Enter Friends Id"
          mode="outlined"
          style={{marginBottom: 7}}
          onChangeText={text => setCallToUsername(text)}
        />
        <Button
          mode="contained"
          onPress={onCall}
          loading={calling}
          // style={styles.btn}
          // disabled={!(socketActive && userId.length > 0)}
          contentStyle={styles.btnContent}>
          Call
        </Button>
      </View>

      <View style={styles.videoContainer}>
        <View style={[styles.videos, styles.localVideos]}>
          <Text>Your Video</Text>
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} />
        </View>
        <View style={[styles.videos, styles.remoteVideos]}>
          <Text>Friends Video</Text>
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    flex: 1,
    padding: 20,
  },
  inputField: {
    marginBottom: 10,
    flexDirection: 'column',
  },
  videoContainer: {
    flex: 1,
    minHeight: 450,
  },
  videos: {
    width: '100%',
    flex: 1,
    position: 'relative',
    overflow: 'hidden',

    borderRadius: 6,
  },
  localVideos: {
    height: 100,
    marginBottom: 10,
  },
  remoteVideos: {
    height: 400,
  },
  localVideo: {
    backgroundColor: '#f2f2f2',
    height: '100%',
    width: '100%',
  },
  remoteVideo: {
    backgroundColor: '#f2f2f2',
    height: '100%',
    width: '100%',
  },
});
