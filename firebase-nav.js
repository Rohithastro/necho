/* ============================================================
   NECHO — Firebase Auth State → Nav UI (firebase-nav.js)
   Loaded as type="module" on every page via nav.js injection.
   Bridges Firebase auth state to the existing App/nav system.
   ============================================================ */

import { auth, db }      from './firebase-config.js';
import { onAuthStateChanged, signOut }
                         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Override nav.js logout with real Firebase sign-out ───── */
window.logout = async function () {
  try { await signOut(auth); } catch (_) {}
  window.App.isLoggedIn = false;
  window.App.isAdmin    = false;
  if (typeof window._syncAuth === 'function') window._syncAuth();
  window.location.href = 'index.html';
};

/* ── Listen to auth state and update UI ───────────────────── */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    window.App.isLoggedIn = true;

    // Check isAdmin from Firestore user document
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      window.App.isAdmin = !!(snap.exists() && snap.data().isAdmin);
    } catch (_) {
      window.App.isAdmin = false;
    }
  } else {
    window.App.isLoggedIn = false;
    window.App.isAdmin    = false;
  }

  if (typeof window._syncAuth === 'function') window._syncAuth();
});
