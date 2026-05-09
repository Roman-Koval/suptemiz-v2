const DEFAULT_LANG = 'ru';
const LANG_KEY = 'supTemiz_lang';

function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
}

function getLang() {
  return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
}

async function loadLang(lang) {
  try {
    const res = await fetch(`assets/lang/${lang}.json?v=${Date.now()}`);
    const dict = await res.json();

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) el.placeholder = dict[key];
    });

    document.title = dict['meta_title'] || document.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && dict['meta_description']) {
      metaDesc.setAttribute('content', dict['meta_description']);
    }
  } catch (e) {
    console.error('i18n load error', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('langSelect');
  const current = getLang();
  if (select) {
    select.value = current;
    select.addEventListener('change', () => {
      const lang = select.value;
      setLang(lang);
      loadLang(lang);
    });
  }
  loadLang(current);
});
