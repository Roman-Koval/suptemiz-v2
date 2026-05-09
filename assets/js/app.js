// =========================
// Firebase
// =========================
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
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
  const rates = {
    standard: 40,
    deep: 60,
    office: 50
  };

  const mins = {
    standard: 600,
    deep: 900,
    office: 750
  };

  const rate = rates[type] || 0;
  const min = mins[type] || 0;

  const a = Number(area) || 0;
  if (!rate || !a) return 0;

  const raw = a * rate;
  return Math.max(raw, min);
}

function formatPrice(value) {
  if (!value || value <= 0) return "—";
  return value.toFixed(0);
}

// =========================
// Быстрый расчёт
// =========================
function updateQuickPrice() {
  const typeEl = document.getElementById("quickType");
  const areaEl = document.getElementById("quickArea");
  const priceEl = document.getElementById("quickPrice");

  if (!typeEl || !areaEl || !priceEl) return;

  const price = calcPrice(typeEl.value, areaEl.value);
  priceEl.textContent = formatPrice(price);
}

// =========================
// Цена в форме заказа
// =========================
function updateOrderPrice() {
  const typeEl = document.getElementById("type");
  const areaEl = document.getElementById("areaSize");
  const priceEl = document.getElementById("orderPrice");

  if (!typeEl || !areaEl || !priceEl) return;

  const price = calcPrice(typeEl.value, areaEl.value);
  priceEl.textContent = formatPrice(price);
}

// =========================
// Инициализация расчёта
// =========================
function initPriceCalculation() {
  const quickType = document.getElementById("quickType");
  const quickArea = document.getElementById("quickArea");

  if (quickArea) quickArea.value = "";
  if (quickType) quickType.value = "standard";

  const quickPrice = document.getElementById("quickPrice");
  if (quickPrice) quickPrice.textContent = "—";

  if (quickType && quickArea) {
    quickType.addEventListener("change", () => {
      updateQuickPrice();
      const mainType = document.getElementById("type");
      if (mainType) mainType.value = quickType.value;
      updateOrderPrice();
    });

    quickArea.addEventListener("input", () => {
      updateQuickPrice();
      const mainArea = document.getElementById("areaSize");
      if (mainArea) mainArea.value = quickArea.value;
      updateOrderPrice();
    });
  }

  const typeEl = document.getElementById("type");
  const areaEl = document.getElementById("areaSize");

  if (typeEl && areaEl) {
    typeEl.addEventListener("change", updateOrderPrice);
    areaEl.addEventListener("input", updateOrderPrice);
  }
}

// =========================
// Быстрый калькулятор → форма заказа
// =========================
function initQuickForm() {
  const form = document.getElementById("quickQuoteForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const quickType = document.getElementById("quickType");
    const quickArea = document.getElementById("quickArea");

    if (quickType) {
      const mainType = document.getElementById("type");
      if (mainType) mainType.value = quickType.value;
    }

    if (quickArea) {
      const mainArea = document.getElementById("areaSize");
      if (mainArea) mainArea.value = quickArea.value;
    }

    updateOrderPrice();

    document.getElementById("order").scrollIntoView({
      behavior: "smooth"
    });
  });
}

// =========================
// Telegram уведомление
// =========================
function sendTelegramNotification(order) {
  const botToken = "8776328263:AAFW4TPDyi1CwnbprZ-S1I2Mj9bXUDL0vv8";
  const chatId = "897174464";

  const text =
    `🧽 Новый заказ TEMIZ\n` +
    `ID: ${order.id}\n` +
    `Имя: ${order.name}\n` +
    `Телефон: ${order.phone}\n` +
    `Район: ${order.area}\n` +
    `Тип: ${order.type}\n` +
    `Площадь: ${order.areaSize || "-"}\n` +
    `Цена: ${order.price} ₺\n` +
    `Дата/время: ${order.date || "-"} ${order.time || ""}\n` +
    `Статус: ${order.status}`;

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    })
  }).catch((e) => console.warn("Telegram error", e));
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
  const msg = "Здравствуйте! Хочу уточнить детали по уборке.";

  wa.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// =========================
// Бургер-меню
// =========================
function initMenu() {
  const btn = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");

  if (!btn || !menu) return;

  btn.addEventListener("click", () => {
    menu.classList.toggle("open");
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
    });
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

    const data = {
      id: "ST-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      area: form.area.value.trim(),
      type: form.type.value,
      areaSize: Number(form.areaSize.value || 0),
      date: form.date.value,
      time: form.time.value,
      comment: form.comment.value.trim(),
      price: calcPrice(form.type.value, Number(form.areaSize.value || 0)),
      createdAtLocal: new Date().toISOString(),
      status: "pending"
    };

    try {
      await saveOrderToFirebase(data);
      sendTelegramNotification(data);

      form.reset();
      updateOrderPrice();

      document.getElementById("orderId").textContent = data.id;
      document.getElementById("orderModal").setAttribute("aria-hidden", "false");
    } catch (e) {
      console.error(e);
      alert("Ошибка при отправке заявки. Попробуйте ещё раз.");
    }
  });

  document.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("orderModal").setAttribute("aria-hidden", "true");
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
    if (outcome === "accepted") {
      btn.hidden = true;
    }
    deferredPrompt = null;
  });
}

// =========================
// Запуск
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  initPriceCalculation();
  initOrderForm();
  initQuickForm();
  initWhatsApp();
  initMenu();
  initPWAInstall();

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
