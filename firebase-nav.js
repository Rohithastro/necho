import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, updateDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

window.logout = async function () {
  try { await signOut(auth); } catch (_) {}
  window.App.isLoggedIn = false;
  window.App.isAdmin = false;
  window.App.isInterpreterAllowed = false;
  window.App.user = null;
  if (typeof window._syncAuth === 'function') window._syncAuth();
  window.location.href = 'index.html';
};

window.updateUserProfile = async function (name) {
  if (!auth.currentUser) throw new Error('Not logged in');
  await updateProfile(auth.currentUser, { displayName: name });
  try {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { name });
  } catch (_) {}
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    window.App.isLoggedIn = true;
    window.App.user = {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
    };
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        window.App.isAdmin = !!data.isAdmin;
        window.App.isInterpreterAllowed = !!(data.isAdmin || data.isInterpreterAllowed);
        if (data.name) window.App.user.displayName = data.name;
      } else {
        window.App.isAdmin = false;
        window.App.isInterpreterAllowed = false;
      }
    } catch (_) {
      window.App.isAdmin = false;
      window.App.isInterpreterAllowed = false;
    }
  } else {
    window.App.isLoggedIn = false;
    window.App.isAdmin = false;
    window.App.isInterpreterAllowed = false;
    window.App.user = null;
  }

  if (typeof window._syncAuth === 'function') window._syncAuth();
  if (typeof window._syncInterpreter === 'function') window._syncInterpreter();
});
