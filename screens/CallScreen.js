import WebRtc from '../model/WebRtc';
import React, {useEffect, useState, useCallback} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text} from 'react-native-paper';
import {Button} from 'react-native-paper';
import AsyncStorage from '@react-native-community/async-storage';
import {TextInput} from 'react-native-paper';
import FirebaseSignaling from '../backend/FirebaseSignaling.js';
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
  const [callToUsername, setCallToUsername] = useState(null);

  const [localStream, setLocalStream] = useState({toURL: () => null});
  const [remoteStream, setRemoteStream] = useState({toURL: () => null});
  const [yourConn, setYourConn] = useState(WebRtc.createPeerConnection);

  /**
   * Creates a room, sets up local stream incl all callbacks for signaling, creates offer
   *
   * @returns {Promise<void>}
   */
  async function sendOffer() {
    // document.querySelector('#createBtn').disabled = true;
    // document.querySelector('#joinBtn').disabled = true;
    console.log('register signal server callbacks');
    WebRtc.registerSignalingCallbacks(yourConn);
    // document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`;
    yourConn.onaddstream = event => {
      console.log('On Add Stream', event);
      setRemoteStream(event.stream);
    };

    const offer = await yourConn.createOffer();
    await yourConn.setLocalDescription(offer);
    console.log('Created offer:', offer);
    await FirebaseSignaling.singleton.sendOffer(offer);
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

/*      send({
        type: 'login',
        name: userId,
      });*/
    }
  }, [socketActive, userId]);

  const onLogin = () => {};

  useEffect(() => {
    WebRtc.registerPeerConnectionListeners(yourConn);

    WebRtc.getUserMedia(mediaDevices)
      .then(stream => {
        // Got stream!
        console.log('2Update Local Stream1 ' + localStream.toURL());
        setLocalStream(stream);
        console.log('2Update Local Stream2 ' + localStream.toURL());
        // setup stream listening
        yourConn.addStream(stream);
      })
      .catch(error => {
        console.log('error');
        console.log(error);
      });
  }, []);

  const onCall = () => {
    console.log('oncall');

    setCalling(true);

    connectedUser = callToUsername;
    console.log('Caling to', callToUsername);
    // create an offer
    sendOffer();
    // console.log('Sending Ofer');
  };

  //hang up
  const hangUp = () => {
    console.log('hangUp');
    // send({type: 'leave',});
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
