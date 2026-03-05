import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, sendEmailVerification }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

function friendlyError(code) {
  const map = {
    'auth/invalid-credential':     'Incorrect email or password. Please try again.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-disabled':          'This account has been disabled.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed':  'Email/password sign-in is not enabled. Please contact support.',
  };
  return map[code] || `Sign in failed (${code}). Please try again.`;
}

const form    = document.getElementById('signin-form');
const emailEl = document.getElementById('signin-email');
const passEl  = document.getElementById('signin-password');
const errEl   = document.getElementById('auth-error');
const btn     = document.getElementById('signin-btn');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    btn.disabled      = true;
    btn.textContent   = 'Signing in…';

    try {
      const cred = await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);

      if (!cred.user.emailVerified) {
        await signOut(auth);
        errEl.innerHTML = `
          Email not verified. Check your inbox for the verification link.
          <br><button id="resend-btn" style="margin-top:8px;background:none;border:none;color:#e84d1c;font-size:0.8rem;cursor:pointer;text-decoration:underline;padding:0;">
            Resend verification email
          </button>
        `;
        document.getElementById('resend-btn').addEventListener('click', async () => {
          const resendBtn = document.getElementById('resend-btn');
          resendBtn.disabled = true;
          resendBtn.textContent = 'Sending…';
          try {
            const resendCred = await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
            await sendEmailVerification(resendCred.user);
            await signOut(auth);
            errEl.textContent = 'Verification email sent! Check your inbox.';
          } catch {
            errEl.textContent = 'Could not resend. Please try signing up again.';
          }
        });
        btn.disabled    = false;
        btn.textContent = 'Sign in to Dashboard';
        return;
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Welcome back! Signed in successfully.');
      }
      setTimeout(() => { window.location.href = 'index.html'; }, 1200);
    } catch (err) {
      console.error('Signin error:', err.code, err.message);
      errEl.textContent = friendlyError(err.code);
      btn.disabled      = false;
      btn.textContent   = 'Sign in to Dashboard';
    }
  });
}
