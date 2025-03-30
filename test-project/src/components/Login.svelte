<script lang="ts">
    import { navigate } from 'svelte-routing';
    import { login } from '../services/api';
  
    let username = '';
    let password = '';
    let error = '';
  
    async function handleSubmit() {
      try {
        await login(username, password); // Передаём username и password напрямую
        navigate('/');
      } catch (err: any) {
        error = err.response?.data?.message || 'Ошибка входа';
      }
    }
  </script>
  
  <div>
    <h2>Вход</h2>
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="username">Имя пользователя:</label>
        <input id="username" type="text" bind:value={username} required />
      </div>
      <div class="form-group">
        <label for="password">Пароль:</label>
        <input id="password" type="password" bind:value={password} required />
      </div>
      <button type="submit">Войти</button>
    </form>
    <p>Нет аккаунта? <a href="/register">Зарегистрируйся</a></p>
  </div>
  
  <style>
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
    }
    input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    button {
      background-color: #ff3e00;
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: #e03600;
    }
    .error {
      color: red;
    }
  </style>