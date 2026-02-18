/* ============================================================
   NECHO — Interpreter Page Script (interpreter.js)
   Connects to: https://romram1-slr.hf.space
   ============================================================ */

const BACKEND = 'https://romram1-slr.hf.space';
let currentGesture = null;
let conversation   = [];

/* ─── Poll status (/status) every 500ms ─────────────────── */
async function fetchStatus() {
  try {
    const res  = await fetch(`${BACKEND}/status`);
    if (!res.ok) return;
    const data = await res.json();
    updateStatusUI(data);
  } catch { /* backend unreachable */ }
}

function updateStatusUI(data) {
  currentGesture = data.gesture || null;

  const handEl = document.getElementById('hand-status');
  const gestEl = document.getElementById('gesture-val');
  const confEl = document.getElementById('conf-val');
  const addBtn = document.getElementById('add-gesture-btn');

  if (data.hand_detected) {
    handEl.className = 'status-val status-yes';
    handEl.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Detected';
  } else {
    handEl.className = 'status-val status-no';
    handEl.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> No Hand';
  }

  gestEl.textContent = data.gesture || '—';
  confEl.textContent = data.gesture ? `${(data.confidence * 100).toFixed(1)}%` : '—';

  addBtn.disabled = !data.gesture;
  if (data.gesture) {
    addBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add "${data.gesture}" to Chat
    `;
  } else {
    addBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Gesture to Chat
    `;
  }
}

/* ─── Poll conversation every 600ms ─────────────────────── */
async function fetchConversation() {
  try {
    const res  = await fetch(`${BACKEND}/get_conversation`);
    if (!res.ok) return;
    const data = await res.json();
    if (JSON.stringify(data) !== JSON.stringify(conversation)) {
      conversation = data;
      renderConversation();
    }
  } catch { /* backend unreachable */ }
}

function renderConversation() {
  const box   = document.getElementById('chat-box');
  const empty = document.getElementById('chat-empty');
  if (!conversation.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  box.innerHTML = '';
  conversation.forEach(entry => {
    const div = document.createElement('div');
    div.className = `chat-msg ${entry.type === 'gesture' ? 'gesture' : 'user'} fade-in`;
    div.innerHTML = `
      <div class="msg-meta">
        <span class="msg-type">${entry.type === 'gesture' ? 'Gesture' : 'You'}${entry.auto_sent ? ' <small style="opacity:.5;font-size:8px">AUTO</small>' : ''}</span>
        <span class="msg-time">${entry.timestamp}</span>
      </div>
      <p class="msg-text">${entry.content}</p>
      ${entry.type === 'gesture' && entry.confidence ? `<div class="msg-conf">Confidence: ${(entry.confidence * 100).toFixed(1)}%</div>` : ''}
    `;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

/* ─── Add gesture to chat ────────────────────────────────── */
async function addGesture() {
  if (!currentGesture) return;
  try {
    const res  = await fetch(`${BACKEND}/add_gesture`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) alert(data.message || 'Could not add gesture.');
  } catch { alert('Backend unreachable.'); }
}

/* ─── Send text message ──────────────────────────────────── */
async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text) return;
  try {
    await fetch(`${BACKEND}/send_message`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, voice: false }),
    });
    input.value = '';
  } catch {
    /* fallback: add locally */
    const now   = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    conversation.push({ type:'user', content:text, timestamp:now });
    renderConversation();
    input.value = '';
  }
}

/* ─── Export ─────────────────────────────────────────────── */
function exportChat() {
  // Try backend export endpoint first
  try {
    window.location.href = `${BACKEND}/export`;
  } catch {
    // Fallback: download as text
    const lines = conversation.map(e => `[${e.timestamp}] ${e.type.toUpperCase()}: ${e.content}`).join('\n');
    const blob  = new Blob([lines], { type: 'text/plain' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = 'necho_conversation.txt'; a.click();
    URL.revokeObjectURL(url);
  }
}

/* ─── Start polling ──────────────────────────────────────── */
setInterval(fetchStatus,       500);
setInterval(fetchConversation, 600);

// Initial fetch
fetchStatus();
fetchConversation();
