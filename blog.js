/* ============================================================
   NECHO — Blog Writing Tool (blog.js) v2.0
   Features: Rich editor · Image upload · Tags · SEO scoring
             localStorage persistence · Post view · JSON-LD
   ============================================================ */

const STORAGE_KEY = 'necho_posts';
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1470&auto=format&fit=crop';

/* ─── Persistence ─────────────────────────────────────────── */
function loadPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function savePosts(posts) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }
  catch { alert('Storage limit reached. Use image URLs instead of file uploads to save space.'); }
}

/* ─── Render blog cards ───────────────────────────────────── */
function renderPosts() {
  const posts = loadPosts();
  const grid  = document.getElementById('blog-grid');
  grid.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
  posts.forEach(post => grid.prepend(createCard(post)));
  injectStructuredData(posts);
}

function createCard(post) {
  const card = document.createElement('article');
  card.className = 'blog-card fade-up';
  card.dataset.dynamic = '1';
  const tagsHtml = (post.tags || []).slice(0, 3)
    .map(t => `<span class="bc-tag">${esc(t)}</span>`).join('');
  card.innerHTML = `
    <div class="blog-img">
      <img src="${esc(post.image || DEFAULT_IMG)}" alt="${esc(post.title)}"/>
    </div>
    <div class="blog-meta">
      <span>${esc(post.category)}</span>
      <span>${fmtDate(post.date)}</span>
    </div>
    ${tagsHtml ? `<div class="bc-tags">${tagsHtml}</div>` : ''}
    <h3 class="blog-title">${esc(post.title)}</h3>
  `;
  card.addEventListener('click', () => openPostView(post));
  return card;
}

/* ─── Editor State ────────────────────────────────────────── */
let editorTags    = [];
let editorImgData = null;
let currentEditId = null;

/* openModal / closeModal kept for HTML onclick compatibility */
function openModal()  { openEditor(); }
function closeModal() { closeEditor(); }

function openEditor() {
  resetEditor();
  document.getElementById('blog-editor').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => getEl('ed-title').focus(), 100);
}
function closeEditor() {
  document.getElementById('blog-editor').classList.remove('open');
  document.body.style.overflow = '';
}

function resetEditor() {
  editorTags    = [];
  editorImgData = null;
  currentEditId = null;
  getEl('ed-title').value      = '';
  getEl('ed-slug').value       = '';
  getEl('ed-category').value   = 'Research';
  getEl('ed-meta-desc').value  = '';
  getEl('ed-keyword').value    = '';
  getEl('ed-tags-input').value = '';
  getEl('ed-tags-list').innerHTML = '';
  const prev = getEl('ed-img-preview');
  prev.src = ''; prev.style.display = 'none';
  getEl('ed-img-file').value = '';
  getEl('ed-img-url').value  = '';
  getEl('ed-body').innerHTML = '';
  getEl('ed-char-count').textContent = '0 / 160';
  updateSeoScore();
}

/* ─── Slug ────────────────────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-');
}

/* ─── Tags ────────────────────────────────────────────────── */
function addTag(raw) {
  const tag = raw.trim().replace(/,+$/, '');
  if (!tag || editorTags.includes(tag) || editorTags.length >= 10) return;
  editorTags.push(tag);
  renderEditorTags();
  updateSeoScore();
}
function removeTag(i) {
  editorTags.splice(i, 1);
  renderEditorTags();
  updateSeoScore();
}
function renderEditorTags() {
  getEl('ed-tags-list').innerHTML = editorTags.map((t, i) =>
    `<span class="ed-tag">${esc(t)}<button type="button" onclick="removeTag(${i})">×</button></span>`
  ).join('');
}

/* ─── Rich Text Toolbar ───────────────────────────────────── */
function execCmd(cmd, val) {
  getEl('ed-body').focus();
  document.execCommand(cmd, false, val || null);
}
function insertHeading(level) { execCmd('formatBlock', level); }
function insertLink() {
  const url = prompt('Enter URL (include https://):', 'https://');
  if (url) execCmd('createLink', url);
}

/* ─── Image ───────────────────────────────────────────────── */
async function handleImageFile(file) {
  if (!file) return;
  const data = await compressImage(file);
  editorImgData = data;
  const prev = getEl('ed-img-preview');
  prev.src = data; prev.style.display = 'block';
  updateSeoScore();
}
function compressImage(file, maxW = 1200, q = 0.82) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio  = Math.min(maxW / img.width, 1);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', q));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ─── SEO Score ───────────────────────────────────────────── */
function updateSeoScore() {
  const title    = (getEl('ed-title')?.value     || '').trim();
  const meta     = (getEl('ed-meta-desc')?.value || '').trim();
  const kw       = (getEl('ed-keyword')?.value   || '').trim().toLowerCase();
  const bodyText = (getEl('ed-body')?.innerText  || '').trim();
  const words    = bodyText.split(/\s+/).filter(Boolean).length;
  const hasImg   = !!(editorImgData || getEl('ed-img-url')?.value.trim());

  const checks = [
    { label: 'Title is present',                                   pass: title.length > 0 },
    { label: `Title length ${title.length}/65 chars (target 50–65)`,
                                                                   pass: title.length >= 50 && title.length <= 65 },
    { label: 'Meta description filled in',                         pass: meta.length > 0 },
    { label: `Meta desc ${meta.length}/160 chars (target 120–160)`,
                                                                   pass: meta.length >= 120 && meta.length <= 160 },
    { label: 'Focus keyword set',                                  pass: kw.length > 0 },
    { label: 'Tags added (at least 1)',                            pass: editorTags.length > 0 },
    { label: `Word count: ${words} words (target 300+)`,          pass: words >= 300 },
    { label: 'Featured image added',                               pass: hasImg },
  ];

  if (kw) {
    const safe    = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwCount = (bodyText.toLowerCase().match(new RegExp(safe, 'g')) || []).length;
    const density = words > 0 ? ((kwCount / words) * 100).toFixed(1) : '0.0';
    checks.push({ label: `Keyword in title`,            pass: title.toLowerCase().includes(kw) });
    checks.push({ label: `Keyword in meta description`, pass: meta.toLowerCase().includes(kw) });
    checks.push({ label: `Keyword density: ${density}% (target 0.5–3%)`,
                                                        pass: +density >= 0.5 && +density <= 3 });
  }

  const passed = checks.filter(c => c.pass).length;
  const score  = Math.round((passed / checks.length) * 100);
  const color  = score >= 75 ? 'green' : score >= 45 ? 'yellow' : 'red';

  const scoreEl = getEl('seo-score-val');
  const barEl   = getEl('seo-score-bar');
  const listEl  = getEl('seo-checks');
  if (scoreEl) { scoreEl.textContent = score + '%'; scoreEl.className = `seo-score-val ${color}`; }
  if (barEl)   { barEl.style.width   = score + '%'; barEl.className   = `seo-bar-fill ${color}`;  }
  if (listEl)  {
    listEl.innerHTML = checks.map(c =>
      `<div class="seo-check ${c.pass ? 'pass' : 'fail'}">
        <span>${c.pass ? '✓' : '✗'}</span><span>${c.label}</span>
      </div>`
    ).join('');
  }
}

/* ─── Publish ─────────────────────────────────────────────── */
function publishPost() {
  const title    = getEl('ed-title').value.trim();
  const slug     = getEl('ed-slug').value.trim()   || slugify(title);
  const cat      = getEl('ed-category').value;
  const meta     = getEl('ed-meta-desc').value.trim();
  const kw       = getEl('ed-keyword').value.trim();
  const bodyHTML = getEl('ed-body').innerHTML;
  const bodyText = getEl('ed-body').innerText.trim();
  const imgUrl   = getEl('ed-img-url').value.trim();
  const image    = editorImgData || imgUrl || DEFAULT_IMG;

  if (!title)    { alert('A title is required.'); return; }
  if (!bodyText) { alert('Please write some content before publishing.'); return; }

  const excerpt = bodyText.replace(/\s+/g, ' ').slice(0, 160) + '…';
  const posts   = loadPosts();
  const post    = {
    id: currentEditId || String(Date.now()),
    title, slug, category: cat, tags: [...editorTags],
    body: bodyHTML, excerpt, image,
    metaDescription: meta, focusKeyword: kw,
    date: new Date().toISOString(),
  };

  if (currentEditId) {
    const idx = posts.findIndex(p => p.id === currentEditId);
    if (idx >= 0) posts[idx] = post; else posts.unshift(post);
  } else {
    posts.unshift(post);
  }

  savePosts(posts);
  closeEditor();
  renderPosts();
}

/* ─── Post View ───────────────────────────────────────────── */
function openPostView(post) {
  const pv  = getEl('post-view');
  const img = getEl('pv-img');
  if (post.image) { img.src = post.image; img.style.display = 'block'; }
  else            { img.style.display = 'none'; }
  getEl('pv-title').textContent = post.title;
  getEl('pv-meta').textContent  = fmtDate(post.date) + ' · ' + post.category;
  getEl('pv-tags').innerHTML    = (post.tags || [])
    .map(t => `<span class="pv-tag">${esc(t)}</span>`).join('');
  getEl('pv-body').innerHTML    = post.body;
  pv.classList.add('open');
  pv.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  /* ── SEO: update all head signals for this post ── */
  pv.dataset.prevTitle = document.title;
  const postTitle = post.title + ' — Necho Insights';
  const desc      = post.metaDescription || post.excerpt || '';
  const imgUrl    = (post.image && !post.image.startsWith('data:')) ? post.image : DEFAULT_IMG;
  const postUrl   = location.origin + location.pathname + '#' + (post.slug || post.id);

  document.title = postTitle;

  // Standard meta
  setMeta('description', desc);
  if (post.focusKeyword || post.tags?.length) {
    setMeta('keywords', [post.focusKeyword, ...(post.tags || [])].filter(Boolean).join(', '));
  }

  // Open Graph (Facebook, LinkedIn, WhatsApp)
  setOg('og:type',              'article');
  setOg('og:title',             postTitle);
  setOg('og:description',       desc);
  setOg('og:image',             imgUrl);
  setOg('og:url',               postUrl);
  setOg('article:published_time', post.date);
  setOg('article:author',         'Necho Neural Labs');
  setOg('article:section',        post.category || '');
  if (post.tags?.length) setOg('article:tag', post.tags.join(', '));

  // Twitter / X Card
  setMeta('twitter:card',        'summary_large_image');
  setMeta('twitter:title',       postTitle);
  setMeta('twitter:description', desc);
  setMeta('twitter:image',       imgUrl);

  // Canonical URL for this post
  setCanonical(postUrl);

  // Per-post JSON-LD
  injectPostStructuredData(post, postUrl);
}

function closePostView() {
  const pv = getEl('post-view');
  pv.classList.remove('open');
  document.body.style.overflow = '';
  document.title = pv.dataset.prevTitle || 'Blog — Necho Insights';

  // Restore blog-level meta
  setMeta('description', 'Read Necho\'s latest research, insights, and news on sign language AI, accessibility, and neural translation.');
  setOg('og:type',  'website');
  setOg('og:title', 'Blog — Necho Insights');
  setOg('og:url',   location.origin + location.pathname);
  setCanonical(location.origin + location.pathname);

  // Remove per-post JSON-LD
  const jld = document.getElementById('post-jsonld');
  if (jld) jld.remove();
}

/* ─── Meta / OG / Canonical helpers ──────────────────────── */
function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function setOg(prop, content) {
  let el = document.querySelector(`meta[property="${prop}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', url);
}

/* ─── Per-post JSON-LD ────────────────────────────────────── */
function injectPostStructuredData(post, url) {
  let el = document.getElementById('post-jsonld');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json'; el.id = 'post-jsonld';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify({
    '@context':       'https://schema.org',
    '@type':          'BlogPosting',
    headline:         post.title,
    description:      post.metaDescription || post.excerpt || '',
    image:            (post.image && !post.image.startsWith('data:')) ? post.image : DEFAULT_IMG,
    url:              url,
    datePublished:    post.date,
    dateModified:     post.date,
    keywords:         [post.focusKeyword, ...(post.tags || [])].filter(Boolean).join(', '),
    articleSection:   post.category || '',
    author:           { '@type': 'Organization', name: 'Necho Neural Labs', url: location.origin },
    publisher: {
      '@type': 'Organization',
      name:    'Necho Neural Labs',
      logo:    { '@type': 'ImageObject', url: location.origin + '/logo.svg' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  });
}

/* ─── JSON-LD Structured Data ─────────────────────────────── */
function injectStructuredData(posts) {
  let el = document.getElementById('blog-jsonld');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json'; el.id = 'blog-jsonld';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'Blog',
    name:       'Necho Insights',
    url:        location.href,
    description:'Research, insights, and news on sign language AI, accessibility, and neural translation.',
    blogPost: posts.slice(0, 10).map(p => ({
      '@type':       'BlogPosting',
      headline:      p.title,
      description:   p.metaDescription || p.excerpt || '',
      keywords:      (p.tags || []).join(', '),
      datePublished: p.date,
      dateModified:  p.date,
      image:         p.image || '',
      author: { '@type': 'Organization', name: 'Necho Neural Labs' },
    })),
  });
}

/* ─── Helpers ─────────────────────────────────────────────── */
function getEl(id) { return document.getElementById(id); }
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'numeric' });
}

/* ─── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  getEl('ed-title')?.addEventListener('input', function () {
    getEl('ed-slug').value = slugify(this.value);
    updateSeoScore();
  });
  getEl('ed-meta-desc')?.addEventListener('input', function () {
    const n  = this.value.length;
    const el = getEl('ed-char-count');
    el.textContent = `${n} / 160`;
    el.className   = n < 50 ? 'ed-counter warn' : n <= 160 ? 'ed-counter ok' : 'ed-counter bad';
    updateSeoScore();
  });
  getEl('ed-keyword')?.addEventListener('input', updateSeoScore);
  getEl('ed-body')?.addEventListener('input', updateSeoScore);
  getEl('ed-tags-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); addTag(this.value); this.value = '';
    }
  });
  getEl('ed-img-file')?.addEventListener('change', function () {
    handleImageFile(this.files[0]);
  });
  getEl('ed-img-url')?.addEventListener('input', function () {
    const url  = this.value.trim();
    const prev = getEl('ed-img-preview');
    if (url) { editorImgData = null; prev.src = url; prev.style.display = 'block'; }
    else     { prev.style.display = 'none'; }
    updateSeoScore();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (getEl('post-view').classList.contains('open'))       closePostView();
      else if (getEl('blog-editor').classList.contains('open')) closeEditor();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (getEl('blog-editor').classList.contains('open')) { e.preventDefault(); publishPost(); }
    }
  });
  renderPosts();
  updateSeoScore();
});
