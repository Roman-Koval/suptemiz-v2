// =========================
// Firebase
// =========================
import { firebaseConfig } from "./firebase-config.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let db = null;

// =========================
// Расчёт стоимости (TRY)
// =========================
function calcPrice(type, area) {
  const rates = { standard: 40, deep: 60, office: 50 };
  const mins  = { standard: 600, deep: 900, office: 750 };
  const rate  = rates[type] || 0;
  const min   = mins[type]  || 0;
  const a     = Number(area) || 0;
  if (!rate || !a) return 0;
  return Math.max(a * rate, min);
}

function formatPrice(value) {
  if (!value || value <= 0) return "—";
  return value.toFixed(0);
}

// =========================
// Быстрый расчёт
// =========================
function updateQuickPrice() {
  const typeEl  = document.getElementById("quickType");
  const areaEl  = document.getElementById("quickArea");
  const priceEl = document.getElementById("quickPrice");
  if (!typeEl || !areaEl || !priceEl) return;
  priceEl.textContent = formatPrice(calcPrice(typeEl.value, areaEl.value));
}

// =========================
// Цена в форме заказа
// =========================
function updateOrderPrice() {
  const typeEl  = document.getElementById("type");
  const areaEl  = document.getElementById("areaSize");
  const priceEl = document.getElementById("orderPrice");
  if (!typeEl || !areaEl || !priceEl) return;
  priceEl.textContent = formatPrice(calcPrice(typeEl.value, areaEl.value));
}

// =========================
// Инициализация расчёта
// ИСПРАВЛЕНО: кнопка "Оформить заказ" в быстром расчёте
// переносит тип и площадь в главную форму и скроллит к ней
// без сброса quickQuoteForm
// =========================
function initPriceCalculation() {
  const quickType  = document.getElementById("quickType");
  const quickArea  = document.getElementById("quickArea");
  const quickPrice = document.getElementById("quickPrice");
  const quickForm  = document.getElementById("quickQuoteForm");

  if (quickArea)  quickArea.value        = "";
  if (quickType)  quickType.value        = "standard";
  if (quickPrice) quickPrice.textContent = "—";

  if (quickType) {
    quickType.addEventListener("change", () => {
      updateQuickPrice();
      const mainType = document.getElementById("type");
      if (mainType) mainType.value = quickType.value;
      updateOrderPrice();
    });
  }

  if (quickArea) {
    quickArea.addEventListener("input", () => {
      updateQuickPrice();
      const mainArea = document.getElementById("areaSize");
      if (mainArea) mainArea.value = quickArea.value;
      updateOrderPrice();
    });
  }

  // Перехватываем submit быстрой формы:
  // переносим значения в главную форму и скроллим к ней, НЕ сбрасываем поля
  if (quickForm) {
    quickForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const mainType = document.getElementById("type");
      const mainArea = document.getElementById("areaSize");

      if (mainType && quickType) mainType.value = quickType.value;
      if (mainArea && quickArea && quickArea.value) mainArea.value = quickArea.value;

      updateOrderPrice();

      const orderSection = document.getElementById("order");
      if (orderSection) {
        orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Фокус на первое незаполненное поле в главной форме
      setTimeout(() => {
        const nameField = document.getElementById("name");
        if (nameField && !nameField.value) nameField.focus();
      }, 600);
    });
  }

  const typeEl = document.getElementById("type");
  const areaEl = document.getElementById("areaSize");
  if (typeEl) typeEl.addEventListener("change", updateOrderPrice);
  if (areaEl) areaEl.addEventListener("input",  updateOrderPrice);
}

// =========================
// Telegram уведомление
// ЗАМЕНИ TG_BOT_TOKEN и TG_CHAT_ID на свои реальные значения!
// Токен берётся у @BotFather, chatId — у @userinfobot
// =========================
const TG_BOT_TOKEN = "СЮДА_ТОКЕН_БОТА";  // пример: 7123456789:AAHxxx...
const TG_CHAT_ID   = "СЮДА_CHAT_ID";     // пример: 123456789 или -1001234567890

function sendTelegramNotification(order) {
  if (TG_BOT_TOKEN.startsWith("СЮДА") || TG_CHAT_ID.startsWith("СЮДА")) {
    console.warn("[Telegram] Токен или chatId не настроены — уведомление пропущено");
    return;
  }

  const typeLabel = { standard: "Стандартная", deep: "Генеральная", office: "Офис" };

  const text =
    `🧽 <b>Новый заказ SupTemiz</b>\n\n` +
    `📌 ID: <code>${order.id}</code>\n` +
    `👤 Имя: ${order.name}\n` +
    `📞 Телефон: ${order.phone}\n` +
    `📍 Район: ${order.area}\n` +
    `🏠 Тип: ${typeLabel[order.type] || order.type}\n` +
    `📐 Площадь: ${order.areaSize || "—"} м²\n` +
    `💰 Цена: ${order.price} ₺\n` +
    `📅 Дата/время: ${order.date || "—"} ${order.time || ""}\n` +
    `💬 Комментарий: ${order.comment || "—"}`;

  fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
  })
    .then((r) => r.json())
    .then((r) => { if (!r.ok) console.warn("[Telegram] API error:", r.description); })
    .catch((e) => console.warn("[Telegram] fetch error:", e));
}

// =========================
// Firebase сохранение
// =========================
async function saveOrderToFirebase(data) {
  await addDoc(collection(db, "orders"), {
    ...data,
    createdAt: serverTimestamp()
  });
}

// =========================
// WhatsApp
// =========================
function initWhatsApp() {
  const wa = document.getElementById("whatsappLink");
  if (!wa) return;
  const phone = "905338001122";
  const msg   = "Здравствуйте! Хочу уточнить детали по уборке.";
  wa.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// =========================
// Бургер-меню
// ИСПРАВЛЕНО: position:fixed чтобы меню не уходило наверх при скролле
// =========================
function initMenu() {
  const btn  = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");
  if (!btn || !menu) return;

  menu.style.position = "fixed";
  menu.style.top      = "0";
  menu.style.right    = "0";
  menu.style.zIndex   = "9999";

  const open = () => {
    menu.classList.add("open");
    document.body.style.overflow = "hidden";
    btn.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    menu.classList.remove("open");
    document.body.style.overflow = "";
    btn.setAttribute("aria-expanded", "false");
  };

  btn.addEventListener("click", () => menu.classList.contains("open") ? close() : open());
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== btn) close();
  });
}

// =========================
// Обработка формы заказа
// =========================
function initOrderForm() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Отправляем…"; }

    const data = {
      id:             "ST-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      name:           form.name.value.trim(),
      phone:          form.phone.value.trim(),
      area:           form.area.value.trim(),
      type:           form.type.value,
      areaSize:       Number(form.areaSize.value || 0),
      date:           form.date.value,
      time:           form.time.value,
      comment:        form.comment.value.trim(),
      price:          calcPrice(form.type.value, Number(form.areaSize.value || 0)),
      createdAtLocal: new Date().toISOString(),
      status:         "pending"
    };

    try {
      await saveOrderToFirebase(data);
      sendTelegramNotification(data);

      form.reset();
      updateOrderPrice();

      const idEl    = document.getElementById("orderId");
      const modalEl = document.getElementById("orderModal");
      if (idEl)    idEl.textContent = data.id;
      if (modalEl) modalEl.setAttribute("aria-hidden", "false");
    } catch (err) {
      console.error(err);
      alert("Ошибка при отправке заявки. Попробуйте ещё раз.");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Отправить заявку"; }
    }
  });

  document.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", () => {
      const modalEl = document.getElementById("orderModal");
      if (modalEl) modalEl.setAttribute("aria-hidden", "true");
    });
  });
}

// =========================
// PWA install button
// =========================
function initPWAInstall() {
  const btn = document.getElementById("installBtn");
  if (!btn) return;
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });
  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") btn.hidden = true;
    deferredPrompt = null;
  });
}

// =========================
// Запуск
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);

  initPriceCalculation();
  initOrderForm();
  initWhatsApp();
  initMenu();
  initPWAInstall();

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
