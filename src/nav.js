/** Mobile nav toggle for marketing pages */
document.querySelectorAll('[data-nav-pill]').forEach((nav) => {
  const toggle = nav.querySelector('[data-nav-toggle]');
  const menu = nav.querySelector('[data-nav-menu]');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('nav-open')) {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
});
