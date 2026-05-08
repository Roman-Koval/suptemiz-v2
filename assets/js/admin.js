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
  tbody.innerHTML = `<tr><td colspan="11" class="admin-empty">Нет данных</td></tr>`;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
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
          <button class="btn btn--ghost admin-delete" data-id="${docSnap.id}">Удалить</button>
        </td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join("");

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
