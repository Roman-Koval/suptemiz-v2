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

// =========================
// Helpers
// =========================
function mapStatusToLabel(status) {
  const map = {
    pending:     "В ожидании",
    confirmed:   "Подтверждён",
    in_progress: "В процессе",
    done:        "Завершён",
    cancelled:   "Отменён",
  };
  return map[status] || status || "—";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU");
}

// =========================
// Кастомный диалог подтверждения
// ИСПРАВЛЕНО: window.confirm() блокируется на мобильных браузерах
// в iframe/GitHub Pages → заменяем на свой модал
// =========================
function showConfirm(message) {
  return new Promise((resolve) => {
    // Создаём диалог один раз
    let dlg = document.getElementById("_confirmDialog");
    if (!dlg) {
      dlg = document.createElement("div");
      dlg.id = "_confirmDialog";
      dlg.style.cssText = `
        display:none; position:fixed; inset:0; z-index:99999;
        background:rgba(0,0,0,.65); align-items:center; justify-content:center;
      `;
      dlg.innerHTML = `
        <div style="
          background:#1e293b; border:1px solid #334155; border-radius:12px;
          padding:1.5rem 2rem; max-width:340px; width:90%; text-align:center;
          color:#f9fafb; font-family:system-ui,sans-serif;
        ">
          <p id="_confirmMsg" style="margin:0 0 1.25rem; font-size:1rem; line-height:1.5"></p>
          <div style="display:flex; gap:.75rem; justify-content:center">
            <button id="_confirmNo"  style="
              padding:.5rem 1.25rem; border-radius:6px; border:1px solid #475569;
              background:#0f172a; color:#cbd5e1; cursor:pointer; font-size:.9rem;
            ">Отмена</button>
            <button id="_confirmYes" style="
              padding:.5rem 1.25rem; border-radius:6px; border:none;
              background:#b91c1c; color:#fff; cursor:pointer; font-size:.9rem; font-weight:600;
            ">Удалить</button>
          </div>
        </div>
      `;
      document.body.appendChild(dlg);
    }

    document.getElementById("_confirmMsg").textContent = message;
    dlg.style.display = "flex";

    const yes = document.getElementById("_confirmYes");
    const no  = document.getElementById("_confirmNo");

    const cleanup = (result) => {
      dlg.style.display = "none";
      yes.replaceWith(yes.cloneNode(true)); // снимаем старые listeners
      no.replaceWith(no.cloneNode(true));
      resolve(result);
    };

    document.getElementById("_confirmYes").addEventListener("click", () => cleanup(true),  { once: true });
    document.getElementById("_confirmNo") .addEventListener("click", () => cleanup(false), { once: true });
  });
}

// =========================
// Загрузка заказов
// =========================
async function loadOrders() {
  const q    = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  allOrders  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (currentStatusFilter !== "all" && o.status !== currentStatusFilter) return false;
    if (!currentSearch) return true;
    const s = currentSearch.toLowerCase();
    return (
      (o.name  || "").toLowerCase().includes(s) ||
      (o.phone || "").toLowerCase().includes(s)
    );
  });
}

// =========================
// Рендер таблицы (десктоп)
// =========================
function renderTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const orders = getFilteredOrders();
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="admin-empty">Заказов не найдено</td></tr>`;
    return;
  }

  orders.forEach((o) => {
    const tr = document.createElement("tr");
    tr.dataset.orderId = o.id;

    tr.innerHTML = `
      <td>${o.id}</td>
      <td>${o.name     || "—"}</td>
      <td>${o.phone    || "—"}</td>
      <td>${o.area     || "—"}</td>
      <td>${o.type     || "—"}</td>
      <td>${o.areaSize || "—"}</td>
      <td>${o.date     || "—"} ${o.time || ""}</td>
      <td>${o.price    || "—"}</td>
      <td>${o.createdAtLocal ? formatDateTime(o.createdAtLocal) : "—"}</td>
      <td>${o.comment  || "—"}</td>
      <td class="status-cell" data-status="${o.status || ''}">${mapStatusToLabel(o.status)}</td>
      <td class="actions-cell">
        <button class="btn-action btn-confirm"  data-action="confirm"  title="Подтвердить">✔</button>
        <button class="btn-action btn-start"    data-action="start"    title="В процессе">▶</button>
        <button class="btn-action btn-done"     data-action="done"     title="Завершить">✓</button>
        <button class="btn-action btn-cancel"   data-action="cancel"   title="Отменить">✕</button>
        <button class="btn-action btn-delete"   data-action="delete"   title="Удалить">🗑</button>
      </td>
    `;

    tr.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action, tr));
    });

    tbody.appendChild(tr);
  });
}

// =========================
// Рендер карточек (мобайл)
// =========================
function renderCards() {
  const list = document.getElementById("ordersCardList");
  if (!list) return;
  list.innerHTML = "";

  const orders = getFilteredOrders();
  if (!orders.length) {
    list.innerHTML = `<div class="admin-empty">Заказов не найдено</div>`;
    return;
  }

  orders.forEach((o) => {
    const card = document.createElement("div");
    card.className      = "admin-card";
    card.dataset.orderId = o.id;

    card.innerHTML = `
      <div class="admin-card__header">
        <span class="admin-card__id">${o.id}</span>
        <span class="status-badge" data-status="${o.status || ''}">${mapStatusToLabel(o.status)}</span>
      </div>
      <div class="admin-card__row"><span class="admin-card__label">Имя</span>        <span class="admin-card__value">${o.name     || "—"}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Телефон</span>    <span class="admin-card__value">${o.phone    || "—"}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Район</span>      <span class="admin-card__value">${o.area     || "—"}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Тип</span>        <span class="admin-card__value">${o.type     || "—"}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Площадь</span>    <span class="admin-card__value">${o.areaSize || "—"} ${o.areaSize ? "м²" : ""}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Дата/время</span> <span class="admin-card__value">${o.date || "—"} ${o.time || ""}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Цена</span>       <span class="admin-card__value">${o.price ? o.price + " ₺" : "—"}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Комментарий</span><span class="admin-card__value">${o.comment  || "—"}</span></div>
      <div class="admin-card__actions">
        <button class="btn-action btn-confirm"  data-action="confirm">Подтв.</button>
        <button class="btn-action btn-start"    data-action="start">В процессе</button>
        <button class="btn-action btn-done"     data-action="done">Завершить</button>
        <button class="btn-action btn-cancel"   data-action="cancel">Отменить</button>
        <button class="btn-action btn-delete"   data-action="delete">Удалить</button>
      </div>
    `;

    card.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action, card));
    });

    list.appendChild(card);
  });
}

function render() {
  renderTable();
  renderCards();
  updateStats();
}

// =========================
// Счётчики статусов
// =========================
function updateStats() {
  const counts = { all: allOrders.length, pending: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0 };
  allOrders.forEach((o) => { if (o.status in counts) counts[o.status]++; });

  document.querySelectorAll(".btn--filter").forEach((btn) => {
    const badge = btn.querySelector(".filter-badge");
    if (badge) badge.textContent = counts[btn.dataset.status] ?? 0;
  });
}

// =========================
// Действия со статусами
// ИСПРАВЛЕНО: оптимистичное обновление DOM + кастомный confirm вместо window.confirm
// =========================
async function handleAction(order, action, rowEl) {
  const ref = doc(db, "orders", order.id);

  if (action === "delete") {
    const ok = await showConfirm(`Удалить заказ ${order.id}?`);
    if (!ok) return;

    // Оптимистично убираем из DOM и массива
    rowEl?.remove();
    allOrders = allOrders.filter((o) => o.id !== order.id);
    updateStats();

    try {
      await deleteDoc(ref);
    } catch (e) {
      console.error("Ошибка удаления:", e);
      await loadOrders(); // откат при ошибке
    }
    return;
  }

  const statusMap = { confirm: "confirmed", start: "in_progress", done: "done", cancel: "cancelled" };
  const newStatus = statusMap[action];
  if (!newStatus) return;

  // Оптимистично обновляем локальный массив
  const idx = allOrders.findIndex((o) => o.id === order.id);
  if (idx !== -1) allOrders[idx].status = newStatus;

  // Обновляем DOM прямо в текущей строке/карточке без полного ре-рендера
  rowEl?.querySelectorAll(".status-cell, .status-badge").forEach((el) => {
    el.textContent    = mapStatusToLabel(newStatus);
    el.dataset.status = newStatus;
  });

  updateStats();

  try {
    await updateDoc(ref, { status: newStatus });
  } catch (e) {
    console.error("Ошибка обновления статуса:", e);
    await loadOrders(); // откат при ошибке
  }
}

// =========================
// Фильтры и управление
// =========================
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
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled    = true;
      refreshBtn.textContent = "Загрузка…";
      await loadOrders();
      refreshBtn.disabled    = false;
      refreshBtn.textContent = "Обновить";
    });
  }

  // =========================
  // Экспорт CSV
  // ИСПРАВЛЕНО: телефон оборачивается в ="..." — Excel трактует как текст,
  // не конвертирует в научную нотацию 3,53Е+11
  // BOM \uFEFF — для корректной кириллицы при открытии в Excel
  // =========================
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const rows = getFilteredOrders();
      if (!rows.length) { alert("Нет данных для экспорта"); return; }

      const header = ["ID","Имя","Телефон","Район","Тип","Площадь (м²)","Дата","Время","Цена (₺)","Создано","Комментарий","Статус"];

      const csvRows = rows.map((o) => {
        // ="..." — стандартный способ принудить Excel читать как текст
        const phoneSafe = o.phone ? `="${o.phone}"` : "";
        return [
          o.id,
          o.name     || "",
          phoneSafe,
          o.area     || "",
          o.type     || "",
          o.areaSize || "",
          o.date     || "",
          o.time     || "",
          o.price    || "",
          o.createdAtLocal ? formatDateTime(o.createdAtLocal) : "",
          (o.comment || "").replace(/[\r\n;]/g, " "),
          mapStatusToLabel(o.status),
        ].join(";");
      });

      const csv  = "\uFEFF" + [header.join(";"), ...csvRows].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `suptemiz_orders_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

// =========================
// Старт
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  initFilters();
  await loadOrders();
});
