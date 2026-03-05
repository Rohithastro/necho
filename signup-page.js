import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':  'An account with this email already exists.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/network-request-failed':'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'Email/password sign-up is not enabled. Please contact support.',
  };
  return map[code] || `Sign up failed (${code}). Please try again.`;
}

const form      = document.getElementById('signup-form');
const nameEl    = document.getElementById('signup-name');
const emailEl   = document.getElementById('signup-email');
const passEl    = document.getElementById('signup-password');
const confirmEl = document.getElementById('signup-confirm');
const errEl     = document.getElementById('auth-error');
const btn       = document.getElementById('signup-btn');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';

    const name     = nameEl.value.trim();
    const email    = emailEl.value.trim();
    const password = passEl.value;
    const confirm  = confirmEl.value;

    if (!name) { errEl.textContent = 'Please enter your display name.'; return; }
    if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
    if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }

    btn.disabled    = true;
    btn.textContent = 'Creating account…';

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });

      // Save to Firestore — wrapped separately so a rules error doesn't block the auth flow
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          name,
          email,
          isAdmin: false,
          isInterpreterAllowed: false,
          createdAt: serverTimestamp(),
        });
      } catch (firestoreErr) {
        console.warn('Firestore write failed (check security rules):', firestoreErr.message);
      }

      // Always send verification email and sign out
      await sendEmailVerification(cred.user);
      await signOut(auth);

      form.innerHTML = `
        <div style="text-align:center;padding:2rem 0;display:flex;flex-direction:column;align-items:center;gap:1.25rem;">
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(232,77,28,0.1);border:1px solid rgba(232,77,28,0.25);display:flex;align-items:center;justify-content:center;">
            <svg width="24" height="24" fill="none" stroke="#e84d1c" stroke-width="2" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h3 style="font-size:1.2rem;font-weight:700;color:rgba(255,255,255,0.9);">Check your inbox</h3>
          <p style="color:rgba(255,255,255,0.4);font-size:0.9rem;line-height:1.7;max-width:300px;">
            We sent a verification link to <strong style="color:rgba(255,255,255,0.7);">${email}</strong>.
            Click the link in that email to activate your account, then sign in.
          </p>
          <a href="signin.html" style="margin-top:0.5rem;background:linear-gradient(135deg,#e84d1c,#f59e0b);color:white;padding:11px 32px;border-radius:999px;font-weight:600;text-decoration:none;font-size:13px;letter-spacing:0.05em;">
            Go to Sign In
          </a>
        </div>
      `;
    } catch (err) {
      console.error('Signup error:', err.code, err.message);
      errEl.textContent = friendlyError(err.code);
      btn.disabled      = false;
      btn.textContent   = 'Create a new account';
    }
  });
}
