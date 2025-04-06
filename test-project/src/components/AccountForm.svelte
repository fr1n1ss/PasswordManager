<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  console.log('AccountForm.svelte loaded');

  let serviceName = '';
  let login = '';
  let password = '';
  let description = '';
  let masterPassword = '';

  function handleSubmit() {
    dispatch('submit', { serviceName, login, password, description, masterPassword });
    serviceName = '';
    login = '';
    password = '';
    description = '';
    masterPassword = '';
  }
</script>

<div>
  <h2>Добавить аккаунт</h2>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <label for="serviceName">Сервис:</label>
      <input id="serviceName" type="text" bind:value={serviceName} required />
    </div>
    <div class="form-group">
      <label for="login">Логин:</label>
      <input id="login" type="text" bind:value={login} required />
    </div>
    <div class="form-group">
      <label for="password">Пароль:</label>
      <input id="password" type="password" bind:value={password} required />
    </div>
    <div class="form-group">
      <label for="description">Описание:</label>
      <input id="description" type="text" bind:value={description} />
    </div>
    <div class="form-group">
      <label for="masterPassword">Мастер-пароль:</label>
      <input id="masterPassword" type="password" bind:value={masterPassword} />
    </div>
    <button type="submit">Добавить</button>
  </form>
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
</style>