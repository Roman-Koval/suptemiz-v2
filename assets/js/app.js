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
// Расчёт стоимости
// =========================
function calcPrice(type, area) {
  const rates = { standard: 40, deep: 60, office: 50 };
  const mins = { standard: 600, deep: 900, office: 750 };

  const a = Number(area) || 0;
  const price = a * (rates[type] || 0);
  return Math.max(price, mins[type] || 0);
}

function formatPrice(v) {
  return v > 0 ? v.toFixed(0) : "—";
}

// =========================
// Быстрый калькулятор
// =========================
function updateQuickPrice() {
  const t = document.getElementById("quickType");
  const a = document.getElementById("quickArea");
  const p = document.getElementById("quickPrice");
  if (!t || !a || !p) return;
  p.textContent = formatPrice(calcPrice(t.value, a.value));
}

// =========================
// Цена в форме заказа
// =========================
function updateOrderPrice() {
  const t = document.getElementById("type");
  const a = document.getElementById("areaSize");
  const p = document.getElementById("orderPrice");
  if (!t || !a || !p) return;
  p.textContent = formatPrice(calcPrice(t.value, a.value));
}

// =========================
// Инициализация расчётов
// =========================
function initPriceCalculation() {
  const qt = document.getElementById("quickType");
  const qa = document.getElementById("quickArea");

  if (qt && qa) {
    qt.addEventListener("change", () => {
      updateQuickPrice();
      document.getElementById("type").value = qt.value;
      updateOrderPrice();
    });

    qa.addEventListener("input", () => {
      updateQuickPrice();
      document.getElementById("areaSize").value = qa.value;
      updateOrderPrice();
    });
  }

  const t = document.getElementById("type");
  const a = document.getElementById("areaSize");

  if (t && a) {
    t.addEventListener("change", updateOrderPrice);
    a.addEventListener("input", updateOrderPrice);
  }
}

// =========================
// Быстрый → форма заказа
// =========================
function initQuickForm() {
  const form = document.getElementById("quickQuoteForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const qt = document.getElementById("quickType");
    const qa = document.getElementById("quickArea");

    if (qt) document.getElementById("type").value = qt.value;
    if (qa) document.getElementById("areaSize").value = qa.value;

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
  });
}

// =========================
// Форма заказа
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
      areaSize: Number(form.areaSize.value),
      date: form.date.value,
      time: form.time.value,
      comment: form.comment.value.trim(),
      price: calcPrice(form.type.value, form.areaSize.value),
      status: "pending",
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, "orders"), {
      ...data,
      createdAt: serverTimestamp()
    });

    sendTelegramNotification(data);

    document.getElementById("orderId").textContent = data.id;
    document.getElementById("orderModal").setAttribute("aria-hidden", "false");

    form.reset();
    updateOrderPrice();
  });
}

// =========================
// Мобильное меню (исправленное)
// =========================
function initMenu() {
  const btn = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");

  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const href = link.getAttribute("href");
      menu.classList.remove("open");

      setTimeout(() => {
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      }, 300);
    });
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.classList.remove("open");
    }
  });
}

// =========================
// PWA install
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
    deferredPrompt = null;
    btn.hidden = true;
  });
}

// =========================
// Запуск
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  initPriceCalculation();
  initQuickForm();
  initOrderForm();
  initMenu();
  initPWAInstall();

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
});
