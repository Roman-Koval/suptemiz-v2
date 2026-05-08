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
// Расчёт стоимости
// =========================
function calcPrice(type, area) {
  const rates = {
    standard: 1.2, // €/м²
    deep: 1.8,
    office: 1.5
  };

  const mins = {
    standard: 40,
    deep: 70,
    office: 60
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

    updateQuickPrice();
  }

  const typeEl = document.getElementById("type");
  const areaEl = document.getElementById("areaSize");

  if (typeEl && areaEl) {
    typeEl.addEventListener("change", updateOrderPrice);
    areaEl.addEventListener("input", updateOrderPrice);
    updateOrderPrice();
  }
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
    `Цена: ${order.price} €\n` +
    `Дата/время: ${order.date || "-"} ${order.time || ""}\n` +
    `Статус: ${order.status}`;

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
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
      alert("Заявка отправлена! Мы скоро свяжемся с вами.");
    } catch (e) {
      console.error(e);
      alert("Ошибка при отправке заявки. Попробуйте ещё раз.");
    }
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
});
