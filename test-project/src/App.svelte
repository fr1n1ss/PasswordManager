<script lang="ts">
  import { Router, Route, Link, navigate } from 'svelte-routing';
  import AccountList from './components/AccountList.svelte';
  import AccountForm from './components/AccountForm.svelte';
  import Login from './components/Login.svelte';
  import Register from './components/Register.svelte';
  import MasterPasswordModal from './components/MasterPasswordModal.svelte';
  import { getAccounts, addAccount, deleteAccount } from './services/api';
  import { onMount } from 'svelte';

  console.log('App.svelte loaded');

  let accounts: { id: number; serviceName: string; login: string; password: string; description?: string }[] = [];
  let isAuthenticated = !!localStorage.getItem('token');
  let masterPassword = '';
  let error: string | null = null;
  let showMasterPasswordModal = false;
  let searchQuery = '';
  let sortOption = 'от А до Я';

  onMount(() => {
    if (isAuthenticated) {
      showMasterPasswordModal = true;
    }
  });

  async function loadAccounts() {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!masterPassword) {
      error = 'Мастер-пароль не введён';
      return;
    }
    try {
      const data = await getAccounts(masterPassword);
      accounts = data.map((account: any) => ({
        id: account.id,
        serviceName: account.serviceName,
        login: account.login,
        password: account.encryptedPassword,
        description: account.description
      }));
      showMasterPasswordModal = false;
    } catch (error) {
      console.error('Failed to load accounts:', error);
      error = 'Не удалось загрузить аккаунты. Проверьте мастер-пароль.';
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        isAuthenticated = false;
        navigate('/login');
      }
    }
  }

  async function handleAddAccount(event: CustomEvent<{ serviceName: string; login: string; password: string; description?: string }>) {
    if (!masterPassword) {
      error = 'Мастер-пароль не введён';
      showMasterPasswordModal = true;
      return;
    }
    try {
      const newAccount = { ...event.detail, masterPassword };
      await addAccount(newAccount);
      await loadAccounts();
      navigate('/');
    } catch (error) {
      console.error('Failed to add account:', error);
      error = 'Не удалось добавить аккаунт';
    }
  }

  async function handleDeleteAccount(event: CustomEvent<number>) {
    if (!masterPassword) {
      error = 'Мастер-пароль не введён';
      showMasterPasswordModal = true;
      return;
    }
    try {
      const id = event.detail;
      await deleteAccount(id, masterPassword);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      error = 'Не удалось удалить аккаунт';
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    isAuthenticated = false;
    masterPassword = '';
    accounts = [];
    navigate('/login');
  }

  function handleMasterPasswordSubmit(event: CustomEvent<string>) {
    console.log('Master password submitted:', event.detail);
    masterPassword = event.detail;
    loadAccounts();
  }

  function handleMasterPasswordCancel() {
    showMasterPasswordModal = false;
    navigate('/');
  }

  function handleSearch() {
    if (searchQuery) {
      accounts = accounts.filter(account =>
        account.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.login.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      loadAccounts();
    }
  }

  function handleSort() {
    if (sortOption === 'от А до Я') {
      accounts = [...accounts].sort((a, b) => a.serviceName.localeCompare(b.serviceName));
    } else {
      accounts = [...accounts].sort((a, b) => b.serviceName.localeCompare(a.serviceName));
    }
  }
</script>

<Router>
  <div class="app">
    {#if isAuthenticated}
      {#if showMasterPasswordModal}
        <MasterPasswordModal on:submit={handleMasterPasswordSubmit} on:cancel={handleMasterPasswordCancel} />
      {/if}
      <!-- Боковая панель -->
      <aside class="sidebar">
        <div class="logo">
          <span class="lock-icon">🔒</span>
          <h1>Менеджер паролей</h1>
        </div>
        <nav>
          <ul>
            <li><Link to="/">Скрыть</Link></li>
            <li><Link to="/">Все элементы</Link></li>
            <li><Link to="/">Избранное</Link></li>
            <li><Link to="/">Пароли</Link></li>
            <li><Link to="/">Заметки</Link></li>
          </ul>
        </nav>
      </aside>

      <!-- Основной контент -->
      <main class="main-content">
        <!-- Профиль -->
        <header class="header">
          <div class="profile">
            <span class="avatar">👤</span>
            <span class="username">username</span>
            <button class="logout" on:click={handleLogout}>Выйти</button>
          </div>
        </header>

        <!-- Поиск и сортировка -->
        <div class="search-filter">
          <div class="search">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Быстрый поиск..." bind:value={searchQuery} on:input={handleSearch} />
          </div>
          <div class="sort">
            <label for="sort-select">Сортировка:</label>
            <select id="sort-select" bind:value={sortOption} on:change={handleSort}>
              <option value="от А до Я">от А до Я</option>
              <option value="от Я до А">от Я до А</option>
            </select>
          </div>
        </div>

        <!-- Ошибка -->
        {#if error}
          <div class="error-container">
            <p class="error">{error}</p>
          </div>
        {/if}

        <!-- Маршруты -->
        <Route path="/add-account">
          <AccountForm on:submit={handleAddAccount} />
        </Route>
        <Route path="/">
          <AccountList {accounts} on:delete={handleDeleteAccount} />
        </Route>
      </main>

      <!-- Кнопка добавления -->
      <button class="add-button" on:click={() => navigate('/add-account')}>
        +
      </button>
    {:else}
      <main class="auth-content">
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/register">
          <Register />
        </Route>
        <Route path="/*">
          <Login />
        </Route>
      </main>
    {/if}
  </div>
</Router>

<style>
  :root {
    --background-primary: #1F252A;
    --background-secondary: #2A3B47;
    --accent: #00A3FF;
    --text-primary: #D3D7DB;
    --text-secondary: #A3A3A3;
    --sidebar-width: 10em;
    --sidebar-left-offset: 20px;
  }

  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    background-color: var(--background-primary);
    box-sizing: border-box;
  }

  :global(*, *:before, *:after) {
    box-sizing: border-box;
  }

  .app {
    display: flex;
    height: 100vh;
    width: 100%;
    background-color: var(--background-primary);
    color: var(--text-primary);
    font-family: 'Arial', sans-serif;
    min-width: 800px; /* Минимальная ширина окна */
    min-height: 600px; /* Минимальная высота окна */
  }

  .sidebar {
    width: var(--sidebar-width);
    background-color: var(--background-secondary);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    position: fixed;
    left: var(--sidebar-left-offset);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .lock-icon {
    font-size: 24px;
  }

  .sidebar h1 {
    font-size: 18px;
    font-weight: bold;
    margin: 0;
  }

  .sidebar nav ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .sidebar nav ul li {
    font-size: 16px;
  }

  .sidebar nav ul li :global(a) {
    color: var(--text-secondary);
    text-decoration: none;
  }

  .sidebar nav ul li :global(a:hover) {
    color: var(--text-primary);
  }

  .main-content {
    margin-left: calc(var(--sidebar-width) + var(--sidebar-left-offset) + 20px); /* Учитываем ширину и отступ боковой панели */
    padding: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: calc(100% - var(--sidebar-width) - var(--sidebar-left-offset) - 20px); /* Растягиваем на оставшуюся ширину */
    overflow-y: auto;
  }

  .header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
    width: 100%;
  }

  .profile {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .avatar {
    font-size: 24px;
    background-color: var(--background-secondary);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .username {
    font-size: 16px;
    color: var(--text-primary);
  }

  .logout {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 14px;
  }

  .logout:hover {
    color: var(--text-primary);
  }

  .search-filter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    gap: 20px;
    width: 100%;
  }

  .search {
    display: flex;
    align-items: center;
    background-color: var(--background-secondary);
    border-radius: 20px;
    padding: 8px 12px;
    width: 300px;
    max-width: 100%;
    flex: 1;
  }

  .search-icon {
    font-size: 16px;
    margin-right: 10px;
    color: var(--text-secondary);
  }

  .search input {
    border: none;
    outline: none;
    font-size: 14px;
    width: 100%;
    background-color: transparent;
    color: var(--text-primary);
  }

  .search input::placeholder {
    color: var(--text-secondary);
  }

  .sort {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sort label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .sort select {
    background-color: var(--background-secondary);
    color: var(--text-primary);
    border: none;
    padding: 8px 12px;
    border-radius: 5px;
    font-size: 14px;
    cursor: pointer;
  }

  .add-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: var(--accent);
    color: #FFFFFF;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: none;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }

  .add-button:hover {
    background-color: #0088CC;
  }

  .auth-content {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--background-primary);
    min-height: 100vh;
    width: 100%;
  }

  .error-container {
    text-align: center;
    margin-bottom: 20px;
    width: 100%;
  }

  .error {
    color: var(--error);
    font-size: 14px;
  }
</style>