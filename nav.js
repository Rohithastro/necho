const App = {
  isLoggedIn: false,
  language: 'en',
  activePage: document.body.dataset.page || 'home',
};
window.App = App;

const LANG_NAMES = {
  en: 'ENGLISH', hi: 'HINDI', ta: 'TAMIL', te: 'TELUGU',
  kn: 'KANNADA', ml: 'MALAYALAM', mr: 'MARATHI', gu: 'GUJARATI',
};
const PAGES = {
  home: 'index.html',
  interpreter: 'interpreter.html',
  about: 'about.html',
  blog: 'blog.html',
  signin: 'signin.html',
  signup: 'signup.html',
};

function goTo(page) {
  if (PAGES[page]) window.location.href = PAGES[page];
}

function login() {
  App.isLoggedIn = true;
  sessionStorage.setItem('necho_logged_in', '1');
  _syncAuth();
}
function logout() {
  App.isLoggedIn = false;
  sessionStorage.removeItem('necho_logged_in');
  _syncAuth();
  goTo('home');
}
function _syncAuth() {
  const out = document.getElementById('nav-signout');
  const inn = document.getElementById('nav-signin');
  const mOut = document.getElementById('mob-signout');
  const mInn = document.getElementById('mob-signin');
  const profileBtn = document.getElementById('nav-profile');

  const hasProfile = !!document.getElementById('nav-profile');
  if (inn) inn.style.display = App.isLoggedIn ? 'none' : '';
  if (out) out.style.display = (App.isLoggedIn && !hasProfile) ? '' : 'none';
  if (mInn) mInn.style.display = App.isLoggedIn ? 'none' : '';
  if (mOut) mOut.style.display = App.isLoggedIn ? '' : 'none';

  if (profileBtn) {
    profileBtn.style.display = App.isLoggedIn ? 'flex' : 'none';
    const initial = document.getElementById('nav-profile-initial');
    if (initial && App.user) {
      initial.textContent = (App.user.displayName || App.user.email || 'U')[0].toUpperCase();
    }
  }

  document.querySelectorAll('.interp-gate').forEach(el => {
    el.style.display = App.isAdmin ? '' : 'none';
  });
}
window._syncAuth = _syncAuth;

(function injectGlobalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #nav-profile {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #e84d1c, #f59e0b);
      border: none; cursor: pointer; display: none;
      align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white;
      flex-shrink: 0; transition: transform 0.2s, box-shadow 0.2s;
    }
    #nav-profile:hover { transform: scale(1.08); box-shadow: 0 0 20px rgba(232,77,28,0.4); }
    .profile-overlay {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(5,5,5,0.6); backdrop-filter: blur(8px);
      display: flex; align-items: flex-start; justify-content: flex-end;
      padding: 76px 1.5rem 0;
    }
    .profile-panel {
      background: #0f0a08; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; width: 100%; max-width: 320px;
      padding: 1.5rem; display: flex; flex-direction: column;
      gap: 1.1rem; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .profile-panel-head { display: flex; align-items: center; gap: 12px; }
    .profile-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(135deg,#e84d1c,#f59e0b);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .profile-panel-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); }
    .profile-panel-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
    .profile-field label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.12em; color: rgba(255,255,255,0.3); display: block; margin-bottom: 5px;
    }
    .profile-field input {
      width: 100%; background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
      padding: 9px 12px; color: rgba(255,255,255,0.85); font-size: 13px;
      font-family: inherit; outline: none; transition: border-color 0.2s;
    }
    .profile-field input:focus { border-color: rgba(232,77,28,0.5); }
    .profile-field input:read-only { opacity: 0.45; cursor: default; }
    .profile-save-btn {
      width: 100%; padding: 10px; border-radius: 8px;
      background: linear-gradient(135deg,#e84d1c,#f59e0b);
      color: white; font-size: 13px; font-weight: 600; font-family: inherit;
      cursor: pointer; border: none; transition: opacity 0.2s;
    }
    .profile-save-btn:hover { opacity: 0.88; }
    .profile-signout-btn {
      width: 100%; padding: 10px; border-radius: 8px; background: transparent;
      color: rgba(255,255,255,0.4); font-size: 13px; font-weight: 500;
      font-family: inherit; cursor: pointer; border: 1px solid rgba(255,255,255,0.07);
      transition: all 0.2s;
    }
    .profile-signout-btn:hover { border-color: rgba(232,77,28,0.3); color: #e84d1c; }
    .necho-toast {
      position: fixed; bottom: 2rem; left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(15,10,8,0.97); border: 1px solid rgba(232,77,28,0.3);
      color: #fff5f0; padding: 0.9rem 1.4rem; border-radius: 12px;
      display: flex; align-items: center; gap: 10px; font-size: 14px;
      font-weight: 500; z-index: 99999; opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(12px);
      white-space: nowrap;
    }
    .necho-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .necho-toast-icon {
      width: 20px; height: 20px; border-radius: 50%;
      background: linear-gradient(135deg,#e84d1c,#f59e0b);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
})();

window.showToast = function(message) {
  const toast = document.createElement('div');
  toast.className = 'necho-toast';
  toast.innerHTML = `<div class="necho-toast-icon">✓</div><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
};

function toggleProfilePanel() {
  const existing = document.getElementById('profile-overlay');
  if (existing) { existing.remove(); return; }
  const user = window.App.user || {};
  const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
  const overlay = document.createElement('div');
  overlay.id = 'profile-overlay';
  overlay.className = 'profile-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div class="profile-panel">
      <div class="profile-panel-head">
        <div class="profile-avatar">${initial}</div>
        <div>
          <div class="profile-panel-title">${user.displayName || 'Your Profile'}</div>
          <div class="profile-panel-sub">${user.email || ''}</div>
        </div>
      </div>
      <div class="profile-field">
        <label>Display Name</label>
        <input id="profile-name-input" type="text" value="${user.displayName || ''}" placeholder="Enter your name" />
      </div>
      <div class="profile-field">
        <label>Email</label>
        <input type="email" value="${user.email || ''}" readonly />
      </div>
      <button class="profile-save-btn" onclick="saveProfile()">Save Changes</button>
      <button class="profile-signout-btn" onclick="logout()">Sign Out</button>
    </div>
  `;
  document.body.appendChild(overlay);
}
window.toggleProfilePanel = toggleProfilePanel;

async function saveProfile() {
  const input = document.getElementById('profile-name-input');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  const btn = document.querySelector('.profile-save-btn');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    if (typeof window.updateUserProfile === 'function') {
      await window.updateUserProfile(name);
    }
    if (window.App.user) window.App.user.displayName = name;
    const initial = document.getElementById('nav-profile-initial');
    if (initial) initial.textContent = name[0].toUpperCase();
    window.showToast('Profile updated successfully.');
    const overlay = document.getElementById('profile-overlay');
    if (overlay) overlay.remove();
  } catch {
    if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false; }
    window.showToast('Failed to update. Please try again.');
  }
}
window.saveProfile = saveProfile;

window.togglePass = function(id, btn) {
  const input = document.getElementById(id);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.querySelector('.eye-show').style.display = show ? 'none' : '';
  btn.querySelector('.eye-hide').style.display = show ? '' : 'none';
};

(function injectGoogleTranslate() {
  const div = document.createElement('div');
  div.id = 'google_translate_element';
  div.style.display = 'none';
  document.body.appendChild(div);
  const s = document.createElement('script');
  s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  s.async = true;
  document.head.appendChild(s);
})();

window.googleTranslateElementInit = function () {
  new google.translate.TranslateElement({
    pageLanguage: 'en',
    includedLanguages: 'hi,ta,te,kn,ml,mr,gu',
    autoDisplay: false,
  }, 'google_translate_element');
  const saved = localStorage.getItem('necho_lang');
  if (saved && saved !== 'en') _triggerGTCombo(saved);
};

function _triggerGTCombo(code) {
  const apply = () => {
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return false;
    combo.value = code;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  if (apply()) return;
  let tries = 0;
  const interval = setInterval(() => {
    if (apply() || ++tries >= 75) clearInterval(interval);
  }, 200);
}

function changeLanguage(code) {
  App.language = code;
  const el = document.getElementById('lang-label');
  if (el) el.textContent = LANG_NAMES[code] || 'ENGLISH';
  localStorage.setItem('necho_lang', code);
  const host = location.hostname;
  document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
  if (host) document.cookie = `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${host}`;
  if (code === 'en') { location.reload(); return; }
  document.cookie = `googtrans=/en/${code}; path=/`;
  if (host) document.cookie = `googtrans=/en/${code}; path=/; domain=${host}`;
  const tryApply = () => {
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return false;
    combo.value = code;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  if (tryApply()) return;
  let tries = 0;
  const interval = setInterval(() => {
    if (tryApply() || ++tries >= 10) {
      clearInterval(interval);
      if (tries >= 10) location.reload();
    }
  }, 200);
}

const ACC = { gray: false, contrast: false, motion: false, lineh: false, wordsp: false };
const ACC_CLASSES = {
  gray: 'a-gray', contrast: 'a-contrast', motion: 'a-motion', lineh: 'a-lineh', wordsp: 'a-wordsp',
};
function toggleAcc(key) {
  ACC[key] = !ACC[key];
  document.documentElement.classList.toggle(ACC_CLASSES[key], ACC[key]);
  const btn = document.getElementById('acc-' + key);
  if (btn) btn.classList.toggle('on', ACC[key]);
  localStorage.setItem('necho_acc', JSON.stringify(ACC));
}
function toggleAccPanel() {
  const p = document.getElementById('acc-panel');
  if (p) p.classList.toggle('open');
}

function toggleMob() {
  const m = document.getElementById('mob-menu');
  const bd = document.getElementById('mob-backdrop');
  if (!m) return;
  const isOpen = m.classList.toggle('open');
  if (bd) bd.classList.toggle('open', isOpen);
}
function closeMob() {
  const m = document.getElementById('mob-menu');
  const bd = document.getElementById('mob-backdrop');
  if (m) m.classList.remove('open');
  if (bd) bd.classList.remove('open');
}

function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('active');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -20px 0px' });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

document.addEventListener('click', (e) => {
  const panel = document.getElementById('acc-panel');
  const accBtn = document.querySelector('.acc-toggle');
  if (panel && !panel.contains(e.target) && accBtn && !accBtn.contains(e.target)) {
    panel.classList.remove('open');
  }
  const mob = document.getElementById('mob-menu');
  const hamburger = document.querySelector('.hamburger');
  if (mob && mob.classList.contains('open') &&
      !mob.contains(e.target) && hamburger && !hamburger.contains(e.target)) {
    closeMob();
  }
  const profileOverlay = document.getElementById('profile-overlay');
  const profileBtn = document.getElementById('nav-profile');
  if (profileOverlay && profileBtn && !profileOverlay.querySelector('.profile-panel').contains(e.target) && !profileBtn.contains(e.target)) {
    profileOverlay.remove();
  }
});

(function restore() {
  const lang = localStorage.getItem('necho_lang');
  if (lang) {
    App.language = lang;
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
    const lbl = document.getElementById('lang-label');
    if (lbl) lbl.textContent = LANG_NAMES[lang] || 'ENGLISH';
  }
  const acc = localStorage.getItem('necho_acc');
  if (acc) {
    try {
      const saved = JSON.parse(acc);
      Object.keys(saved).forEach(k => {
        if (saved[k]) {
          ACC[k] = true;
          document.documentElement.classList.add(ACC_CLASSES[k]);
          const btn = document.getElementById('acc-' + k);
          if (btn) btn.classList.add('on');
        }
      });
    } catch (e) {}
  }
  document.querySelectorAll('.nav-link, .mob-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === App.activePage);
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  _syncAuth();
  initReveal();
  const mob = document.getElementById('mob-menu');
  if (mob && !mob.querySelector('.mob-panel-head')) {
    const head = document.createElement('div');
    head.className = 'mob-panel-head';
    const title = document.createElement('span');
    title.className = 'mob-panel-title';
    title.textContent = 'Navigation';
    head.appendChild(title);
    const closeBtn = mob.querySelector('.mob-close');
    if (closeBtn) { mob.removeChild(closeBtn); head.appendChild(closeBtn); }
    mob.insertBefore(head, mob.firstChild);
  }
  const backdrop = document.createElement('div');
  backdrop.id = 'mob-backdrop';
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', closeMob);
});
