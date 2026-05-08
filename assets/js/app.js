// Базовые тарифы (€/м²)
const RATES = {
  standard: 1.2,
  deep: 1.8,
  office: 1.5,
};

const MIN_PRICE = {
  standard: 40,
  deep: 70,
  office: 60,
};

function calcPrice(type, area) {
  const rate = RATES[type] ?? RATES.standard;
  const min = MIN_PRICE[type] ?? 0;
  const raw = rate * area;
  return Math.max(raw, min);
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(0);
}

function updateQuickPrice() {
  const type = document.getElementById("quickType").value;
  const area = Number(document.getElementById("quickArea").value || 0);
  const price = calcPrice(type, area);
  document.getElementById("quickPrice").textContent = formatPrice(price);
}

function updateOrderPrice() {
  const type = document.getElementById("type").value;
  const area = Number(document.getElementById("areaSize").value || 0);
  const price = calcPrice(type, area);
  document.getElementById("orderPrice").textContent = formatPrice(price);
}

function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0");
  return `ST-${ts}-${rand}`;
}

function openModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.classList.add("modal--open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.classList.remove("modal--open");
  modal.setAttribute("aria-hidden", "true");
}

function initModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-modal-close]")) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function initNav() {
  const menuBtn = document.getElementById("menuToggle");
  const nav = document.querySelector(".nav");
  if (!menuBtn || !nav) return;

  menuBtn.addEventListener("click", () => {
    nav.classList.toggle("nav--open");
  });

  nav.addEventListener("click", (e) => {
    if (e.target.matches(".nav__link")) {
      nav.classList.remove("nav--open");
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function initQuickForm() {
  const form = document.getElementById("quickQuoteForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("quickType").value;
    const area = document.getElementById("quickArea").value;
    const orderType = document.getElementById("type");
    const orderArea = document.getElementById("areaSize");

    if (orderType) orderType.value = type;
    if (orderArea) orderArea.value = area;

    updateOrderPrice();

    const orderSection = document.getElementById("order");
    if (orderSection) {
      orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.getElementById("quickType").addEventListener("change", updateQuickPrice);
  document.getElementById("quickArea").addEventListener("input", updateQuickPrice);

  updateQuickPrice();
}

function initOrderForm() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  ["type", "areaSize"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventName = id === "areaSize" ? "input" : "change";
    el.addEventListener(eventName, updateOrderPrice);
  });

  updateOrderPrice();

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!form.reportValidity()) return;

    const data = {
      id: generateOrderId(),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      area: form.area.value.trim(),
      type: form.type.value,
      areaSize: Number(form.areaSize.value || 0),
      date: form.date.value,
      time: form.time.value,
      comment: form.comment.value.trim(),
      price: calcPrice(form.type.value, Number(form.areaSize.value || 0)),
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem("supTemizOrders") || "[]");
      existing.push(data);
      localStorage.setItem("supTemizOrders", JSON.stringify(existing));
    } catch (err) {
      console.warn("Не удалось сохранить заказ в localStorage", err);
    }

    const orderIdEl = document.getElementById("orderId");
    if (orderIdEl) orderIdEl.textContent = data.id;

    openModal();
    form.reset();
    updateOrderPrice();
  });
}

function initYear() {
  const yearEl = document.getElementById("year");
  if (!yearEl) return;
  yearEl.textContent = new Date().getFullYear();
}

function initWhatsApp() {
  const link = document.getElementById("whatsappLink");
  if (!link) return;

  const phone = "+905555555555"; // здесь можно подставить реальный номер
  const text = encodeURIComponent(
    "Здравствуйте! Хочу заказать уборку через сайт SupTemiz."
  );
  link.href = `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${text}`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.warn("SW registration failed", err));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initQuickForm();
  initOrderForm();
  initModal();
  initYear();
  initWhatsApp();
  registerServiceWorker();
});
