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
// Быстрый расчёт (hero)
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
// Инициализация калькулятора
// =========================
function initPriceCalculation() {
  const quickType = document.getElementById("quickType");
  const quickArea = document.getElementById("quickArea");
  const quickPrice = document.getElementById("quickPrice");

  // Сбрасываем калькулятор
  if (quickArea) quickArea.value = "";
  if (quickType) quickType.value = "standard";
  if (quickPrice) quickPrice.textContent = "—";

  if (quickType && quickArea) {
    quickType.addEventListener("change", () => {
      updateQuickPrice();
      // Синхронизируем ТИП в форму заказа
      const mainType = document.getElementById("type");
      if (mainType) {
        mainType.value = quickType.value;
        updateOrderPrice();
      }
    });

    quickArea.addEventListener("input", () => {
      updateQuickPrice();
      // Синхронизируем ПЛОЩАДЬ в форму заказа
      const mainArea = document.getElementById("areaSize");
      if (mainArea) {
        mainArea.value = quickArea.value;
        updateOrderPrice();
      }
    });
  }

  // Кнопка "Оформить заказ" в калькуляторе — синхронизирует оба поля перед скроллом
  const quickForm = document.getElementById("quickQuoteForm");
  if (quickForm) {
    quickForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (quickType && quickArea) {
        const mainType = document.getElementById("type");
        const mainArea = document.getElementById("areaSize");
        if (mainType) mainType.value = quickType.value;
        if (mainArea) mainArea.value = quickArea.value;
        updateOrderPrice();
      }
      document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  const typeEl = document.getElementById("type");
  const areaEl = document.getElementById("areaSize");

  if (typeEl && areaEl) {
    typeEl.addEventListener("change", updateOrderPrice);
    areaEl.addEventListener("input", updateOrderPrice);
  }

  // Инициализируем цену с дефолтным значением формы заказа
  updateOrderPrice();
}

// =========================
// Telegram уведомление
// =========================
function sendTelegramNotification(order) {
  const botToken = "ТВОЙ_ТОКЕН_БОТА";
  const chatId = "ТВОЙ_CHAT_ID";

  // Пропускаем отправку если токен не настроен
  if (botToken === "ТВОЙ_ТОКЕН_БОТА" || chatId === "ТВОЙ_CHAT_ID") return;

  const text =
    `🧹 Новый заказ SupTemiz\n` +
    `ID: ${order.id}\n` +
    `Имя: ${order.name}\n` +
    `Телефон: ${order.phone}\n` +
    `Район: ${order.area}\n` +
    `Тип: ${order.type}\n` +
    `Площадь: ${order.areaSize || "—"} м²\n` +
    `Цена: ${order.price} ₺\n` +
    `Дата/время: ${order.date || "—"} ${order.time || ""}\n` +
    `Комментарий: ${order.comment || "—"}`;

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((e) => console.warn("Telegram error:", e));
}

// =========================
// Firebase — сохранение заказа
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
    const isOpen = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    });
  });
}

// =========================
// Минимальная дата — сегодня
// =========================
function initDateConstraints() {
  const dateEl = document.getElementById("date");
  if (!dateEl) return;
  const today = new Date().toISOString().split("T")[0];
  dateEl.min = today;
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
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Отправка...";
    }

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
      initDateConstraints(); // восстановить min date после reset
      updateOrderPrice();

      document.getElementById("orderId").textContent = data.id;

      // Кнопка «Получать уведомления в Telegram» с deep link
      const tgBtn = document.getElementById("telegramSubscribeBtn");
      if (tgBtn) {
        tgBtn.href = `https://t.me/suptemiz_bot?start=order_${data.id}`;
        tgBtn.style.display = "inline-flex";
      }

      const modal = document.getElementById("orderModal");
      if (modal) modal.setAttribute("aria-hidden", "false");
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      alert("Ошибка при отправке заявки. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        // восстановить текст кнопки из data-i18n или дефолт
        submitBtn.textContent = submitBtn.dataset.i18nText || "Отправить заявку";
      }
    }
  });

  // Закрытие модала
  document.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", () => {
      const modal = document.getElementById("orderModal");
      if (modal) modal.setAttribute("aria-hidden", "true");
    });
  });

  // Закрытие модала по Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("orderModal");
      if (modal && modal.getAttribute("aria-hidden") === "false") {
        modal.setAttribute("aria-hidden", "true");
      }
    }
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
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  initPriceCalculation();
  initDateConstraints();
  initOrderForm();
  initWhatsApp();
  initMenu();
  initPWAInstall();

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
