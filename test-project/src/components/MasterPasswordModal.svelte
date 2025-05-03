<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  let masterPassword = '';

  function handleSubmit() {
    if (masterPassword.trim()) {
      dispatch('submit', masterPassword);
    }
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="modal-overlay">
  <div class="modal">
    <h2>Введите мастер-пароль</h2>
    <p>Чтобы получить доступ, введите мастер-пароль.</p>
    <input
      type="password"
      bind:value={masterPassword}
      placeholder="Мастер-пароль"
      on:keydown={(e) => e.key === 'Enter' && handleSubmit()}
    />
    <div class="buttons">
      <button class="confirm" on:click={handleSubmit}>Подтвердить</button>
      <button class="cancel" on:click={handleCancel}>Отмена</button>
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
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal {
    background-color: var(--background-card);
    border-radius: 10px;
    padding: 20px;
    width: 400px;
    max-width: 90%;
    color: var(--text-primary);
    text-align: center;
  }

  h2 {
    font-size: 20px;
    margin-bottom: 10px;
  }

  p {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 20px;
  }

  input {
    width: 100%;
    padding: 10px;
    margin-bottom: 20px;
    border: 1px solid #555;
    border-radius: 5px;
    background-color: #333;
    color: var(--text-primary);
    font-size: 14px;
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .confirm {
    background-color: var(--accent);
    color: #FFFFFF;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
  }

  .confirm:hover {
    background-color: #0088CC;
  }

  .cancel {
    background-color: #555;
    color: var(--text-primary);
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
  }

  .cancel:hover {
    background-color: #777;
  }
</style>