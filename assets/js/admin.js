import { firebaseConfig } from "./firebase-config.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let db = null;
let allOrders = [];
let currentStatusFilter = "all";
let currentSearch = "";

function mapStatusToLabel(status) {
  switch (status) {
    case "pending":    return "В ожидании";
    case "confirmed":  return "Подтверждён";
    case "in_progress": return "В процессе";
    case "done":       return "Завершён";
    case "cancelled":  return "Отменён";
    default:           return status || "—";
  }
}

function mapTypeToLabel(type) {
  switch (type) {
    case "standard": return "Стандартная";
    case "deep":     return "Генеральная";
    case "office":   return "Офис";
    default:         return type || "—";
  }
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return "—";
  }
}

// Показать/скрыть loader
function setLoading(visible) {
  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.style.display = visible ? "flex" : "none";
}

// Показать сообщение об ошибке
function showError(msg) {
  const el = document.getElementById("errorMessage");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  }
}

function hideError() {
  const el = document.getElementById("errorMessage");
  if (el) el.style.display = "none";
}

async function loadOrders() {
  setLoading(true);
  hideError();
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  } catch (err) {
    console.error("Ошибка загрузки заказов:", err);
    showError("Не удалось загрузить заказы. Проверьте подключение и попробуйте снова.");
  } finally {
    setLoading(false);
  }
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (currentStatusFilter !== "all" && o.status !== currentStatusFilter) return false;
    if (!currentSearch) return true;
    const s = currentSearch.toLowerCase();
    return (
      (o.id || "").toLowerCase().includes(s) ||
      (o.name || "").toLowerCase().includes(s) ||
      (o.phone || "").toLowerCase().includes(s) ||
      (o.area || "").toLowerCase().includes(s)
    );
  });
}

function statusClass(status) {
  const map = {
    pending: "status--pending",
    confirmed: "status--confirmed",
    in_progress: "status--in-progress",
    done: "status--done",
    cancelled: "status--cancelled"
  };
  return map[status] || "";
}

function renderTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const orders = getFilteredOrders();
  tbody.innerHTML = "";

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:2rem;color:#6b7280;">Заказов не найдено</td></tr>`;
    return;
  }

  orders.forEach((o) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td title="${o.id}">${o.id}</td>
      <td>${escHtml(o.name)}</td>
      <td>${escHtml(o.phone)}</td>
      <td>${escHtml(o.area)}</td>
      <td>${mapTypeToLabel(o.type)}</td>
      <td>${o.areaSize || "—"}</td>
      <td>${escHtml(o.date)} ${escHtml(o.time)}</td>
      <td>${o.price ? o.price + " ₺" : "—"}</td>
      <td>${o.createdAtLocal ? formatDateTime(o.createdAtLocal) : "—"}</td>
      <td title="${escHtml(o.comment)}">${escHtml(o.comment, 40)}</td>
      <td><span class="status-badge ${statusClass(o.status)}">${mapStatusToLabel(o.status)}</span></td>
      <td class="actions-cell">
        <button class="btn-action btn-action--confirm" data-action="confirm" title="Подтвердить">✔</button>
        <button class="btn-action btn-action--start" data-action="start" title="В процессе">▶</button>
        <button class="btn-action btn-action--done" data-action="done" title="Завершить">✓</button>
        <button class="btn-action btn-action--cancel" data-action="cancel" title="Отменить">✕</button>
        <button class="btn-action btn-action--delete" data-action="delete" title="Удалить">🗑</button>
      </td>
    `;

    tr.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action));
    });

    tbody.appendChild(tr);
  });
}

function renderCards() {
  const list = document.getElementById("ordersCardList");
  if (!list) return;

  const orders = getFilteredOrders();
  list.innerHTML = "";

  if (orders.length === 0) {
    list.innerHTML = `<p style="text-align:center;padding:2rem;color:#6b7280;">Заказов не найдено</p>`;
    return;
  }

  orders.forEach((o) => {
    const card = document.createElement("div");
    card.className = "admin-card";

    card.innerHTML = `
      <div class="admin-card__header">
        <span class="admin-card__id">${o.id}</span>
        <span class="status-badge ${statusClass(o.status)}">${mapStatusToLabel(o.status)}</span>
      </div>
      <div class="admin-card__row"><span class="admin-card__label">Имя</span><span class="admin-card__value">${escHtml(o.name)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Телефон</span><span class="admin-card__value">${escHtml(o.phone)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Район</span><span class="admin-card__value">${escHtml(o.area)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Тип</span><span class="admin-card__value">${mapTypeToLabel(o.type)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Площадь</span><span class="admin-card__value">${o.areaSize ? o.areaSize + " м²" : "—"}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Дата/время</span><span class="admin-card__value">${escHtml(o.date)} ${escHtml(o.time)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Цена</span><span class="admin-card__value">${o.price ? o.price + " ₺" : "—"}</span></div>
      ${o.comment ? `<div class="admin-card__row"><span class="admin-card__label">Комментарий</span><span class="admin-card__value">${escHtml(o.comment)}</span></div>` : ""}
      <div class="admin-card__actions">
        <button class="btn-action btn-action--confirm" data-action="confirm">Подтвердить</button>
        <button class="btn-action btn-action--start" data-action="start">В процессе</button>
        <button class="btn-action btn-action--done" data-action="done">Завершить</button>
        <button class="btn-action btn-action--cancel" data-action="cancel">Отменить</button>
        <button class="btn-action btn-action--delete" data-action="delete">Удалить</button>
      </div>
    `;

    card.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action));
    });

    list.appendChild(card);
  });
}

function render() {
  renderTable();
  renderCards();
  updateCounter();
}

function updateCounter() {
  const el = document.getElementById("ordersCount");
  if (el) {
    const filtered = getFilteredOrders().length;
    const total = allOrders.length;
    el.textContent = currentStatusFilter === "all" && !currentSearch
      ? `Всего: ${total}`
      : `Показано: ${filtered} из ${total}`;
  }
}

async function handleAction(order, action) {
  const ref = doc(db, "orders", order.id);
  try {
    if (action === "delete") {
      if (!confirm(`Удалить заказ ${order.id}?`)) return;
      await deleteDoc(ref);
    } else {
      const statusMap = {
        confirm: "confirmed",
        start: "in_progress",
        done: "done",
        cancel: "cancelled"
      };
      const newStatus = statusMap[action];
      if (!newStatus) return;
      await updateDoc(ref, { status: newStatus });
    }
    await loadOrders();
  } catch (err) {
    console.error("Ошибка при обновлении:", err);
    alert("Не удалось выполнить действие. Попробуйте ещё раз.");
  }
}

function initFilters() {
  document.querySelectorAll(".btn--filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn--filter").forEach((b) => b.classList.remove("btn--active"));
      btn.classList.add("btn--active");
      currentStatusFilter = btn.dataset.status;
      render();
    });
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentSearch = searchInput.value.trim();
      render();
    });
  }

  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadOrders);
  }

  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportCSV);
  }
}

// Экспорт в CSV (с BOM для корректного открытия в Excel)
function exportCSV() {
  const rows = getFilteredOrders();
  if (rows.length === 0) {
    alert("Нет данных для экспорта.");
    return;
  }

  const header = ["ID", "Имя", "Телефон", "Район", "Тип", "Площадь (м²)", "Дата", "Время", "Цена (₺)", "Комментарий", "Статус", "Создано"];
  const csvRows = [
    header.join(";"),
    ...rows.map((o) =>
      [
        o.id,
        o.name || "",
        o.phone || "",
        o.area || "",
        mapTypeToLabel(o.type),
        o.areaSize || "",
        o.date || "",
        o.time || "",
        o.price || "",
        (o.comment || "").replace(/[\n;]/g, " "),
        mapStatusToLabel(o.status),
        o.createdAtLocal ? formatDateTime(o.createdAtLocal) : ""
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")
    )
  ].join("\n");

  // BOM для корректной кодировки в Excel
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvRows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Защита от XSS — экранирование HTML
function escHtml(str, maxLen = 0) {
  if (!str) return "—";
  const s = String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen) + "…";
  return s;
}

document.addEventListener("DOMContentLoaded", async () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  initFilters();
  await loadOrders();
});
