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
    case "pending": return "В ожидании";
    case "confirmed": return "Подтверждён";
    case "in_progress": return "В процессе";
    case "done": return "Завершён";
    case "cancelled": return "Отменён";
    default: return status;
  }
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU");
}

async function loadOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (currentStatusFilter !== "all" && o.status !== currentStatusFilter) return false;
    if (!currentSearch) return true;
    const s = currentSearch.toLowerCase();
    return (
      (o.name || "").toLowerCase().includes(s) ||
      (o.phone || "").toLowerCase().includes(s)
    );
  });
}

function renderTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  getFilteredOrders().forEach((o) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${o.id}</td>
      <td>${o.name || "—"}</td>
      <td>${o.phone || "—"}</td>
      <td>${o.area || "—"}</td>
      <td>${o.type || "—"}</td>
      <td>${o.areaSize || "—"}</td>
      <td>${o.date || "—"} ${o.time || ""}</td>
      <td>${o.price || "—"}</td>
      <td>${o.createdAtLocal ? formatDateTime(o.createdAtLocal) : "—"}</td>
      <td>${o.comment || "—"}</td>
      <td>${mapStatusToLabel(o.status)}</td>
      <td>
        <button data-action="confirm">✔</button>
        <button data-action="start">▶</button>
        <button data-action="done">✓</button>
        <button data-action="cancel">✕</button>
        <button data-action="delete">🗑</button>
      </td>
    `;

    tr.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action));
    });

    tbody.appendChild(tr);
  });
}

function renderCards() {
  const list = document.getElementById("ordersCardList");
  if (!list) return;
  list.innerHTML = "";

  getFilteredOrders().forEach((o) => {
    const card = document.createElement("div");
    card.className = "admin-card";

    card.innerHTML = `
      <div class="admin-card__row">
        <span class="admin-card__label">ID</span>
        <span class="admin-card__value">${o.id}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Имя</span>
        <span class="admin-card__value">${o.name || "—"}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Телефон</span>
        <span class="admin-card__value">${o.phone || "—"}</span>
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
        <span class="admin-card__value">${o.areaSize || "—"}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Дата/время</span>
        <span class="admin-card__value">${o.date || "—"} ${o.time || ""}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Цена</span>
        <span class="admin-card__value">${o.price || "—"}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Статус</span>
        <span class="admin-card__value">${mapStatusToLabel(o.status)}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Комментарий</span>
        <span class="admin-card__value">${o.comment || "—"}</span>
      </div>
      <div class="admin-card__actions">
        <button data-action="confirm">Подтв.</button>
        <button data-action="start">Старт</button>
        <button data-action="done">Готово</button>
        <button data-action="cancel">Отмена</button>
        <button data-action="delete">Удалить</button>
      </div>
    `;

    card.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action));
    });

    list.appendChild(card);
  });
}

function render() {
  renderTable();
  renderCards();
}

async function handleAction(order, action) {
  const ref = doc(db, "orders", order.id);
  if (action === "delete") {
    if (!confirm(`Удалить заказ ${order.id}?`)) return;
    await deleteDoc(ref);
  } else {
    let newStatus = order.status;
    if (action === "confirm") newStatus = "confirmed";
    if (action === "start") newStatus = "in_progress";
    if (action === "done") newStatus = "done";
    if (action === "cancel") newStatus = "cancelled";
    await updateDoc(ref, { status: newStatus });
  }
  await loadOrders();
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
    exportBtn.addEventListener("click", () => {
      const rows = getFilteredOrders();
      const header = [
        "ID","Имя","Телефон","Район","Тип","Площадь","Дата","Время","Цена","Комментарий","Статус"
      ];
      const csv = [
        header.join(";"),
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
            o.comment || "",
            mapStatusToLabel(o.status)
          ].join(";")
        )
      ].join("\n");

      // Экспорт в Excel (CSV + BOM)
const blob = new Blob(["\uFEFF" + csv], {
  type: "text/csv;charset=utf-8;"
});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "orders.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  initFilters();
  await loadOrders();
});
