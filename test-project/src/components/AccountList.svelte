<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let accounts: { id: number; serviceName: string; login: string; password: string; description?: string }[] = [];
  console.log('AccountList.svelte loaded');

  function handleDelete(id: number) {
    dispatch('delete', id);
  }
</script>

<div class="account-list-container">
  <div class="account-list">
    {#if accounts.length === 0}
      <p>Нет аккаунтов. <a href="/add-account">Добавь первый!</a></p>
    {:else}
      {#each accounts as account}
        <div class="card">
          <h3>{account.serviceName}</h3>
          <p>{account.login}</p>
          <button on:click={() => handleDelete(account.id)}>Удалить</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .account-list-container {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .account-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
    padding-bottom: 80px;
    width: 100%;
    /* Убрали max-width, чтобы сетка растягивалась на всю ширину */
  }

  .card {
    background-color: var(--background-secondary);
    border-radius: 10px;
    padding: 15px;
    text-align: center;
    color: var(--text-primary);
    transition: transform 0.2s;
    box-sizing: border-box;
  }

  .card:hover {
    transform: scale(1.02);
  }

  .card h3 {
    font-size: 18px;
    margin-bottom: 10px;
    font-weight: bold;
  }

  .card p {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 15px;
    word-break: break-all;
  }

  .card button {
    background-color: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 5px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s, color 0.2s;
  }

  .card button:hover {
    background-color: var(--accent);
    color: #FFFFFF;
  }

  a {
    color: var(--accent);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  p {
    color: var(--text-primary);
    text-align: center;
    font-size: 16px;
  }
</style>