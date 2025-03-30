<script lang="ts">
    import { navigate } from 'svelte-routing';
    import { register } from '../services/api.ts';
  
    let username = '';
    let password = '';
    let email = '';
    let message = '';
  
    async function handleSubmit() {
      try {
        const response = await register(username, password, email);
        message = response;
        setTimeout(() => navigate('/login'), 2000);
      } catch (err: any) {
        message = err.response?.data || 'Ошибка регистрации';
      }
    }
  </script>
  
  <div>
    <h2>Регистрация</h2>
    {#if message}
      <p class={message.includes('Ошибка') ? 'error' : 'success'}>{message}</p>
    {/if}
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="username">Имя пользователя:</label>
        <input id="username" type="text" bind:value={username} required />
      </div>
      <div class="form-group">
        <label for="email">Email:</label>
        <input id="email" type="email" bind:value={email} required />
      </div>
      <div class="form-group">
        <label for="password">Пароль:</label>
        <input id="password" type="password" bind:value={password} required />
      </div>
      <button type="submit">Зарегистрироваться</button>
    </form>
    <p>Уже есть аккаунт? <a href="/login">Войди</a></p>
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
    .success {
      color: green;
    }
  </style>