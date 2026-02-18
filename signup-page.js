/* ============================================================
   NECHO — Sign Up Page Logic (signup-page.js)
   Loaded as type="module" on signup.html only.
   Creates Firebase Auth user + Firestore profile document.
   ============================================================ */

import { auth, db }       from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile }
                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, serverTimestamp }
                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed':  'Email/password sign-up is not enabled. Contact support.',
  };
  return map[code] || 'Sign up failed. Please try again.';
}

document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('signup-form');
  const nameEl    = document.getElementById('signup-name');
  const emailEl   = document.getElementById('signup-email');
  const passEl    = document.getElementById('signup-password');
  const confirmEl = document.getElementById('signup-confirm');
  const errEl     = document.getElementById('auth-error');
  const btn       = document.getElementById('signup-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';

    const name     = nameEl.value.trim();
    const email    = emailEl.value.trim();
    const password = passEl.value;
    const confirm  = confirmEl.value;

    // Client-side validation
    if (!name) {
      errEl.textContent = 'Please enter your full name.'; return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters.'; return;
    }
    if (password !== confirm) {
      errEl.textContent = 'Passwords do not match.'; return;
    }

    btn.disabled    = true;
    btn.textContent = 'CREATING ACCOUNT…';

    try {
      // Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Set display name on the auth profile
      await updateProfile(cred.user, { displayName: name });

      // Create Firestore user document
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        isAdmin:   false,
        createdAt: serverTimestamp(),
      });

      window.location.href = 'index.html';
    } catch (err) {
      errEl.textContent = friendlyError(err.code);
      btn.disabled      = false;
      btn.textContent   = 'SIGN UP';
    }
  });
});
