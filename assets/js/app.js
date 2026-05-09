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
// Telegram уведомление
// =========================
async function sendTelegramNotification(order) {
  // ⚠️ Замените на ваши данные:
  const botToken = "8776328263:AAFW4TPDyi1CwnbprZ-S1I2Mj9bXUDL0vv8";
  const chatId = "897174464";

  if (botToken === "TELEGRAM_BOT_TOKEN" || chatId === "TELEGRAM_CHAT_ID") {
    console.warn("Telegram: токен или chat_id не настроены");
    return;
  }

  const typeLabel = {
    standard: "Стандартная",
    deep: "Генеральная",
    office: "Офис"
  }[order.type] || order.type;

  const text =
    `🧽 <b>Новый заказ SupTemiz</b>\n\n` +
    `🆔 <b>ID:</b> ${order.id}\n` +
    `👤 <b>Имя:</b> ${order.name}\n` +
    `📱 <b>Телефон:</b> ${order.phone}\n` +
    `📍 <b>Район:</b> ${order.area}\n` +
    `🏠 <b>Тип:</b> ${typeLabel}\n` +
    `📐 <b>Площадь:</b> ${order.areaSize || "—"} м²\n` +
    `💰 <b>Цена:</b> ${order.price} ₺\n` +
    `📅 <b>Дата:</b> ${order.date || "—"} ${order.time || ""}\n` +
    `💬 <b>Комментарий:</b> ${order.comment || "—"}\n` +
    `🔄 <b>Статус:</b> В ожидании`;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    const result = await resp.json();
    if (!result.ok) {
      console.warn("Telegram API error:", result.description);
    }
  } catch (e) {
    console.warn("Telegram error:", e);
  }
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

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    btn.textContent = isOpen ? "✕" : "☰";
  });

  // Закрывать при клике по ссылке
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
    });
  });

  // Закрывать при клике вне меню
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
    }
  });
}

// =========================
// Модальное окно
// =========================
function openModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("modal--open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("modal--open");
  document.body.style.overflow = "";
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
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Отправляем...";

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
      await sendTelegramNotification(data);

      form.reset();
      updateOrderPrice();

      document.getElementById("orderId").textContent = data.id;
      openModal();
    } catch (e) {
      console.error(e);
      alert("Ошибка при отправке заявки. Попробуйте ещё раз.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });

  document.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  // Закрыть по Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
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
  initWhatsApp();
  initMenu();
  initPWAInstall();

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
