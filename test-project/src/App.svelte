<script lang="ts">
  import { Router, Route, Link, navigate } from 'svelte-routing';
  import AccountList from './components/AccountList.svelte';
  import AccountForm from './components/AccountForm.svelte';
  import Login from './components/Login.svelte';
  import Register from './components/Register.svelte';
  import { getAccounts, addAccount, deleteAccount } from './services/api.ts';

  console.log('App.svelte loaded');

  let accounts: { id: number; serviceName: string; login: string; password: string; description?: string }[] = [];
  let isAuthenticated = !!localStorage.getItem('token');

  async function loadAccounts() {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      accounts = await getAccounts();
    } catch (error) {
      console.error('Failed to load accounts:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        isAuthenticated = false;
        navigate('/login');
      }
    }
  }

  async function handleAddAccount(event: CustomEvent<{ serviceName: string; login: string; password: string; description?: string }>) {
    try {
      const newAccount = event.detail;
      await addAccount(newAccount);
      await loadAccounts();
      navigate('/');
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  }

  async function handleDeleteAccount(event: CustomEvent<number>) {
    try {
      const id = event.detail;
      await deleteAccount(id);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    isAuthenticated = false;
    navigate('/login');
  }

  loadAccounts();
</script>

<Router>
  <div class="container">
    {#if isAuthenticated}
      <header>
        <h1>Password Manager</h1>
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