<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let accounts: { id: number; serviceName: string; login: string; password: string; description?: string }[] = [];
  console.log('AccountList.svelte loaded');

  function handleDelete(id: number) {
    dispatch('delete', id);
  }
</script>

<div>
  <h2>Список аккаунтов</h2>
  {#if accounts.length === 0}
    <p>Нет аккаунтов. <a href="/add-account">Добавь первый!</a></p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Сервис</th>
          <th>Логин</th>
          <th>Пароль</th>
          <th>Описание</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {#each accounts as account}
          <tr>
            <td>{account.serviceName}</td>
            <td>{account.login}</td>
            <td>{account.password}</td>
            <td>{account.description || '-'}</td>
            <td>
              <button on:click={() => handleDelete(account.id)}>Удалить</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 8px;
    text-align: left;
  }
  th {
    background-color: #f0f0f0;
  }
  button {
    background-color: #ff3e00;
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    background-color: #e03600;
  }
</style>