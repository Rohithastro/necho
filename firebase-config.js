/* ============================================================
   NECHO — Firebase Configuration (firebase-config.js)

   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Create a new project (or open your existing one)
   3. Click the </> (Web) icon to add a web app
   4. Copy the firebaseConfig object and replace the values below
   5. In the Firebase console:
      - Build → Authentication → Get started → Enable Email/Password
      - Build → Firestore Database → Create database → choose your region
   ============================================================ */

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ⚠️  Replace ALL values below with your own Firebase project credentials
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
