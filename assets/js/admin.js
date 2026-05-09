import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let db = null;
let allOrders = [];
let currentFilter = "all";
let currentSearch = "";

// =========================
// Загрузка заказов
// =========================
async function loadOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  allOrders = snap.docs.map((d) => ({
    _docId: d.id,
    ...d.data()
  }));

  render();
}

// =========================
// Рендер таблицы
// =========================
function render() {
  const tbody = document.getElementById("ordersBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtered = allOrders.filter((o) => {
    if (currentFilter !== "all" && o.status !== currentFilter) return false;
    if (!currentSearch) return true;

    const s = currentSearch.toLowerCase();
    return (
      (o.id && o.id.toLowerCase().includes(s)) ||
      (o.name && o.name.toLowerCase().includes(s)) ||
      (o.phone && o.phone.toLowerCase().includes(s)) ||
      (o.area && o.area.toLowerCase().includes(s))
    );
  });

  filtered.forEach((o) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${o.id}</td>
      <td>${o.name}</td>
      <td>${o.phone}</td>
      <td>${o.area}</td>
      <td>${o.type}</td>
      <td>${o.areaSize}</td>
      <td>${o.price}</td>
      <td>${o.date} ${o.time}</td>
      <td>${o.status}</td>
      <td>
        <button data-action="confirm">✔</button>
        <button data-action="start">▶</button>
        <button data-action="done">✓</button>
        <button data-action="cancel">✖</button>
        <button data-action="delete">🗑</button>
      </td>
    `;

    tr.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        handleAction(o, action);
      });
    });

    tbody.appendChild(tr);
  });
}

// =========================
// Действия с заказом
// =========================
async function handleAction(order, action) {
  const ref = doc(db, "orders", order._docId);

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

// =========================
// Фильтры и поиск
// =========================
function initFilters() {
  const filterEls = document.querySelectorAll("[data-filter]");
  filterEls.forEach((el) => {
    el.addEventListener("click", () => {
      currentFilter = el.getAttribute("data-filter") || "all";
      render();
    });
  });

  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentSearch = searchInput.value.trim();
      render();
    });
  }
}

// =========================
// Экспорт в Excel (CSV + BOM)
// =========================
function exportToExcel() {
  if (!allOrders.length) {
    alert("Нет данных для экспорта");
    return;
  }

  let csv = "ID;Имя;Телефон;Район;Тип;Площадь;Цена;Дата;Время;Статус\n";

  allOrders.forEach((o) => {
    csv += `${o.id};${o.name};${o.phone};${o.area};${o.type};${o.areaSize};${o.price};${o.date};${o.time};${o.status}\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "orders.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function initExportButton() {
  const btn = document.getElementById("exportBtn");
  if (!btn) return;
  btn.addEventListener("click", exportToExcel);
}

// =========================
// Запуск
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  initFilters();
  initExportButton();
  await loadOrders();
});
