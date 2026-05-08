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

function renderOrders(snapshot) {
  if (snapshot.empty) {
    renderEmpty();
    return;
  }

  const rows = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    rows.push(`
      <tr data-id="${docSnap.id}">
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
            <button class="btn btn--ghost admin-status" data-id="${docSnap.id}" data-status="confirmed">Подтвердить</button>
            <button class="btn btn--ghost admin-status" data-id="${docSnap.id}" data-status="in_progress">В работу</button>
            <button class="btn btn--ghost admin-status" data-id="${docSnap.id}" data-status="done">Завершить</button>
            <button class="btn btn--ghost admin-status" data-id="${docSnap.id}" data-status="cancelled">Отменить</button>
            <button class="btn btn--ghost admin-delete" data-id="${docSnap.id}">Удалить</button>
          </div>
        </td>
      </tr>
    `);
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
      renderOrders(snapshot);
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
  renderOrders(snap);
}

document.addEventListener("DOMContentLoaded", () => {
  setStatus("Подключение к Firebase...");
  initFirebase();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", manualRefresh);
  }
});
