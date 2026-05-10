<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Админка заказов — SupTemiz</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="assets/css/admin.css" />
</head>
<body>

<!-- ========================= -->
<!-- Экран входа               -->
<!-- ========================= -->
<div id="loginScreen" class="login-screen">
  <div class="login-card">
    <div class="login-logo">
      <span class="logo__mark">Sup</span><span class="logo__text">Temiz</span>
    </div>
    <h2 class="login-title">Вход в админку</h2>

    <div id="loginError" class="login-error" style="display:none;"></div>

    <div class="form__field">
      <label for="loginEmail">Email</label>
      <input type="email" id="loginEmail" placeholder="admin@example.com" autocomplete="username" />
    </div>

    <div class="form__field">
      <label for="loginPassword">Пароль</label>
      <input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password" />
    </div>

    <button id="loginBtn" class="btn btn--primary btn--full">Войти</button>
  </div>
</div>

<!-- ========================= -->
<!-- Основной интерфейс        -->
<!-- ========================= -->
<div id="adminScreen" class="admin-container" style="display:none;">
  <div class="admin-header">
    <div class="admin-header__left">
      <div class="login-logo login-logo--small">
        <span class="logo__mark">Sup</span><span class="logo__text">Temiz</span>
      </div>
      <h1>Управление заказами</h1>
    </div>
    <div class="admin-header__right">
      <a href="index.html" class="admin-back-link">← На сайт</a>
      <button id="logoutBtn" class="btn btn--ghost-sm">Выйти</button>
    </div>
  </div>

  <div id="errorMessage" class="admin-error" style="display:none;"></div>

  <div id="loadingIndicator" class="admin-loading" style="display:none;">
    <span class="admin-loading__spinner"></span>
    <span>Загрузка заказов…</span>
  </div>

  <div class="admin-controls">
    <div class="admin-filters">
      <button data-status="all"         class="btn btn--filter btn--active">Все</button>
      <button data-status="pending"     class="btn btn--filter">В ожидании</button>
      <button data-status="confirmed"   class="btn btn--filter">Подтверждён</button>
      <button data-status="in_progress" class="btn btn--filter">В процессе</button>
      <button data-status="done"        class="btn btn--filter">Завершён</button>
      <button data-status="cancelled"   class="btn btn--filter">Отменён</button>
    </div>
    <div class="admin-actions">
      <input type="text" id="searchInput" placeholder="Имя, телефон, ID…" />
      <button id="refreshBtn" class="btn btn--secondary">Обновить</button>
      <button id="exportBtn"  class="btn btn--secondary">CSV</button>
    </div>
  </div>

  <div class="admin-meta">
    <span id="ordersCount"></span>
    <span id="adminUser" class="admin-user"></span>
  </div>

  <div class="admin-table-wrapper">
    <table class="admin-table">
      <thead>
        <tr>
          <th>ID</th><th>Имя</th><th>Телефон</th><th>Район</th>
          <th>Тип</th><th>Площадь</th><th>Дата/время</th>
          <th>Цена</th><th>Создано</th><th>Комментарий</th>
          <th>Статус</th><th>Действия</th>
        </tr>
      </thead>
      <tbody id="ordersTableBody"></tbody>
    </table>
  </div>

  <div class="admin-card-list" id="ordersCardList"></div>
</div>

<script type="module" src="assets/js/admin.js"></script>
</body>
</html>
