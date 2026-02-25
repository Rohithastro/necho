import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBBwRMRJ4uE_JYOC5NYWl7hG9W34eNxofQ",
  authDomain:        "necho1.firebaseapp.com",
  projectId:         "necho1",
  storageBucket:     "necho1.firebasestorage.app",
  messagingSenderId: "340854873403",
  appId:             "1:340854873403:web:bae7f460d420dabc516b1e",
  measurementId:     "G-109G38YJF1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);