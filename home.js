function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  document.querySelectorAll('.faq-item.open').forEach(i => {
    if (i !== item) i.classList.remove('open');
  });
  item.classList.toggle('open');
}
