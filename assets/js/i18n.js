const LANG_STORAGE_KEY = "supLang";
const SUPPORTED_LANGS = ["ru", "tr", "en"];

let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || "ru";
// Проверяем что язык поддерживается
if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = "ru";

let translations = {};

async function loadLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = "ru";

  try {
    const res = await fetch(`assets/lang/${lang}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    translations = await res.json();
    currentLang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    window._i18nTranslations = translations;
    applyTranslations();
    // Обновляем lang атрибут документа
    document.documentElement.lang = lang;
  } catch (e) {
    console.warn(`Не удалось загрузить язык "${lang}":`, e);
    // Если не ru — откатываемся на ru
    if (lang !== "ru") {
      console.warn("Откат на русский язык");
      await loadLang("ru");
    }
  }
}

function applyTranslations() {
  // Текстовое содержимое
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = getNestedKey(translations, key);
    if (val !== undefined) el.innerHTML = val;
  });

  // Placeholder
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const val = getNestedKey(translations, key);
    if (val !== undefined) el.placeholder = val;
  });

  // Value
  document.querySelectorAll("[data-i18n-value]").forEach((el) => {
    const key = el.getAttribute("data-i18n-value");
    const val = getNestedKey(translations, key);
    if (val !== undefined) el.value = val;
  });

  // Title / aria-label
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const val = getNestedKey(translations, key);
    if (val !== undefined) el.title = val;
  });
}

// Поддержка вложенных ключей: "nav.services" -> translations.nav.services
function getNestedKey(obj, keyPath) {
  return keyPath.split(".").reduce((acc, k) => {
    if (acc && typeof acc === "object") return acc[k];
    return undefined;
  }, obj);
}

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("langSelect");
  if (select) {
    select.value = currentLang;
    select.addEventListener("change", () => loadLang(select.value));
  }

  loadLang(currentLang);
});
