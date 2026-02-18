/* ============================================================
   NECHO — Home Page Script (home.js)
   ============================================================ */

function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  // close others
  document.querySelectorAll('.faq-item.open').forEach(i => {
    if (i !== item) i.classList.remove('open');
  });
  item.classList.toggle('open');
}
