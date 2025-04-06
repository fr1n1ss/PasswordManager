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
    masterPassword = ''; // Сбрасываем мастер-пароль
    accounts = []; // Очищаем аккаунты
    navigate('/login');
  }

  function handleMasterPasswordSubmit(event: CustomEvent<string>) {
    masterPassword = event.detail;
    loadAccounts();
  }

  function handleMasterPasswordCancel() {
    showMasterPasswordModal = false;
    navigate('/'); // Или перенаправь куда-то ещё
  }
</script>

<Router>
  <div class="container">
    {#if isAuthenticated}
      {#if showMasterPasswordModal}
        <MasterPasswordModal on:submit={handleMasterPasswordSubmit} on:cancel={handleMasterPasswordCancel} />
      {/if}
      <header>
        <h1>Password Manager</h1>
        {#if error}
          <p style="color: red;">{error}</p>
        {/if}
        <nav>
          <Link to="/">Список аккаунтов</Link>
          <Link to="/add-account">Добавить аккаунт</Link>
          <button on:click={handleLogout}>Выйти</button>
        </nav>
      </header>
      <main>
        <Route path="/add-account">
          <AccountForm on:submit={handleAddAccount} />
        </Route>
        <Route path="/">
          <AccountList {accounts} on:delete={handleDeleteAccount} />
        </Route>
      </main>
    {:else}
      <main>
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
  .container {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }
  header {
    text-align: center;
    margin-bottom: 20px;
  }
  nav {
    display: flex;
    gap: 15px;
    justify-content: center;
  }
  nav a {
    color: #ff3e00;
    text-decoration: none;
    font-weight: bold;
  }
  nav a:hover {
    text-decoration: underline;
  }
  nav button {
    background-color: #ff3e00;
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  nav button:hover {
    background-color: #e03600;
  }
  main {
    border: 1px solid #ccc;
    padding: 20px;
    border-radius: 5px;
  }
</style>