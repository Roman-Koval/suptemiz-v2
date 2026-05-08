import { firebaseConfig } from "./firebase-config.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
  doc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let db = null;
let unsub = null;

const statusEl = document.getElementById("adminStatus");
const tbody = document.getElementById("ordersBody");
const refreshBtn = document.getElementById("refreshBtn");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const filterButtons = document.querySelectorAll(".filter-btn");
const newOrderSound = document.getElementById("newOrderSound");

let allOrders = [];
let currentFilter = "all";
let searchQuery = "";
let lastIds = new Set();

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function renderEmpty() {
  tbody.innerHTML = `<tr><td colspan="12" class="admin-empty">Нет данных</td></tr>`;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

function statusLabel(status) {
  const map = {
    pending: "В ожидании",
    confirmed: "Подтверждён",
    in_progress: "В процессе",
    done: "Завершён",
    cancelled: "Отменён"
  };
  return map[status] || status || "—";
}

function statusClass(status) {
  return {
    pending: "status-pending",
    confirmed: "status-confirmed",
    in_progress: "status-in_progress",
    done: "status-done",
    cancelled: "status-cancelled"
  }[status] || "";
}

function applyFilters() {
  let filtered = [...allOrders];

  if (currentFilter !== "all") {
    filtered = filtered.filter((o) => (o.data.status || "pending") === currentFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((o) => {
      const name = (o.data.name || "").toLowerCase();
      const phone = (o.data.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }

  renderOrders(filtered);
}

function renderOrders(list) {
  if (!list.length) {
    renderEmpty();
    return;
  }

  const rows = list.map((o) => {
    const data = o.data;
    return `
      <tr data-id="${o.id}">
        <td>${data.id || ""}</td>
        <td>${data.name || ""}</td>
        <td>${data.phone || ""}</td>
        <td>${data.area || ""}</td>
        <td>${data.type || ""}</td>
        <td>${data.areaSize || ""}</td>
        <td>${data.date || ""} ${data.time || ""}</td>
        <td>${data.price || ""}</td>
        <td>${formatDate(data.createdAt || data.createdAtLocal)}</td>
        <td>${(data.comment || "").replace(/</g, "&lt;")}</td>

        <td>
          <span class="status ${statusClass(data.status)}">
            ${statusLabel(data.status)}
          </span>
        </td>

        <td>
          <div class="admin-actions">
            <button class="btn btn--ghost admin-status" data-id="${o.id}" data-status="confirmed">Подтвердить</button>
            <button class="btn btn--ghost admin-status" data-id="${o.id}" data-status="in_progress">В работу</button>
            <button class="btn btn--ghost admin-status" data-id="${o.id}" data-status="done">Завершить</button>
            <button class="btn btn--ghost admin-status" data-id="${o.id}" data-status="cancelled">Отменить</button>
            <button class="btn btn--ghost admin-delete" data-id="${o.id}">Удалить</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join("");

  // Удаление
  tbody.querySelectorAll(".admin-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!id) return;
      if (!confirm("Удалить заказ?")) return;
      try {
        await deleteDoc(doc(db, "orders", id));
      } catch (e) {
        alert("Ошибка удаления");
        console.warn(e);
      }
    });
  });

  // Изменение статуса
  tbody.querySelectorAll(".admin-status").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const status = btn.getAttribute("data-status");
      if (!id || !status) return;

      try {
        await updateDoc(doc(db, "orders", id), { status });
      } catch (e) {
        alert("Ошибка обновления статуса");
        console.warn(e);
      }
    });
  });
}

function detectNewOrders(snapshot) {
  const newIds = new Set();
  let hasNew = false;

  snapshot.forEach((docSnap) => {
    newIds.add(docSnap.id);
    if (!lastIds.has(docSnap.id)) {
      hasNew = true;
    }
  });

  if (hasNew && newOrderSound) {
    newOrderSound.currentTime = 0;
    newOrderSound.play().catch(() => {});
  }

  lastIds = newIds;
}

async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase init error", e);
    setStatus("Ошибка инициализации Firebase");
    return;
  }

  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

  if (unsub) unsub();
  unsub = onSnapshot(
    q,
    (snapshot) => {
      setStatus(`Всего заказов: ${snapshot.size}`);

      detectNewOrders(snapshot);

      allOrders = [];
      snapshot.forEach((docSnap) => {
        allOrders.push({
          id: docSnap.id,
          data: docSnap.data()
        });
      });

      applyFilters();
    },
    (error) => {
      console.error(error);
      setStatus("Ошибка чтения данных");
    }
  );
}

async function manualRefresh() {
  if (!db) return;
  setStatus("Обновление...");
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  setStatus(`Всего заказов: ${snap.size}`);

  allOrders = [];
  snap.forEach((docSnap) => {
    allOrders.push({
      id: docSnap.id,
      data: docSnap.data()
    });
  });

  applyFilters();
}

function exportToExcel() {
  if (!allOrders.length) {
    alert("Нет данных для экспорта");
    return;
  }

  const header = [
    "ID",
    "Имя",
    "Телефон",
    "Район",
    "Тип",
    "Площадь",
    "Дата",
    "Время",
    "Цена",
    "Создано",
    "Комментарий",
    "Статус"
  ];

  const rows = allOrders.map((o) => {
    const d = o.data;
    return [
      d.id || "",
      d.name || "",
      d.phone || "",
      d.area || "",
      d.type || "",
      d.areaSize || "",
      d.date || "",
      d.time || "",
      d.price || "",
      formatDate(d.createdAt || d.createdAtLocal),
      (d.comment || "").replace(/\n/g, " "),
      statusLabel(d.status)
    ];
  });

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  setStatus("Подключение к Firebase...");
  initFirebase();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", manualRefresh);
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value || "";
      applyFilters();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportToExcel);
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.getAttribute("data-status") || "all";
      filterButtons.forEach((b) => b.classList.remove("btn--primary"));
      btn.classList.add("btn--primary");
      applyFilters();
    });
  });
});
