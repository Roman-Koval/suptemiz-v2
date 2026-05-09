const LANG_STORAGE_KEY = "supLang";
let currentLang = localStorage.getItem(LANG_STORAGE_KEY) || "ru";
let translations = {};

async function loadLang(lang) {
  try {
    const res = await fetch(`assets/lang/${lang}.json`);
    translations = await res.json();
    currentLang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    applyTranslations();
  } catch (e) {
    console.error("Ошибка загрузки языка:", e);
  }
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[key]) el.innerHTML = translations[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[key]) el.placeholder = translations[key];
  });

  document.querySelectorAll("[data-i18n-value]").forEach((el) => {
    const key = el.getAttribute("data-i18n-value");
    if (translations[key]) el.value = translations[key];
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("langSelect");
  if (select) {
    select.value = currentLang;
    select.addEventListener("change", () => loadLang(select.value));
  }

  loadLang(currentLang);
});
