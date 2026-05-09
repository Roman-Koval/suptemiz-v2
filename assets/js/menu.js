document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.header');
  const navLinks = document.querySelectorAll('a[href^="#"]');
  const burger = document.getElementById('burgerBtn');
  const nav = document.getElementById('navMenu');

  const headerHeight = header ? header.offsetHeight : 0;

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;

      window.scrollTo({ top, behavior: 'smooth' });

      if (nav && nav.classList.contains('nav--open')) {
        nav.classList.remove('nav--open');
      }
    });
  });

  if (burger && nav) {
    burger.addEventListener('click', () => {
      nav.classList.toggle('nav--open');
    });
  }
});
