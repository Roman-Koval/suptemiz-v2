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

const STATUS_LABELS = {
  pending:     "В ожидании",
  confirmed:   "Подтверждён",
  in_progress: "В процессе",
  done:        "Завершён",
  cancelled:   "Отменён"
};

function mapStatusToLabel(status) {
  return STATUS_LABELS[status] || status;
}

function statusBadge(status) {
  return `<span class="status status-${status}">${mapStatusToLabel(status)}</span>`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU");
}

// =========================
// Загрузка заказов
// =========================
async function loadOrders() {
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "⏳";
  }

  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  } catch (e) {
    console.error("Ошибка загрузки заказов:", e);
    alert("Не удалось загрузить заказы. Проверьте подключение.");
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "🔄 Обновить";
    }
  }
}

// =========================
// Фильтрация
// =========================
function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (currentStatusFilter !== "all" && o.status !== currentStatusFilter) return false;
    if (!currentSearch) return true;
    const s = currentSearch.toLowerCase();
    return (
      (o.name || "").toLowerCase().includes(s) ||
      (o.phone || "").toLowerCase().includes(s) ||
      (o.id || "").toLowerCase().includes(s)
    );
  });
}

// =========================
// Счётчики статусов
// =========================
function renderStats() {
  const counts = {
    all: allOrders.length,
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    done: 0,
    cancelled: 0
  };

  allOrders.forEach((o) => {
    if (counts[o.status] !== undefined) counts[o.status]++;
  });

  // Обновляем цифры в кнопках фильтра
  document.querySelectorAll(".btn--filter").forEach((btn) => {
    const status = btn.dataset.status;
    const countEl = btn.querySelector(".filter-count");
    if (countEl && counts[status] !== undefined) {
      countEl.textContent = counts[status];
    }
  });

  // Общая статистика
  const statsEl = document.getElementById("adminStats");
  if (statsEl) {
    const totalRevenue = allOrders
      .filter(o => o.status === "done")
      .reduce((sum, o) => sum + (Number(o.price) || 0), 0);

    statsEl.innerHTML = `
      <span>Всего: <b>${counts.all}</b></span>
      <span>Ожидают: <b>${counts.pending}</b></span>
      <span>В процессе: <b>${counts.in_progress}</b></span>
      <span>Завершено: <b>${counts.done}</b></span>
      <span>Выручка: <b>${totalRevenue.toLocaleString("ru")} ₺</b></span>
    `;
  }
}

// =========================
// Таблица
// =========================
function renderTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const orders = getFilteredOrders();
  tbody.innerHTML = "";

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:20px;color:#9ca3af;">Заказы не найдены</td></tr>`;
    return;
  }

  orders.forEach((o) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${o.id || "—"}</td>
      <td>${o.name || "—"}</td>
      <td><a href="tel:${o.phone || ""}" style="color:#38bdf8">${o.phone || "—"}</a></td>
      <td>${o.area || "—"}</td>
      <td>${o.type || "—"}</td>
      <td>${o.areaSize || "—"} м²</td>
      <td>${o.date || "—"} ${o.time || ""}</td>
      <td>${o.price ? o.price + " ₺" : "—"}</td>
      <td>${o.createdAtLocal ? formatDateTime(o.createdAtLocal) : "—"}</td>
      <td style="max-width:120px;white-space:normal">${o.comment || "—"}</td>
      <td>${statusBadge(o.status)}</td>
      <td class="admin-actions-cell">
        <button data-action="confirm" title="Подтвердить" class="act-btn act-confirm">✔</button>
        <button data-action="start"   title="В процессе"  class="act-btn act-start">▶</button>
        <button data-action="done"    title="Завершить"   class="act-btn act-done">✓</button>
        <button data-action="cancel"  title="Отменить"    class="act-btn act-cancel">✕</button>
        <button data-action="delete"  title="Удалить"     class="act-btn act-delete">🗑</button>
      </td>
    `;

    tr.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action));
    });

    tbody.appendChild(tr);
  });
}

// =========================
// Карточки (мобайл)
// =========================
function renderCards() {
  const list = document.getElementById("ordersCardList");
  if (!list) return;

  const orders = getFilteredOrders();
  list.innerHTML = "";

  if (orders.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:#9ca3af;">Заказы не найдены</div>`;
    return;
  }

  orders.forEach((o) => {
    const card = document.createElement("div");
    card.className = "admin-card";

    card.innerHTML = `
      <div class="admin-card__header">
        <span class="admin-card__id">${o.id || "—"}</span>
        ${statusBadge(o.status)}
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Имя</span>
        <span class="admin-card__value">${o.name || "—"}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Телефон</span>
        <span class="admin-card__value"><a href="tel:${o.phone || ""}" style="color:#38bdf8">${o.phone || "—"}</a></span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Район</span>
        <span class="admin-card__value">${o.area || "—"}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Тип</span>
        <span class="admin-card__value">${o.type || "—"}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Площадь</span>
        <span class="admin-card__value">${o.areaSize || "—"} м²</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Дата/время</span>
        <span class="admin-card__value">${o.date || "—"} ${o.time || ""}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Цена</span>
        <span class="admin-card__value">${o.price ? o.price + " ₺" : "—"}</span>
      </div>
      ${o.comment ? `<div class="admin-card__row">
        <span class="admin-card__label">Комментарий</span>
        <span class="admin-card__value">${o.comment}</span>
      </div>` : ""}
      <div class="admin-card__actions">
        <button data-action="confirm" class="act-btn act-confirm">Подтв.</button>
        <button data-action="start"   class="act-btn act-start">Старт</button>
        <button data-action="done"    class="act-btn act-done">Готово</button>
        <button data-action="cancel"  class="act-btn act-cancel">Отмена</button>
        <button data-action="delete"  class="act-btn act-delete">Удалить</button>
      </div>
    `;

    card.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action));
    });

    list.appendChild(card);
  });
}

// =========================
// Рендер
// =========================
function render() {
  renderStats();
  renderTable();
  renderCards();
}

// =========================
// Действия
// =========================
async function handleAction(order, action) {
  const ref = doc(db, "orders", order.id);

  if (action === "delete") {
    if (!confirm(`Удалить заказ ${order.id}?`)) return;
    await deleteDoc(ref);
  } else {
    const statusMap = {
      confirm: "confirmed",
      start:   "in_progress",
      done:    "done",
      cancel:  "cancelled"
    };
    const newStatus = statusMap[action];
    if (newStatus) {
      await updateDoc(ref, { status: newStatus });
    }
  }

  await loadOrders();
}

// =========================
// Фильтры и поиск
// =========================
function initFilters() {
  document.querySelectorAll(".btn--filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn--filter").forEach((b) => b.classList.remove("btn--active"));
      btn.classList.add("btn--active");
      currentStatusFilter = btn.dataset.status;
      renderTable();
      renderCards();
    });
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentSearch = searchInput.value.trim();
      renderTable();
      renderCards();
    });
  }

  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadOrders);
  }

  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const rows = getFilteredOrders();
      const header = [
        "ID","Имя","Телефон","Район","Тип","Площадь","Дата","Время","Цена","Комментарий","Статус"
      ];
      const csv = [
        "\uFEFF" + header.join(";"),
        ...rows.map((o) =>
          [
            o.id,
            o.name || "",
            o.phone || "",
            o.area || "",
            o.type || "",
            o.areaSize || "",
            o.date || "",
            o.time || "",
            o.price || "",
            (o.comment || "").replace(/;/g, ","),
            mapStatusToLabel(o.status)
          ].join(";")
        )
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

// =========================
// Запуск
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  initFilters();
  await loadOrders();
});
