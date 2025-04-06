<!-- src/components/MasterPasswordModal.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
  
    let masterPassword = '';
    let error: string | null = null;
  
    function handleSubmit() {
      if (!masterPassword) {
        error = 'Введите мастер-пароль';
        return;
      }
      dispatch('submit', masterPassword);
    }
  
    function handleCancel() {
      dispatch('cancel');
    }
  </script>
  
  <div class="modal-overlay">
    <div class="modal">
      <h2>Введите мастер-пароль</h2>
      <p>Чтобы посмотреть сохранённые аккаунты, введите мастер-пароль.</p>
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <input
        type="password"
        bind:value={masterPassword}
        placeholder="Мастер-пароль"
        on:keydown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <div class="buttons">
        <button on:click={handleSubmit}>Подтвердить</button>
        <button on:click={handleCancel}>Отмена</button>
      </div>
    </div>
  </div>
  
  <style>
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal {
      background: rgba(0, 0, 0, 0.5);
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      width: 400px;
      max-width: 90%;
      text-align: center;
    }
    input {
      width: 100%;
      padding: 8px;
      margin: 10px 0;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 15px;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:first-child {
      background-color: #ff3e00;
      color: white;
    }
    button:first-child:hover {
      background-color: #e03600;
    }
    button:last-child {
      background-color: #ccc;
    }
    button:last-child:hover {
      background-color: #bbb;
    }
    .error {
      color: red;
      margin: 5px 0;
    }
  </style>