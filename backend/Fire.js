import firebase from 'firebase';

class Fire {
    constructor() {
        this.init();
        this.observeAuth();
    }

    observeAuth = () => firebase.auth().onAuthStateChanged(this.onAuthStateChanged);

    onAuthStateChanged = user => {
        if (!user) {
            try {
                firebase.auth().signInAnonymously();
            } catch ({ message }) {
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
        const { timestamp: numberStamp, text, user } = snapshot.val();
        const { key: _id } = snapshot;

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
            const { text, user } = messages[i];
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

    init = () =>
        firebase.initializeApp({
            apiKey: "AIzaSyDTNCNirNr-q3XpVDntUF8dlGw8T4Hqs-w",
            authDomain: "chat-app-17859.firebaseapp.com",
            databaseURL: "https://chat-app-17859.firebaseio.com",
            projectId: "chat-app-17859",
            storageBucket: "chat-app-17859.appspot.com",
            messagingSenderId: "586465942143",
            appId: "1:586465942143:web:0d77d26fd6ca459f1afd4a",
            measurementId: "G-HHY3BMK804"
        });
}

Fire.shared = new Fire();
export default Fire;
