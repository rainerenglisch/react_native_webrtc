import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import FirebaseSignaling from '../backend/FirebaseSignaling';

class WebRtc {
  static createPeerConnection = () => {
    return new RTCPeerConnection({
      iceServers: [
        {urls: 'stun:stun.l.google.com:19302'},
        {urls: 'stun:stun1.l.google.com:19302'},
        {urls: 'stun:stun2.l.google.com:19302'},
      ],
      iceCandidatePoolSize: 10,
    });
  };

  static getUserMedia = (mediaDevices) => {
    let isFront = false;

    return mediaDevices.enumerateDevices().then(sourceInfos => {
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
      return mediaDevices.getUserMedia({
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
      });
    });
  };

  /**
   * Register callbacks for exchanging messages via firebase signaling
   * - ice candidates
   * - receiving remote SIP
   *
   * Out of scope
   * - setting remote stream on 'conn.addtrack' event
   *
   *
   * @param yourConn
   */
  static registerSignalingCallbacks = yourConn => {
    yourConn.onicecandidate = event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      FirebaseSignaling.singleton.addCallerCandidate(event.candidate);
    };

    // Listening for remote session description below
    FirebaseSignaling.singleton.getRoomRef().onSnapshot(async snapshot => {
      const data = snapshot.data();
      if (!yourConn.currentRemoteDescription && data && data.answer) {
        console.log('Got remote description: ', data.answer);
        const rtcSessionDescription = new RTCSessionDescription(data.answer);
        await yourConn.setRemoteDescription(rtcSessionDescription);
      }
    });
    // Listening for remote session description above

    // Listen for remote ICE candidates below
    FirebaseSignaling.singleton.getCalleeCandidates().onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await yourConn.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  static registerPeerConnectionListeners(yourConn) {
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
}

export default WebRtc;
