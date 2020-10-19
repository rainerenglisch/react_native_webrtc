import firebase from 'firebase';

class Fire {
  constructor() {
    this.init();
    // this.observeAuth();
  }

  observeAuth = () => firebase.auth().onAuthStateChanged(this.onAuthStateChanged);

  onAuthStateChanged = user => {
    if (!user) {
      try {
        firebase.auth().signInAnonymously();
      } catch ({message}) {
        alert(message);
      }
    }
  };

  get ref() {
    return firebase.database().ref('messages');
  }

  on = callback =>
    this.ref
      .limitToLast(20)
      .on('child_added', snapshot => callback(this.parse(snapshot)));

  parse = snapshot => {
    const {timestamp: numberStamp, text, user} = snapshot.val();
    const {key: _id} = snapshot;

    const timestamp = new Date(numberStamp);

    const message = {
      _id,
      timestamp,
      text,
      user,
    };
    return message;
  }


  off() {
    this.ref.off();
  }

  get uid() {
    return (firebase.auth().currentUser || {}).uid;
  }

  get timestamp() {
    return firebase.database.ServerValue.TIMESTAMP;
  }

  send = messages => {
    for (let i = 0; i < messages.length; i++) {
      const {text, user} = messages[i];
      // 4.
      const message = {
        text,
        user,
        timestamp: this.timestamp,
      };
      this.append(message);
    }
  };

  append = message => this.ref.push(message);

  init = () => {
    firebase.initializeApp({
      apiKey: 'AIzaSyAc8W32MiTDmPFX0oBqHt7AHnWJDYuqmKw',
      authDomain: 'webrtc-56950.firebaseapp.com',
      databaseURL: 'https://webrtc-56950.firebaseio.com',
      projectId: 'webrtc-56950',
      storageBucket: 'webrtc-56950.appspot.com',
      messagingSenderId: '642466922237',
      appId: '1:642466922237:web:58c21c39aca5d392fe0894',
      measurementId: 'G-9ZC4LQ51H0',
    });
    //firebase.analytics();
  };
}

Fire.shared = new Fire();
export default Fire;
