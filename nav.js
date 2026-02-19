/* ============================================================
   NECHO — Shared App Logic (nav.js)
   Include on every page BEFORE page-specific scripts.
   ============================================================ */

/* ─── State ─────────────────────────────────────────────── */
const App = {
  isLoggedIn:  false,
  isAdmin:     false,
  isLight:     false,
  language:    'en',
  activePage:  document.body.dataset.page || 'home',
};
window.App = App;

const LANG_NAMES = {
  en:'ENGLISH', hi:'HINDI', ta:'TAMIL', te:'TELUGU',
  kn:'KANNADA', ml:'MALAYALAM', mr:'MARATHI', gu:'GUJARATI',
};
const PAGES = {
  home:        'index.html',
  interpreter: 'interpreter.html',
  about:       'about.html',
  blog:        'blog.html',
  signin:      'signin.html',
  signup:      'signup.html',
};

/* ─── Navigation ─────────────────────────────────────────── */
function goTo(page) {
  if (PAGES[page]) window.location.href = PAGES[page];
}

/* ─── Auth ───────────────────────────────────────────────── */
function login() {
  App.isLoggedIn = true;
  sessionStorage.setItem('necho_logged_in', '1');
  _syncAuth();
}
function logout() {
  App.isLoggedIn = false;
  App.isAdmin    = false;
  sessionStorage.removeItem('necho_logged_in');
  sessionStorage.removeItem('necho_admin');
  _syncAuth();
  goTo('home');
}
function activateAdmin() {
  App.isAdmin    = true;
  App.isLoggedIn = true;
  sessionStorage.setItem('necho_logged_in', '1');
  sessionStorage.setItem('necho_admin', '1');
  _syncAuth();
}
function _syncAuth() {
  const out  = document.getElementById('nav-signout');
  const inn  = document.getElementById('nav-signin');
  const mOut = document.getElementById('mob-signout');
  const mInn = document.getElementById('mob-signin');
  const adm  = document.getElementById('footer-admin-btn');
  const addP = document.getElementById('admin-add-btn');

  if (inn)  inn.style.display  = App.isLoggedIn ? 'none' : '';
  if (out)  out.style.display  = App.isLoggedIn ? ''     : 'none';
  if (mInn) mInn.style.display = App.isLoggedIn ? 'none' : '';
  if (mOut) mOut.style.display = App.isLoggedIn ? ''     : 'none';
  if (adm)  adm.style.display  = App.isAdmin    ? 'none' : '';
  if (addP) addP.style.display = App.isAdmin    ? 'block': 'none';
}

/* ─── Theme ──────────────────────────────────────────────── */
function toggleTheme() {
  App.isLight = !App.isLight;
  document.documentElement.classList.toggle('light', App.isLight);
  localStorage.setItem('necho_theme', App.isLight ? 'light' : 'dark');
  _syncThemeIcon();
}
function _syncThemeIcon() {
  const sun  = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (sun)  sun.style.display  = App.isLight ? 'none'  : 'block';
  if (moon) moon.style.display = App.isLight ? 'block' : 'none';
}

/* ─── Language / Google Translate ────────────────────────── */

// Inject hidden Google Translate widget
(function injectGoogleTranslate() {
  const div = document.createElement('div');
  div.id = 'google_translate_element';
  div.style.display = 'none';
  document.body.appendChild(div);

  const s = document.createElement('script');
  s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  s.async = true;
  document.head.appendChild(s);
})();

window.googleTranslateElementInit = function () {
  new google.translate.TranslateElement({
    pageLanguage: 'en',
    includedLanguages: 'hi,ta,te,kn,ml,mr,gu',
    autoDisplay: false,
  }, 'google_translate_element');

  // Re-apply saved language now that GT is ready
  const saved = localStorage.getItem('necho_lang');
  if (saved && saved !== 'en') _triggerTranslate(saved);
};

function _triggerTranslate(code) {
  const attempt = (n) => {
    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = code;
      combo.dispatchEvent(new Event('change'));
    } else if (n > 0) {
      setTimeout(() => attempt(n - 1), 300);
    }
  };
  attempt(20); // retries for up to ~6 seconds while GT loads
}

function changeLanguage(code) {
  App.language = code;
  const el = document.getElementById('lang-label');
  if (el) el.textContent = LANG_NAMES[code] || 'ENGLISH';
  localStorage.setItem('necho_lang', code);

  if (code === 'en') {
    // Clear the googtrans cookie and reload to restore English
    const host = location.hostname;
    document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${host}`;
    location.reload();
  } else {
    _triggerTranslate(code);
  }
}

/* ─── Accessibility ──────────────────────────────────────── */
const ACC = {
  gray:     false,
  contrast: false,
  motion:   false,
  lineh:    false,
  wordsp:   false,
};
const ACC_CLASSES = {
  gray:'a-gray', contrast:'a-contrast', motion:'a-motion', lineh:'a-lineh', wordsp:'a-wordsp',
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

/* ─── Mobile menu ────────────────────────────────────────── */
function toggleMob() {
  const m = document.getElementById('mob-menu');
  if (m) m.classList.toggle('open');
}

/* ─── Scroll-reveal ──────────────────────────────────────── */
function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ─── Close acc panel on outside click ──────────────────── */
document.addEventListener('click', (e) => {
  const panel = document.getElementById('acc-panel');
  const btn   = document.querySelector('.acc-toggle');
  if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
    panel.classList.remove('open');
  }
});

/* ─── Restore state from storage ────────────────────────── */
(function restore() {
  // Theme
  const theme = localStorage.getItem('necho_theme');
  if (theme === 'light') { App.isLight = true; document.documentElement.classList.add('light'); }

  // Language
  const lang = localStorage.getItem('necho_lang');
  if (lang) {
    App.language = lang;
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
    const lbl = document.getElementById('lang-label');
    if (lbl) lbl.textContent = LANG_NAMES[lang] || 'ENGLISH';
  }

  // Auth is handled by firebase-nav.js (injected below)

  // Accessibility
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
    } catch(e) {}
  }

  // Active nav link
  document.querySelectorAll('.nav-link, .mob-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === App.activePage);
  });
})();

/* ─── Run after DOM ready ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  _syncAuth();
  _syncThemeIcon();
  initReveal();
});
