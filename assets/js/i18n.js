const DEFAULT_LANG = 'ru';
const LANG_KEY = 'supTemiz_lang';

// сохранить язык
function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
}

// получить язык
function getLang() {
    return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
}

// загрузить JSON и применить переводы
async function loadLang(lang) {
    try {
        const response = await fetch(`assets/lang/${lang}.json?v=${Date.now()}`);
        const dict = await response.json();

        // обычный текст
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.textContent = dict[key];
        });

        // placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) el.placeholder = dict[key];
        });

        // title
        if (dict['meta_title']) {
            document.title = dict['meta_title'];
        }

        // description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && dict['meta_description']) {
            metaDesc.setAttribute('content', dict['meta_description']);
        }

    } catch (err) {
        console.error('i18n load error:', err);
    }
}

// инициализация
document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('langSelect');
    const currentLang = getLang();

    // установить выбранный язык в селекторе
    if (select) {
        select.value = currentLang;

        select.addEventListener('change', () => {
            const lang = select.value;
            setLang(lang);
            loadLang(lang);
        });
    }

    // загрузить язык при старте
    loadLang(currentLang);
});
