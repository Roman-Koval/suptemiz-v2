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
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =========================
// Инициализация
// =========================
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

let allOrders          = [];
let currentStatusFilter = "all";
let currentSearch       = "";

// =========================
// UI — показать/скрыть экраны
// =========================
function showLogin() {
  document.getElementById("loginScreen").style.display  = "flex";
  document.getElementById("adminScreen").style.display  = "none";
}

function showAdmin(user) {
  document.getElementById("loginScreen").style.display  = "none";
  document.getElementById("adminScreen").style.display  = "block";
  const el = document.getElementById("adminUser");
  if (el) el.textContent = user.email;
  loadOrders();
}

// =========================
// Аутентификация
// =========================
function initAuth() {
  // Слушаем изменение состояния авторизации
  onAuthStateChanged(auth, (user) => {
    if (user) {
      showAdmin(user);
    } else {
      showLogin();
    }
  });

  // Кнопка «Войти»
  const loginBtn = document.getElementById("loginBtn");
  const emailEl  = document.getElementById("loginEmail");
  const passEl   = document.getElementById("loginPassword");
  const errEl    = document.getElementById("loginError");

  async function doLogin() {
    const email    = emailEl.value.trim();
    const password = passEl.value;
    errEl.style.display = "none";

    if (!email || !password) {
      errEl.textContent   = "Введите email и пароль.";
      errEl.style.display = "block";
      return;
    }

    loginBtn.disabled    = true;
    loginBtn.textContent = "Вход…";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged вызовется автоматически
    } catch (e) {
      errEl.textContent   = friendlyAuthError(e.code);
      errEl.style.display = "block";
    } finally {
      loginBtn.disabled    = false;
      loginBtn.textContent = "Войти";
    }
  }

  loginBtn.addEventListener("click", doLogin);

  // Enter в полях формы
  [emailEl, passEl].forEach((el) =>
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); })
  );

  // Кнопка «Выйти»
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
  });
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/invalid-email":           return "Неверный формат email.";
    case "auth/user-not-found":          return "Пользователь не найден.";
    case "auth/wrong-password":          return "Неверный пароль.";
    case "auth/invalid-credential":      return "Неверный email или пароль.";
    case "auth/too-many-requests":       return "Слишком много попыток. Попробуйте позже.";
    case "auth/network-request-failed":  return "Ошибка сети. Проверьте подключение.";
    default:                             return `Ошибка входа (${code}).`;
  }
}

// =========================
// Загрузка заказов
// =========================
function setLoading(v) {
  const el = document.getElementById("loadingIndicator");
  if (el) el.style.display = v ? "flex" : "none";
}
function showError(msg) {
  const el = document.getElementById("errorMessage");
  if (!el) return;
  el.innerHTML = `
    <strong>⚠️ Нет прав доступа к Firestore.</strong>
    Откройте <a href="https://console.firebase.google.com" target="_blank">Firebase Console</a>
    → Firestore Database → Правила и установите (только для разработки!):
    <pre>rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}</pre>
    <p>Для продакшна — добавьте аутентификацию и ограничьте доступ.</p>
    <p>✕ ${msg}</p>
  `;
  el.style.display = "block";
}
function hideError() {
  const el = document.getElementById("errorMessage");
  if (el) el.style.display = "none";
}

async function loadOrders() {
  setLoading(true);
  hideError();
  try {
    const q    = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allOrders  = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
    render();
  } catch (err) {
    console.error(err);
    showError("Нет прав. Проверьте правила Firestore (см. подсказку ниже)");
  } finally {
    setLoading(false);
  }
}

// =========================
// Фильтрация
// =========================
function getFiltered() {
  return allOrders.filter((o) => {
    if (currentStatusFilter !== "all" && o.status !== currentStatusFilter) return false;
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
// Рендер
// =========================
function mapStatus(s) {
  return { pending:"В ожидании", confirmed:"Подтверждён", in_progress:"В процессе", done:"Завершён", cancelled:"Отменён" }[s] || s || "—";
}
function mapType(t) {
  return { standard:"Стандартная", deep:"Генеральная", office:"Офис" }[t] || t || "—";
}
function statusCls(s) {
  return { pending:"status--pending", confirmed:"status--confirmed", in_progress:"status--in-progress", done:"status--done", cancelled:"status--cancelled" }[s] || "";
}
function esc(str, max = 0) {
  if (!str) return "—";
  const s = String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  return max && s.length > max ? s.slice(0, max) + "…" : s;
}
function fmtDt(iso) {
  try { return iso ? new Date(iso).toLocaleString("ru-RU") : "—"; } catch { return "—"; }
}

function renderTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  const rows = getFiltered();
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:2rem;color:#6b7280;">Заказов не найдено</td></tr>`;
    return;
  }
  rows.forEach((o) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td title="${esc(o.id)}">${esc(o.id)}</td>
      <td>${esc(o.name)}</td>
      <td>${esc(o.phone)}</td>
      <td>${esc(o.area)}</td>
      <td>${mapType(o.type)}</td>
      <td>${o.areaSize || "—"}</td>
      <td>${esc(o.date)} ${esc(o.time)}</td>
      <td>${o.price ? o.price + " ₺" : "—"}</td>
      <td>${fmtDt(o.createdAtLocal)}</td>
      <td title="${esc(o.comment)}">${esc(o.comment, 40)}</td>
      <td><span class="status-badge ${statusCls(o.status)}">${mapStatus(o.status)}</span></td>
      <td class="actions-cell">
        <button class="btn-action btn-action--confirm"  data-action="confirm"  title="Подтвердить">✔</button>
        <button class="btn-action btn-action--start"    data-action="start"    title="В процессе">▶</button>
        <button class="btn-action btn-action--done"     data-action="done"     title="Завершить">✓</button>
        <button class="btn-action btn-action--cancel"   data-action="cancel"   title="Отменить">✕</button>
        <button class="btn-action btn-action--delete"   data-action="delete"   title="Удалить">🗑</button>
      </td>`;
    tr.querySelectorAll("[data-action]").forEach((btn) =>
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action))
    );
    tbody.appendChild(tr);
  });
}

function renderCards() {
  const list = document.getElementById("ordersCardList");
  if (!list) return;
  const rows = getFiltered();
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = `<p style="text-align:center;padding:2rem;color:#6b7280;">Заказов не найдено</p>`;
    return;
  }
  rows.forEach((o) => {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card__header">
        <span class="admin-card__id">${esc(o.id)}</span>
        <span class="status-badge ${statusCls(o.status)}">${mapStatus(o.status)}</span>
      </div>
      <div class="admin-card__row"><span class="admin-card__label">Имя</span><span>${esc(o.name)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Телефон</span><span>${esc(o.phone)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Район</span><span>${esc(o.area)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Тип</span><span>${mapType(o.type)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Площадь</span><span>${o.areaSize ? o.areaSize + " м²" : "—"}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Дата/время</span><span>${esc(o.date)} ${esc(o.time)}</span></div>
      <div class="admin-card__row"><span class="admin-card__label">Цена</span><span>${o.price ? o.price + " ₺" : "—"}</span></div>
      ${o.comment ? `<div class="admin-card__row"><span class="admin-card__label">Комментарий</span><span>${esc(o.comment)}</span></div>` : ""}
      <div class="admin-card__actions">
        <button class="btn-action btn-action--confirm"  data-action="confirm">Подтвердить</button>
        <button class="btn-action btn-action--start"    data-action="start">В процессе</button>
        <button class="btn-action btn-action--done"     data-action="done">Завершить</button>
        <button class="btn-action btn-action--cancel"   data-action="cancel">Отменить</button>
        <button class="btn-action btn-action--delete"   data-action="delete">Удалить</button>
      </div>`;
    card.querySelectorAll("[data-action]").forEach((btn) =>
      btn.addEventListener("click", () => handleAction(o, btn.dataset.action))
    );
    list.appendChild(card);
  });
}

function render() {
  renderTable();
  renderCards();
  const el = document.getElementById("ordersCount");
  if (el) {
    const f = getFiltered().length, t = allOrders.length;
    el.textContent = (currentStatusFilter === "all" && !currentSearch)
      ? `Всего: ${t}` : `Показано: ${f} из ${t}`;
  }
}

// =========================
// Действия над заказом
// =========================
async function handleAction(order, action) {
  const ref = doc(db, "orders", order._docId);
  try {
    if (action === "delete") {
      if (!confirm(`Удалить заказ ${order.id}?`)) return;
      await deleteDoc(ref);
    } else {
      const map = { confirm:"confirmed", start:"in_progress", done:"done", cancel:"cancelled" };
      const ns  = map[action];
      if (!ns) return;
      await updateDoc(ref, { status: ns });
    }
    await loadOrders();
  } catch (err) {
    console.error(err);
    alert("Ошибка. Проверьте права Firestore.");
  }
}

// =========================
// Фильтры и поиск
// =========================
function initFilters() {
  document.querySelectorAll(".btn--filter").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn--filter").forEach((b) => b.classList.remove("btn--active"));
      btn.classList.add("btn--active");
      currentStatusFilter = btn.dataset.status;
      render();
    })
  );
  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    render();
  });
  document.getElementById("refreshBtn")?.addEventListener("click", loadOrders);
  document.getElementById("exportBtn")?.addEventListener("click",  exportCSV);
}

// =========================
// Экспорт CSV
// =========================
function exportCSV() {
  const rows = getFiltered();
  if (!rows.length) { alert("Нет данных для экспорта."); return; }

  const hdr     = ["ID","Имя","Телефон","Район","Тип","Площадь (м²)","Дата","Время","Цена (₺)","Комментарий","Статус","Создано"];
  const cell    = (v) => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const phone   = (v) => `"'${String(v ?? "").replace(/"/g,'""')}"`;

  const csv = [
    hdr.map(cell).join(";"),
    ...rows.map((o) => [
      cell(o.id), cell(o.name), phone(o.phone), cell(o.area),
      cell(mapType(o.type)), cell(o.areaSize), cell(o.date), cell(o.time),
      cell(o.price), cell((o.comment||"").replace(/[\n\r;]/g," ")),
      cell(mapStatus(o.status)), cell(o.createdAtLocal ? fmtDt(o.createdAtLocal) : "")
    ].join(";"))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
  const a    = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `orders_${new Date().toISOString().split("T")[0]}.csv`
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// =========================
// Старт
// =========================
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initFilters();
});
