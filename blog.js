const STORAGE_KEY = 'necho_posts';
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1470&auto=format&fit=crop';

function loadPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function savePosts(posts) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }
  catch { alert('Storage limit reached. Use image URLs instead of file uploads to save space.'); }
}

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

let editorTags    = [];
let editorImgData = null;
let currentEditId = null;

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

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-');
}

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

function execCmd(cmd, val) {
  getEl('ed-body').focus();
  document.execCommand(cmd, false, val || null);
}
function insertHeading(level) { execCmd('formatBlock', level); }
function insertLink() {
  const url = prompt('Enter URL (include https://):', 'https://');
  if (url) execCmd('createLink', url);
}

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

function updateSeoScore() {
  const title    = (getEl('ed-title')?.value     || '').trim();
  const meta     = (getEl('ed-meta-desc')?.value || '').trim();
  const kw       = (getEl('ed-keyword')?.value   || '').trim().toLowerCase();
  const bodyText = (getEl('ed-body')?.innerText  || '').trim();
  const words    = bodyText.split(/\s+/).filter(Boolean).length;
  const hasImg   = !!(editorImgData || getEl('ed-img-url')?.value.trim());

  const checks = [
    { label: 'Title is present',                                   pass: title.length > 0 },
    { label: `Title length ${title.length}/65 chars (target 50-65)`,
                                                                   pass: title.length >= 50 && title.length <= 65 },
    { label: 'Meta description filled in',                         pass: meta.length > 0 },
    { label: `Meta desc ${meta.length}/160 chars (target 120-160)`,
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
    checks.push({ label: `Keyword density: ${density}% (target 0.5-3%)`,
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

  pv.dataset.prevTitle = document.title;
  const postTitle = post.title + ' - Necho Insights';
  const desc      = post.metaDescription || post.excerpt || '';
  const imgUrl    = (post.image && !post.image.startsWith('data:')) ? post.image : DEFAULT_IMG;
  const postUrl   = location.origin + location.pathname + '#' + (post.slug || post.id);

  document.title = postTitle;

  setMeta('description', desc);
  if (post.focusKeyword || post.tags?.length) {
    setMeta('keywords', [post.focusKeyword, ...(post.tags || [])].filter(Boolean).join(', '));
  }

  setOg('og:type',              'article');
  setOg('og:title',             postTitle);
  setOg('og:description',       desc);
  setOg('og:image',             imgUrl);
  setOg('og:url',               postUrl);
  setOg('article:published_time', post.date);
  setOg('article:author',         'Necho Neural Labs');
  setOg('article:section',        post.category || '');
  if (post.tags?.length) setOg('article:tag', post.tags.join(', '));

  setMeta('twitter:card',        'summary_large_image');
  setMeta('twitter:title',       postTitle);
  setMeta('twitter:description', desc);
  setMeta('twitter:image',       imgUrl);

  setCanonical(postUrl);

  injectPostStructuredData(post, postUrl);
}

function closePostView() {
  const pv = getEl('post-view');
  pv.classList.remove('open');
  document.body.style.overflow = '';
  document.title = pv.dataset.prevTitle || 'Blog - Necho Insights';

  setMeta('description', 'Read Necho\'s latest research, insights, and news on sign language AI, accessibility, and neural translation.');
  setOg('og:type',  'website');
  setOg('og:title', 'Blog - Necho Insights');
  setOg('og:url',   location.origin + location.pathname);
  setCanonical(location.origin + location.pathname);

  const jld = document.getElementById('post-jsonld');
  if (jld) jld.remove();
}

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

const DEFAULT_POSTS = [
  {
    id: 'seed-001',
    title: 'Advancing ASL Regional Dialects in AI',
    slug: 'advancing-asl-regional-dialects-in-ai',
    category: 'Research',
    tags: ['ASL', 'Regional Dialects', 'Machine Learning', 'NLP'],
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=1470&auto=format&fit=crop',
    metaDescription: 'How Necho is tackling the rich regional variation in American Sign Language to build more inclusive and accurate AI translation systems.',
    focusKeyword: 'ASL regional dialects AI',
    date: '2024-10-24T10:00:00.000Z',
    excerpt: 'American Sign Language is not monolithic. Across the United States, signers in different cities and communities use distinct regional variants…',
    body: `
      <h2>A Language of Many Voices</h2>
      <p>American Sign Language is not monolithic. Across the United States, signers in different cities and communities use distinct regional variants, from the historically rich Black ASL dialect that emerged from segregated schools to city-specific signs for everyday objects. For AI systems trained predominantly on a narrow corpus, these dialects are invisible, creating a silent exclusion.</p>
      <p>At Necho, we believe true accessibility means reaching every signer, not just those who conform to a standardized vocabulary. Our latest research initiative maps over 340 documented regional sign variations and integrates them into our neural translation pipeline.</p>

      <h2>The Data Challenge</h2>
      <p>Building a dialect-aware model requires far more than expanding a dataset. Regional signs often differ in handshape, movement, location, or non-manual markers, any one of which can change meaning entirely. Our team partnered with Deaf community organizations in Atlanta, Chicago, Los Angeles, and New York to capture authentic signing from over 600 participants.</p>
      <blockquote>The goal is not to standardize sign language; it's to ensure our technology reflects the full humanity of the Deaf community.</blockquote>
      <p>Each recording session was community-led, with Deaf researchers guiding annotation guidelines. This participatory design approach ensures our training labels carry cultural authenticity rather than outsider assumptions.</p>

      <h2>Neural Architecture Adaptations</h2>
      <p>Our baseline model uses a MediaPipe landmark graph fed into a temporal convolutional network. For dialect adaptation, we implemented a mixture-of-experts layer that routes input to specialized sub-networks conditioned on regional priors. When the system detects ambiguous signs, it queries multiple expert pathways and weights outputs by geographic and contextual probability.</p>
      <p>Early benchmarks show a 23% improvement in recognition accuracy for Black ASL signs and a 17% improvement for Southern regional variants compared to our previous uniform model. We are continuing ablation studies to isolate the contribution of each architectural choice.</p>

      <h2>What Comes Next</h2>
      <p>The next phase extends this work internationally, incorporating British Sign Language regional variation and beginning a collaboration with the Indian Sign Language research community. We are also exploring zero-shot adaptation techniques that would allow the model to generalize to newly documented dialects from minimal examples, a critical capability given that many regional sign communities remain understudied.</p>
      <p>Our findings will be presented at the ACL Accessibility Workshop this coming spring, with the annotated dialect corpus released under a community-governed open license.</p>
    `
  },
  {
    id: 'seed-002',
    title: 'Global Digital Accessibility Standards 2025',
    slug: 'global-digital-accessibility-standards-2025',
    category: 'Insights',
    tags: ['Accessibility', 'WCAG', 'Policy', 'Inclusive Design'],
    image: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?q=80&w=1469&auto=format&fit=crop',
    metaDescription: 'An overview of the landmark digital accessibility regulations coming into force globally in 2025 and what they mean for technology developers.',
    focusKeyword: 'digital accessibility standards 2025',
    date: '2024-10-20T10:00:00.000Z',
    excerpt: 'From the European Accessibility Act to updated WCAG 2.2 enforcement timelines, 2025 marks a turning point for digital inclusion worldwide…',
    body: `
      <h2>A Regulatory Inflection Point</h2>
      <p>From the European Accessibility Act to updated WCAG 2.2 enforcement timelines, 2025 marks a turning point for digital inclusion worldwide. Governments are no longer treating accessibility as a courtesy; it is becoming a hard legal requirement with teeth. For technology teams, understanding these changes is no longer optional.</p>
      <p>This post synthesizes the most consequential regulatory shifts and outlines practical steps for product teams navigating the new landscape.</p>

      <h2>European Accessibility Act: June 2025 Deadline</h2>
      <p>The European Accessibility Act (EAA) applies to a broad range of digital products and services, including e-commerce platforms, banking apps, e-readers, and communication services. By June 28, 2025, companies serving EU customers must comply regardless of where they are headquartered. Non-compliance exposes businesses to fines and potential market exclusion.</p>
      <p>The EAA references EN 301 549, which itself incorporates WCAG 2.1 Level AA. In practice, this means teams should be targeting WCAG 2.2 compliance to ensure forward compatibility and to address criterion improvements around cognitive accessibility and touch targets.</p>

      <h2>WCAG 2.2: New Success Criteria in Focus</h2>
      <p>WCAG 2.2 introduced nine new success criteria. The most impactful for product teams are Focus Appearance (2.4.11), which mandates visible and sufficiently large focus indicators, and Target Size (2.5.8), which sets minimum interactive element dimensions. Dragging Movements (2.5.7) requires that any functionality using drag operations also has a pointer-based alternative.</p>
      <blockquote>Accessible design is not a feature; it is the baseline from which all good design begins.</blockquote>
      <p>Authentication Without Cognitive Function Tests (3.3.8) has particularly significant implications for sign-in flows. CAPTCHAs that rely on visual pattern recognition or complex puzzles may no longer be compliant when no accessible alternative exists.</p>

      <h2>What Developers Should Prioritize</h2>
      <p>Audit your focus management first. A surprising number of otherwise well-built applications have broken focus traps in modals or invisible focus rings. Next, review all interactive elements for minimum target sizes on mobile: 24×24 CSS pixels is the new floor. Finally, examine any authentication or verification flows for cognitive load concerns.</p>
      <p>Beyond compliance, teams should invest in automated testing integration (axe-core, Lighthouse, and Deque's APIs integrate well with CI pipelines) while remembering that automated tools catch only 30-40% of accessibility issues. Human testing with assistive technology users remains irreplaceable.</p>

      <h2>The Opportunity in Compliance</h2>
      <p>Research consistently shows that accessibility improvements benefit all users, not just those with disabilities. Clearer focus indicators help anyone in bright sunlight. Larger touch targets reduce error rates for everyone. Captions benefit users in noisy environments. Organizations that lead on accessibility build stronger products, and that is the real opportunity in 2025's regulatory moment.</p>
    `
  },
  {
    id: 'seed-003',
    title: 'Institutional Partnerships for Education Access',
    slug: 'institutional-partnerships-for-education-access',
    category: 'Corporate',
    tags: ['Education', 'Partnership', 'Deaf Students', 'Universities'],
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1470&auto=format&fit=crop',
    metaDescription: 'Necho announces collaborations with Gallaudet University and three regional institutions to bring real-time sign language AI into classrooms.',
    focusKeyword: 'sign language AI education partnership',
    date: '2024-10-15T10:00:00.000Z',
    excerpt: 'Necho is proud to announce a series of institutional partnerships aimed at bringing real-time sign language interpretation to educational settings across three continents…',
    body: `
      <h2>Bringing Interpretation into the Classroom</h2>
      <p>Necho is proud to announce a series of institutional partnerships aimed at bringing real-time sign language interpretation to educational settings across three continents. Working alongside Gallaudet University, the National Institute for the Deaf in Rochester, the University of Delhi's Department of Special Education, and the UK's National Deaf Children's Society, we are piloting Necho's interpreter in live lecture and seminar environments.</p>
      <p>These partnerships represent more than technology deployments; they are structured research collaborations designed to measure real-world impact, gather feedback from Deaf students and educators, and shape the next generation of our product.</p>

      <h2>The Education Gap</h2>
      <p>Across the globe, Deaf and hard-of-hearing students face persistent educational disadvantage. Professional interpreters are expensive, in short supply, and not always available for impromptu office hours, study groups, or informal peer interactions. For students whose first language is a signed language, dependence on written text as the primary communication medium creates an unnecessary barrier.</p>
      <blockquote>Every student deserves to engage with their education in their own language, in real time, without waiting for a human interpreter to become available.</blockquote>
      <p>AI interpretation is not a replacement for human interpreters; it is a supplement that dramatically extends availability and coverage, particularly in resource-constrained settings.</p>

      <h2>Pilot Program Structure</h2>
      <p>Each institutional partner is running a structured 12-week pilot. At Gallaudet, Necho is deployed in undergraduate computer science courses, with students using the interpreter via tablet alongside the lecturer's slide content. At the University of Delhi, the focus is on multilingual scenarios, interpreting between Indian Sign Language and spoken Hindi, which tests our multilingual pipeline in live conditions.</p>
      <p>Data from all pilots is collected under IRB-approved protocols with full student consent. Findings will be published in open-access journals and shared with partner institutions for curriculum planning purposes.</p>

      <h2>Early Results</h2>
      <p>Preliminary data from the first six weeks of the Gallaudet pilot shows that students using Necho as a supplemental tool report an average 28% increase in confidence when engaging in spontaneous classroom discussion. Interpreter availability outside formal class hours increased from an average of 4 hours per week per student to effectively unlimited; students can use Necho's interpreter for any one-on-one or small group session on demand.</p>
      <p>We are deeply grateful to our partner institutions and, most importantly, to the students and educators who are shaping this work from the inside. Their feedback has already driven six significant product improvements in the current pilot cycle, and we expect many more.</p>
    `
  },
  {
    id: 'seed-004',
    title: 'How Neural Networks Decode Hand Gestures',
    slug: 'how-neural-networks-decode-hand-gestures',
    category: 'Technology',
    tags: ['Neural Networks', 'Computer Vision', 'MediaPipe', 'TFLite', 'Hand Tracking'],
    image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?q=80&w=1632&auto=format&fit=crop',
    metaDescription: 'A deep dive into the computer vision pipeline powering Necho, from MediaPipe hand landmarks to TFLite gesture classification at the edge.',
    focusKeyword: 'neural network hand gesture recognition',
    date: '2024-10-08T10:00:00.000Z',
    excerpt: 'Behind every real-time translation lies a stack of carefully orchestrated machine learning components. Here is a transparent look at how Necho\'s gesture recognition pipeline works\u2026',
    body: `
      <h2>From Pixels to Meaning</h2>
      <p>Behind every real-time translation lies a stack of carefully orchestrated machine learning components. At its core, Necho's gesture recognition pipeline converts a stream of camera frames into semantic meaning, but the path between those two points is anything but simple. This post offers a transparent look at the architecture driving our interpreter, written for engineers and curious non-engineers alike.</p>

      <h2>Stage One: Hand Landmark Detection with MediaPipe</h2>
      <p>The first stage uses Google's MediaPipe Hands model to detect and track up to two hands in each frame. MediaPipe outputs 21 three-dimensional landmarks per hand, which are key points at every finger joint, knuckle, and the wrist. These landmarks are normalized to be invariant to hand size and position within the frame, which means a small hand in the top-left corner of the image produces the same landmark values as a large hand centered in the frame.</p>
      <p>This normalization is crucial because it separates the gesture classification problem from the person detection problem. Our gesture classifier never needs to worry about where in the image the hands appear or how large they are. It only sees the shape of the hand.</p>

      <h2>Stage Two: Temporal Feature Extraction</h2>
      <p>Static hand shapes capture only part of sign language. Many signs differ only in their movement trajectory. The same handshape moving upward means one thing, while moving in a circular arc means another. To capture motion, we buffer 30 consecutive frames of landmark sequences and compute velocity and acceleration vectors for each joint across that window.</p>
      <blockquote>A sign is not a photograph; it is a choreography. Our model must understand time, not just shape.</blockquote>
      <p>These temporal features are concatenated with the static frame features and passed as a sequence to the classification stage.</p>

      <h2>Stage Three: TFLite Gesture Classification</h2>
      <p>The gesture classifier is a lightweight temporal convolutional network compiled to TFLite format for on-device inference. Running classification on-device, rather than sending video to a server, is a deliberate privacy and latency decision. No video ever leaves the user's device; only text translations are transmitted when sharing is explicitly requested.</p>
      <p>The model outputs a probability distribution over our vocabulary of gestures. We apply a beam search over the last 1.5 seconds of predictions to smooth out noise and handle co-articulation, the blending that naturally occurs between consecutive signs in fluent signing.</p>

      <h2>Continuous Improvement</h2>
      <p>Our production model achieves 94.2% top-1 accuracy on our held-out test set, but real-world performance varies with lighting, camera angle, and signing speed. We run a continuous evaluation pipeline that samples consented production sessions (with user opt-in) and flags prediction-confidence anomalies for human review. Each flagged session generates a potential training example that, after Deaf reviewer annotation, enters our retraining queue. This flywheel has improved model accuracy by 6.3 percentage points over the past eight months without any architectural changes.</p>
    `
  },
  {
    id: 'seed-005',
    title: 'Breaking Barriers: AI in Deaf Education',
    slug: 'breaking-barriers-ai-in-deaf-education',
    category: 'Accessibility',
    tags: ['Deaf Education', 'Inclusive AI', 'EdTech', 'Accessibility'],
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1464&auto=format&fit=crop',
    metaDescription: 'Exploring how artificial intelligence is reshaping educational access for Deaf and hard-of-hearing students, and the important limits of what technology alone can achieve.',
    focusKeyword: 'AI Deaf education accessibility',
    date: '2024-09-30T10:00:00.000Z',
    excerpt: 'Artificial intelligence is reshaping what educational access looks like for Deaf and hard-of-hearing students. But technology alone is never the full answer…',
    body: `
      <h2>The Promise and the Caveat</h2>
      <p>Artificial intelligence is reshaping what educational access looks like for Deaf and hard-of-hearing students. Real-time captions, automated sign language interpretation, and AI-generated summaries of spoken lectures: each of these tools chips away at barriers that have persisted for generations. But technology alone is never the full answer, and getting this right requires centering the voices of Deaf educators, students, and community members.</p>

      <h2>Where AI Is Making a Difference Today</h2>
      <p>Automatic speech recognition captioning has reached a level of accuracy (over 90% word error rate for clear speech in quiet environments) that makes it genuinely useful in many classroom settings. Students who previously relied entirely on note-takers can now follow along with near-real-time captions on a tablet, freeing their attention to watch the teacher rather than a human interpreter.</p>
      <p>Sign language recognition systems, including Necho, are enabling spontaneous two-way communication in contexts where a human interpreter would not be present: one-on-one office hours, peer study sessions, and informal campus interactions. A Deaf student asking a question in the library or a lab is no longer dependent on scheduling an interpreter days in advance.</p>
      <blockquote>The most powerful thing AI can do for Deaf students is give them time, time that was previously consumed by workarounds, back for actual learning.</blockquote>

      <h2>Persistent Gaps and Honest Limitations</h2>
      <p>No current system is fully reliable in noisy environments, for regional dialects, or for signing speed that varies significantly from training data. Students and educators consistently report that AI tools perform worst precisely when communication stakes are highest, during complex discussions, emotional conversations, and high-speed academic debates.</p>
      <p>There is also a risk of over-reliance. When an AI system makes a confident but wrong translation and the error goes unnoticed, the downstream consequences for a student's education can be significant. Effective deployment requires training educators to understand AI limitations and creating environments where students feel empowered to flag errors without social awkwardness.</p>

      <h2>Toward a Community-Centered Model</h2>
      <p>The most successful AI deployments in Deaf education share a common trait: they were designed with the Deaf community, not for it. Programs at Gallaudet, NTID, and progressive secondary schools have created feedback loops where students actively shape how AI tools are used and improved. This participatory model produces better technology and, critically, builds trust.</p>
      <p>At Necho, our partnership program is structured around this principle. Every institutional deployment includes a community advisory board with Deaf representation, a feedback mechanism built into the product interface, and a commitment to share de-identified improvement data back with the partner community. We believe this is not just ethically correct; it is the only way to build AI systems that actually work for the communities they serve.</p>
    `
  },
  {
    id: 'seed-006',
    title: 'The Future of Real-Time Sign Language Translation',
    slug: 'the-future-of-real-time-sign-language-translation',
    category: 'Research',
    tags: ['Future of AI', 'Sign Language', 'Real-Time Translation', 'Research Roadmap'],
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1465&auto=format&fit=crop',
    metaDescription: 'Necho\'s research team shares their five-year vision for sign language AI: from wearable gloves to whole-body interpretation and beyond.',
    focusKeyword: 'future real-time sign language translation AI',
    date: '2024-09-15T10:00:00.000Z',
    excerpt: 'Where is sign language AI headed over the next five years? Our research team shares an honest and ambitious look at the frontier challenges and the breakthroughs we are chasing…',
    body: `
      <h2>Where We Are, Honestly</h2>
      <p>Current sign language AI systems, including Necho, are impressive compared to where the field stood five years ago. We can recognize hundreds of signs in real time from standard camera input, handle natural signing speed in reasonably controlled conditions, and translate continuous signing rather than isolated gestures. These are genuine milestones.</p>
      <p>But if we are honest about where we are relative to where we need to be, the gap is still large. Natural, conversational signing in uncontrolled lighting, at native speed, across a full vocabulary, by a signer the model has never seen before: this remains an unsolved problem. Our research roadmap is built around exactly that challenge.</p>

      <h2>Frontier Challenge One: Open Vocabulary</h2>
      <p>Current production systems work with closed vocabularies, meaning sets of signs the model has been trained to recognize. This is workable for common scenarios but breaks down for proper nouns, technical terminology, and newly coined signs. The solution lies in combining gesture recognition with fingerspelling recognition (for spelling out words) and integrating large language model context to predict likely vocabulary from conversational context.</p>
      <p>We are currently training a joint model that fuses gesture classification probabilities with a constrained language model that scores candidate translations by their contextual plausibility. Early results are promising, particularly for domain-specific conversations where context heavily constrains vocabulary.</p>

      <h2>Frontier Challenge Two: Whole-Body Interpretation</h2>
      <p>Hands are only part of the picture. Non-manual markers, including facial expressions, mouth movements, head tilt, and shoulder positioning, carry grammatical information in ASL and most other sign languages. A raised eyebrow changes a statement into a yes/no question. Pursed lips indicate a specific degree of intensity. Current hand-centric models miss this entire layer of meaning.</p>
      <blockquote>Sign language is a full-body language. Any system that only watches the hands is reading half a sentence.</blockquote>
      <p>Our next model generation incorporates full upper-body landmark extraction, including 68-point facial mesh data from MediaPipe Face Mesh. Training this model requires a new corpus of recordings with explicit non-manual marker annotations, a labor-intensive effort we are currently undertaking with Deaf linguist collaborators.</p>

      <h2>Frontier Challenge Three: Bidirectional Translation</h2>
      <p>All current production sign language AI works in one direction: from sign to text or speech. Generating signed language from text (synthesis) remains significantly harder. Avatar-based signing systems exist but produce signing that native signers describe as robotic and difficult to read. Photorealistic signing video generation using diffusion models is an active research area that we are watching closely, though it raises important questions about consent, representation, and deepfake risk that the field must address before deployment.</p>

      <h2>A Five-Year Horizon</h2>
      <p>Our five-year research vision targets three milestones: an open-vocabulary system with 85% accuracy on novel signs using contextual inference; a whole-body model that correctly interprets non-manual markers with 90% precision; and a bidirectional system capable of generating intelligible signed output from text with positive ratings from at least 75% of native signer evaluators. These are ambitious targets. We share them publicly because accountability drives progress, and because the Deaf community deserves to know what we are actually working toward.</p>
    `
  }
];

function seedDefaultPosts() {
  const existing = loadPosts();
  if (existing.length > 0) return;
  savePosts(DEFAULT_POSTS);
}

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
  seedDefaultPosts();
  renderPosts();
  updateSeoScore();
});
