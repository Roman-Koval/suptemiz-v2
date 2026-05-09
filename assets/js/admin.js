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
    case "pending":     return "В ожидании";
    case "confirmed":   return "Подтверждён";
    case "in_progress": return "В процессе";
    case "done":        return "Завершён";
    case "cancelled":   return "Отменён";
    default:            return status || "—";
  }
}

function statusBadge(status) {
  const classMap = {
    pending:     "status-pending",
    confirmed:   "status-confirmed",
    in_progress: "status-in_progress",
    done:        "status-done",
    cancelled:   "status-cancelled",
  };
  const cls = classMap[status] || "";
  return `<span class="status ${cls}">${mapStatusToLabel(status)}</span>`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}

async function loadOrders() {
  try {
    setStatus("Загрузка...");
    // orderBy может упасть если нет индекса — пробуем с сортировкой, fallback без
    let snap;
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      snap = await getDocs(q);
    } catch (e) {
      console.warn("orderBy failed, loading without sort:", e);
      snap = await getDocs(collection(db, "orders"));
    }

    // docId — это Firestore document ID; customId — поле id внутри документа (ST-XXXX)
    allOrders = snap.docs.map((d) => ({
      docId: d.id,           // Firestore document ID для updateDoc/deleteDoc
      ...d.data()
    }));

    setStatus(`Заказов: ${allOrders.length}`);
    render();
  } catch (e) {
    console.error("loadOrders error:", e);
    setStatus("Ошибка загрузки: " + e.message);
  }
}

function setStatus(msg) {
  const el = document.getElementById("adminStatus");
  if (el) el.textContent = msg;
}

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

function actionButtons(isCard = false) {
  if (isCard) {
    return `
      <button class="btn btn--sm btn--confirm" data-action="confirm">✔ Подтв.</button>
      <button class="btn btn--sm btn--start"   data-action="start">▶ Старт</button>
      <button class="btn btn--sm btn--done"    data-action="done">✓ Готово</button>
      <button class="btn btn--sm btn--cancel"  data-action="cancel">✕ Отмена</button>
      <button class="btn btn--sm btn--delete"  data-action="delete">🗑 Удалить</button>
    `;
  }
  return `
    <button class="btn btn--sm btn--confirm" data-action="confirm" title="Подтвердить">✔</button>
    <button class="btn btn--sm btn--start"   data-action="start"   title="В работу">▶</button>
    <button class="btn btn--sm btn--done"    data-action="done"    title="Завершить">✓</button>
    <button class="btn btn--sm btn--cancel"  data-action="cancel"  title="Отменить">✕</button>
    <button class="btn btn--sm btn--delete"  data-action="delete"  title="Удалить">🗑</button>
  `;
}

function bindActions(el, order) {
  el.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(order, btn.dataset.action));
  });
}

function renderTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtered = getFilteredOrders();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="admin-empty">Заказов нет</td></tr>`;
    return;
  }

  filtered.forEach((o) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${o.id || o.docId}</td>
      <td>${o.name || "—"}</td>
      <td>${o.phone || "—"}</td>
      <td>${o.area || "—"}</td>
      <td>${o.type || "—"}</td>
      <td>${o.areaSize || "—"}</td>
      <td>${o.date || "—"} ${o.time || ""}</td>
      <td>${o.price || "—"} ₺</td>
      <td>${o.createdAtLocal ? formatDateTime(o.createdAtLocal) : "—"}</td>
      <td>${o.comment || "—"}</td>
      <td>${statusBadge(o.status)}</td>
      <td class="admin-actions">${actionButtons(false)}</td>
    `;
    bindActions(tr, o);
    tbody.appendChild(tr);
  });
}

function renderCards() {
  const list = document.getElementById("ordersCardList");
  if (!list) return;
  list.innerHTML = "";

  const filtered = getFilteredOrders();

  if (filtered.length === 0) {
    list.innerHTML = `<div class="admin-empty" style="padding:16px;text-align:center;">Заказов нет</div>`;
    return;
  }

  filtered.forEach((o) => {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card__row">
        <span class="admin-card__label">ID</span>
        <span class="admin-card__value">${o.id || o.docId}</span>
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
        <span class="admin-card__value">${o.areaSize || "—"} м²</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Дата/время</span>
        <span class="admin-card__value">${o.date || "—"} ${o.time || ""}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Цена</span>
        <span class="admin-card__value">${o.price || "—"} ₺</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Статус</span>
        <span class="admin-card__value">${statusBadge(o.status)}</span>
      </div>
      <div class="admin-card__row">
        <span class="admin-card__label">Комментарий</span>
        <span class="admin-card__value">${o.comment || "—"}</span>
      </div>
      <div class="admin-card__actions">${actionButtons(true)}</div>
    `;
    bindActions(card, o);
    list.appendChild(card);
  });
}

function render() {
  renderTable();
  renderCards();
}

async function handleAction(order, action) {
  // Используем docId (Firestore document ID) для операций с БД
  const docId = order.docId;
  if (!docId) {
    alert("Ошибка: не найден ID документа");
    return;
  }

  const ref = doc(db, "orders", docId);

  try {
    if (action === "delete") {
      if (!confirm(`Удалить заказ ${order.id || docId}?`)) return;
      await deleteDoc(ref);
    } else {
      const statusMap = {
        confirm: "confirmed",
        start:   "in_progress",
        done:    "done",
        cancel:  "cancelled"
      };
      const newStatus = statusMap[action];
      if (!newStatus) return;
      await updateDoc(ref, { status: newStatus });
      // Обновляем локально для мгновенного отклика
      order.status = newStatus;
    }
    await loadOrders();
  } catch (e) {
    console.error("handleAction error:", e);
    alert("Ошибка: " + e.message);
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
    exportBtn.addEventListener("click", () => {
      const rows = getFilteredOrders();
      const header = [
        "ID", "Имя", "Телефон", "Район", "Тип", "Площадь",
        "Дата", "Время", "Цена", "Комментарий", "Статус"
      ];
      const csv = [
        "\uFEFF" + header.join(";"),
        ...rows.map((o) =>
          [
            o.id || o.docId,
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
      a.download = "orders.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
