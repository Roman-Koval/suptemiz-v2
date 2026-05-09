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

  const rate = rates[type] || 0;
  const min  = mins[type]  || 0;
  const a    = Number(area) || 0;

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
// =========================
function initPriceCalculation() {
  const quickType  = document.getElementById("quickType");
  const quickArea  = document.getElementById("quickArea");
  const quickPrice = document.getElementById("quickPrice");

  if (quickArea)  quickArea.value   = "";
  if (quickType)  quickType.value   = "standard";
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
    areaEl.addEventListener("input",  updateOrderPrice);
  }
}

// =========================
// Telegram уведомление
// =========================
function sendTelegramNotification(order) {
  const botToken = "8776328263:AAFW4TPDyi1CwnbprZ-S1I2Mj9bXUDL0vv8";
  const chatId = "897174464";

  const text =
    `🧽 Новый заказ SupTemiz\n` +
    `ID: ${order.id}\n` +
    `Имя: ${order.name}\n` +
    `Телефон: ${order.phone}\n` +
    `Район: ${order.area}\n` +
    `Тип: ${order.type}\n` +
    `Площадь: ${order.areaSize || "-"} м²\n` +
    `Цена: ${order.price} ₺\n` +
    `Дата/время: ${order.date || "-"} ${order.time || ""}\n` +
    `Статус: ${order.status}`;

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
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
  const msg   = "Здравствуйте! Хочу уточнить детали по уборке.";
  wa.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// =========================
// Бургер-меню
// ИСПРАВЛЕНО: меню теперь fixed (позиционируется относительно viewport,
// а не страницы) — не «улетает» наверх при скролле.
// =========================
function initMenu() {
  const btn  = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");
  if (!btn || !menu) return;

  // Применяем position:fixed программно — это безопаснее, чем патчить CSS,
  // потому что здесь мы точно знаем, что элемент есть.
  menu.style.position = "fixed";
  menu.style.top      = "0";
  menu.style.right    = "0";
  menu.style.zIndex   = "9999";

  function openMenu() {
    menu.classList.add("open");
    document.body.style.overflow = "hidden"; // блокируем скролл фона
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    menu.classList.remove("open");
    document.body.style.overflow = "";
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", () => {
    menu.classList.contains("open") ? closeMenu() : openMenu();
  });

  // Закрываем по клику на ссылку внутри меню
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Закрываем по клику на оверлей (если есть) или вне меню
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== btn) {
      closeMenu();
    }
  });

  // Закрываем по Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("open")) closeMenu();
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
      id:           "ST-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      name:         form.name.value.trim(),
      phone:        form.phone.value.trim(),
      area:         form.area.value.trim(),
      type:         form.type.value,
      areaSize:     Number(form.areaSize.value || 0),
      date:         form.date.value,
      time:         form.time.value,
      comment:      form.comment.value.trim(),
      price:        calcPrice(form.type.value, Number(form.areaSize.value || 0)),
      createdAtLocal: new Date().toISOString(),
      status:       "pending"
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
