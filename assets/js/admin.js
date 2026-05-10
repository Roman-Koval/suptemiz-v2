import { firebaseConfig } from "./firebase-config.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =========================
// Состояние
// =========================
let db = null;
let allOrders = [];
let currentFilter = "all";
let currentSearch = "";
let unsubscribe = null;

const STATUS_LABELS = {
  pending:     "В ожидании",
  confirmed:   "Подтверждён",
  in_progress: "В процессе",
  done:        "Завершён",
  cancelled:   "Отменён"
};

function mapStatusToLabel(s) {
  return STATUS_LABELS[s] || s;
}

function statusBadge(s) {
  return `<span class="status status-${s}">${mapStatusToLabel(s)}</span>`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU");
}

// =========================
// Realtime подписка (onSnapshot вместо getDocs)
// =========================
function subscribeOrders() {
  if (unsubscribe) unsubscribe();

  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  setStatus("⏳ Подключаемся...");

  unsubscribe = onSnapshot(q,
    (snap) => {
      // ВАЖНО: _docId — это внутренний Firestore ID документа для updateDoc/deleteDoc
      // Поле id внутри документа — это наш бизнес-ID "ST-XXXXX"
      allOrders = snap.docs.map((d) => ({
        _docId: d.id,
        ...d.data()
      }));
      setStatus(`✅ ${allOrders.length} заказов · ${new Date().toLocaleTimeString("ru-RU")}`);
      render();
    },
    (err) => {
      console.error("Firestore:", err);
      if (err.code === "permission-denied") {
        setStatus("❌ Нет прав. Проверьте правила Firestore (см. подсказку ниже)");
        document.getElementById("firestoreHint")?.style.setProperty("display", "block");
      } else {
        setStatus("❌ " + err.message);
      }
    }
  );
}

function setStatus(text) {
  const el = document.getElementById("adminStatus");
  if (el) el.textContent = text;
}

// =========================
// Фильтрация
// =========================
function getFiltered() {
  return allOrders.filter((o) => {
    if (currentFilter !== "all" && o.status !== currentFilter) return false;
    if (!currentSearch) return true;
    const s = currentSearch.toLowerCase();
    return (
      (o.id    || "").toLowerCase().includes(s) ||
      (o.name  || "").toLowerCase().includes(s) ||
      (o.phone || "").toLowerCase().includes(s) ||
      (o.area  || "").toLowerCase().includes(s)
    );
  });
}

// =========================
// Статистика
// =========================
function renderStats() {
  const counts = { all: allOrders.length, pending: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0 };
  let revenue = 0;
  allOrders.forEach((o) => {
    if (o.status in counts) counts[o.status]++;
    if (o.status === "done") revenue += Number(o.price) || 0;
  });

  document.querySelectorAll(".btn--filter[data-status]").forEach((btn) => {
    const fc = btn.querySelector(".fc");
    if (fc) fc.textContent = counts[btn.dataset.status] ?? 0;
  });

  const el = document.getElementById("adminStats");
  if (el) {
    el.innerHTML =
      `<span>Всего: <b>${counts.all}</b></span>` +
      `<span>Ожидают: <b>${counts.pending}</b></span>` +
      `<span>В процессе: <b>${counts.in_progress}</b></span>` +
      `<span>Завершено: <b>${counts.done}</b></span>` +
      `<span>Выручка: <b>${revenue.toLocaleString("ru")} ₺</b></span>`;
  }
}

// =========================
// Таблица (desktop)
// =========================
function renderTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const rows = getFiltered();
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty-cell">Заказов нет</td></tr>`;
    tbody.onclick = null;
    return;
  }

  tbody.innerHTML = rows.map((o) => `
    <tr data-docid="${o._docId}">
      <td class="mono">${o.id || "—"}</td>
      <td>${esc(o.name)}</td>
      <td><a href="tel:${o.phone||""}" class="tel-link">${esc(o.phone)}</a></td>
      <td>${esc(o.area)}</td>
      <td>${esc(o.type)}</td>
      <td class="nowrap">${o.areaSize ? o.areaSize + " м²" : "—"}</td>
      <td class="nowrap">${o.date||"—"} ${o.time||""}</td>
      <td class="nowrap">${o.price ? o.price + " ₺" : "—"}</td>
      <td class="nowrap">${o.createdAtLocal ? fmtDate(o.createdAtLocal) : "—"}</td>
      <td class="comment-cell">${esc(o.comment)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>
        <div class="act-row">
          <button class="act-btn act-confirm" data-action="confirm" title="Подтвердить">✔</button>
          <button class="act-btn act-start"   data-action="start"   title="В процессе">▶</button>
          <button class="act-btn act-done"    data-action="done"    title="Завершить">✓</button>
          <button class="act-btn act-cancel"  data-action="cancel"  title="Отменить">✕</button>
          <button class="act-btn act-delete"  data-action="delete"  title="Удалить">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const docId = btn.closest("tr[data-docid]")?.dataset.docid;
    const order = allOrders.find(o => o._docId === docId);
    if (order) handleAction(order, btn.dataset.action);
  };
}

// =========================
// Карточки (mobile)
// =========================
function renderCards() {
  const list = document.getElementById("ordersCardList");
  if (!list) return;

  const rows = getFiltered();
  if (!rows.length) {
    list.innerHTML = `<div class="empty-cell">Заказов нет</div>`;
    list.onclick = null;
    return;
  }

  list.innerHTML = rows.map((o) => `
    <div class="admin-card" data-docid="${o._docId}">
      <div class="admin-card__header">
        <span class="admin-card__id">${o.id||"—"}</span>
        ${statusBadge(o.status)}
      </div>
      <div class="admin-card__row"><span class="lbl">Имя</span><span>${esc(o.name)}</span></div>
      <div class="admin-card__row"><span class="lbl">Телефон</span><a href="tel:${o.phone||""}" class="tel-link">${esc(o.phone)}</a></div>
      <div class="admin-card__row"><span class="lbl">Район</span><span>${esc(o.area)}</span></div>
      <div class="admin-card__row"><span class="lbl">Тип</span><span>${esc(o.type)}</span></div>
      <div class="admin-card__row"><span class="lbl">Площадь</span><span>${o.areaSize ? o.areaSize+" м²" : "—"}</span></div>
      <div class="admin-card__row"><span class="lbl">Дата</span><span>${o.date||"—"} ${o.time||""}</span></div>
      <div class="admin-card__row"><span class="lbl">Цена</span><span>${o.price ? o.price+" ₺" : "—"}</span></div>
      ${o.comment ? `<div class="admin-card__row"><span class="lbl">Коммент.</span><span>${esc(o.comment)}</span></div>` : ""}
      <div class="admin-card__actions">
        <button class="act-btn act-confirm" data-action="confirm">Подтв.</button>
        <button class="act-btn act-start"   data-action="start">Старт</button>
        <button class="act-btn act-done"    data-action="done">Готово</button>
        <button class="act-btn act-cancel"  data-action="cancel">Отмена</button>
        <button class="act-btn act-delete"  data-action="delete">Удалить</button>
      </div>
    </div>
  `).join("");

  list.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const docId = btn.closest("[data-docid]")?.dataset.docid;
    const order = allOrders.find(o => o._docId === docId);
    if (order) handleAction(order, btn.dataset.action);
  };
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
  // Используем _docId (настоящий Firestore doc ID), не order.id (ST-XXXX)
  const ref = doc(db, "orders", order._docId);
  const statusMap = { confirm: "confirmed", start: "in_progress", done: "done", cancel: "cancelled" };

  try {
    if (action === "delete") {
      if (!confirm(`Удалить заказ ${order.id}?`)) return;
      await deleteDoc(ref);
    } else if (statusMap[action]) {
      await updateDoc(ref, { status: statusMap[action] });
      // onSnapshot автоматически обновит UI — дополнительный вызов не нужен
    }
  } catch (err) {
    console.error("handleAction:", err);
    if (err.code === "permission-denied") {
      alert(
        "❌ Firestore не разрешает запись.\n\n" +
        "Откройте Firebase Console → Firestore → Правила\n" +
        "и установите правила разработки:\n\n" +
        "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{db}/documents {\n    match /{doc=**} {\n      allow read, write: if true;\n    }\n  }\n}"
      );
    } else {
      alert("Ошибка: " + err.message);
    }
  }
}

// =========================
// Экспорт CSV
// =========================
function exportCSV() {
  const rows = getFiltered();
  if (!rows.length) { alert("Нет данных для экспорта"); return; }

  const SEP = ";";
  const header = ["ID","Имя","Телефон","Район","Тип","Площадь м²","Дата","Время","Цена ₺","Комментарий","Статус","Создан"];
  const lines  = rows.map(o => [
    o.id||"", o.name||"", o.phone||"", o.area||"", o.type||"",
    o.areaSize||"", o.date||"", o.time||"", o.price||"",
    (o.comment||"").replace(/[\r\n;]/g, " "),
    mapStatusToLabel(o.status),
    o.createdAtLocal ? fmtDate(o.createdAtLocal) : ""
  ].join(SEP));

  const csv  = "\uFEFF" + [header.join(SEP), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: `orders_${new Date().toISOString().slice(0,10)}.csv` });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =========================
// Вспомогательные
// =========================
function esc(s) {
  if (!s) return "—";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// =========================
// Инициализация
// =========================
function initFilters() {
  document.querySelectorAll(".btn--filter[data-status]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn--filter[data-status]").forEach(b => b.classList.remove("btn--active"));
      btn.classList.add("btn--active");
      currentFilter = btn.dataset.status;
      renderTable();
      renderCards();
    });
  });

  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    renderTable();
    renderCards();
  });

  document.getElementById("refreshBtn")?.addEventListener("click", subscribeOrders);

  document.getElementById("exportBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    exportCSV();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  initFilters();
  subscribeOrders();
});
