/* ============================================================
   NECHO — Sign In Page Logic (signin-page.js)
   Loaded as type="module" on signin.html only.
   ============================================================ */

import { auth }           from './firebase-config.js';
import { signInWithEmailAndPassword }
                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

function friendlyError(code) {
  const map = {
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password. Please try again.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/user-disabled':           'This account has been disabled.',
    'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed':  'Network error. Check your connection and try again.',
  };
  return map[code] || 'Sign in failed. Please try again.';
}

document.addEventListener('DOMContentLoaded', () => {
  const form    = document.getElementById('signin-form');
  const emailEl = document.getElementById('signin-email');
  const passEl  = document.getElementById('signin-password');
  const errEl   = document.getElementById('auth-error');
  const btn     = document.getElementById('signin-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    btn.disabled      = true;
    btn.textContent   = 'SIGNING IN…';

    try {
      await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
      window.location.href = 'index.html';
    } catch (err) {
      errEl.textContent = friendlyError(err.code);
      btn.disabled      = false;
      btn.textContent   = 'SIGN IN';
    }
  });
});
