import { getAccounts, deleteAccount, updateAccount, addAccount, getAccountById, addToFavorites, removeFromFavorites, isFavorite } from '../services/api.ts';
import { initializeSharedPageShell } from './shared-page.ts';

interface Account {
    id: number;
    userID: number;
    serviceName: string;
    login: string;
    encryptedPassword: string;
    description: string;
    url: string;
    creationDate: string;
    isFavorite?: boolean;
}

function debounce(func: Function, delay: number) {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!sessionStorage.getItem('isDataLoaded')) {
        window.location.href = '/pages/loading-page.html';
        return;
    }

    initializeSharedPageShell();

    const passwordCards = document.getElementById('passwordCards') as HTMLDivElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const fabButton = document.getElementById('fabButton') as HTMLDivElement | null;
    const addAccountModal = document.getElementById('add-account-modal') as HTMLDivElement | null;
    const accountModal = document.getElementById('account-modal') as HTMLDivElement | null;
    const cancelAccountBtn = document.getElementById('cancel-account') as HTMLButtonElement | null;
    const submitAccountBtn = document.getElementById('submit-account') as HTMLButtonElement | null;
    const accountError = document.getElementById('account-error') as HTMLDivElement | null;
    const searchInput = document.querySelector('.search-bar') as HTMLInputElement | null;
    const sortDropdown = document.querySelector('.sort-dropdown') as HTMLSelectElement | null;
    const accountFavoriteBtn = document.getElementById('account-favorite-btn') as HTMLButtonElement | null;

    if (!passwordCards || !errorContainer || !fabButton || !addAccountModal || !accountModal || !cancelAccountBtn || !submitAccountBtn || !accountError || !searchInput || !sortDropdown) {
        return;
    }

    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    let currentAccountId: number | null = null;
    let isAccountEditMode = false;

    const getStoredAccounts = () => JSON.parse(sessionStorage.getItem('accounts') || '[]') as Account[];
    const setStoredAccounts = (accounts: Account[]) => sessionStorage.setItem('accounts', JSON.stringify(accounts));

    const closeAllModals = () => {
        addAccountModal.style.display = 'none';
        accountModal.style.display = 'none';
        accountError.style.display = 'none';
    };

    const clearAddForm = () => {
        (document.getElementById('account-service-name') as HTMLInputElement).value = '';
        (document.getElementById('account-login') as HTMLInputElement).value = '';
        (document.getElementById('account-password') as HTMLInputElement).value = '';
        (document.getElementById('account-description') as HTMLTextAreaElement).value = '';
        (document.getElementById('account-url') as HTMLInputElement).value = '';
    };

    const openAddAccountModal = () => {
        closeAllModals();
        addAccountModal.style.display = 'flex';
    };

    const updateStoredAccount = (accountId: number, patch: Partial<Account>) => {
        const accounts = getStoredAccounts().map(account => account.id === accountId ? { ...account, ...patch } : account);
        setStoredAccounts(accounts);
    };

    const filterAccounts = (accounts: Account[]) => {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
            return accounts;
        }

        return accounts.filter(account => account.serviceName.toLowerCase().includes(term));
    };

    const sortAccounts = (accounts: Account[]) => {
        const sortedAccounts = [...accounts];
        switch (sortDropdown.value) {
            case 'az':
                sortedAccounts.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
                break;
            case 'za':
                sortedAccounts.sort((a, b) => b.serviceName.localeCompare(a.serviceName));
                break;
            case 'oldest':
                sortedAccounts.sort((a, b) => new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime());
                break;
            case 'newest':
                sortedAccounts.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                break;
        }
        return sortedAccounts;
    };

    const toggleAccountEditMode = (enable: boolean) => {
        isAccountEditMode = enable;
        const serviceName = document.getElementById('modal-service-name') as HTMLElement;
        const login = document.getElementById('modal-login') as HTMLElement;
        const encryptedPassword = document.getElementById('modal-encrypted-password') as HTMLElement;
        const description = document.getElementById('modal-description') as HTMLElement;
        const url = document.getElementById('modal-url') as HTMLElement;
        const creationDate = document.getElementById('modal-creation-date') as HTMLElement;
        const accountUpdateBtn = document.getElementById('account-update-btn') as HTMLButtonElement;

        if (enable) {
            serviceName.innerHTML = `<input type="text" id="edit-service-name" value="${serviceName.textContent || ''}" />`;
            login.innerHTML = `<input type="text" id="edit-login" value="${login.textContent || ''}" />`;
            encryptedPassword.innerHTML = `<input type="text" id="edit-encrypted-password" value="${encryptedPassword.textContent || ''}" />`;
            description.innerHTML = `<textarea id="edit-description">${description.textContent || ''}</textarea>`;
            url.innerHTML = `<input type="text" id="edit-url" value="${url.textContent || ''}" />`;
            accountUpdateBtn.textContent = 'Сохранить';
            return;
        }

        const account = getStoredAccounts().find(item => item.id === currentAccountId);
        if (account) {
            serviceName.textContent = account.serviceName;
            login.textContent = account.login;
            encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
            description.textContent = account.description || 'Не указано';
            url.textContent = account.url || 'Не указан';
            creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU');
        }

        accountUpdateBtn.textContent = 'Изменить';
    };

    const applyFavoriteState = (accountId: number, isFav: boolean) => {
        if (!accountFavoriteBtn) {
            return;
        }

        accountFavoriteBtn.textContent = isFav ? 'Удалить из избранного' : 'Добавить в избранное';
        updateStoredAccount(accountId, { isFavorite: isFav });
    };

    const openAccountModal = async (accountId: number) => {
        const account = getStoredAccounts().find(item => item.id === accountId);
        if (!account) {
            return;
        }

        currentAccountId = accountId;

        (document.getElementById('modal-service-name') as HTMLElement).textContent = account.serviceName;
        (document.getElementById('modal-login') as HTMLElement).textContent = account.login;
        (document.getElementById('modal-encrypted-password') as HTMLElement).textContent = account.encryptedPassword || 'Не указан';
        (document.getElementById('modal-description') as HTMLElement).textContent = account.description || 'Не указано';
        (document.getElementById('modal-url') as HTMLElement).textContent = account.url || 'Не указан';
        (document.getElementById('modal-creation-date') as HTMLElement).textContent = new Date(account.creationDate).toLocaleString('ru-RU');

        if (accountFavoriteBtn) {
            applyFavoriteState(accountId, Boolean(account.isFavorite));
            accountFavoriteBtn.onclick = async () => {
                try {
                    const currentFavStatus = Boolean(getStoredAccounts().find(item => item.id === accountId)?.isFavorite);
                    if (currentFavStatus) {
                        await removeFromFavorites('account', accountId);
                        applyFavoriteState(accountId, false);
                    } else {
                        await addToFavorites('account', accountId);
                        applyFavoriteState(accountId, true);
                    }
                } catch (error: any) {
                    alert(`Ошибка: ${error.message}`);
                }
            };
        }

        accountModal.style.display = 'flex';

        if (accountFavoriteBtn) {
            void isFavorite('account', accountId)
                .then((isFav) => applyFavoriteState(accountId, isFav))
                .catch(() => undefined);
        }
    };

    const bindCards = () => {
        passwordCards.querySelectorAll<HTMLElement>('.card[data-account-id]').forEach(card => {
            card.addEventListener('click', () => {
                void openAccountModal(Number(card.dataset.accountId));
            });
        });

        passwordCards.querySelectorAll<HTMLElement>('.add-new-card').forEach(card => {
            card.addEventListener('click', openAddAccountModal);
        });
    };

    const loadAccounts = async () => {
        let accounts = getStoredAccounts();

        if (!sessionStorage.getItem('accounts')) {
            accounts = await getAccounts(masterPassword) as Account[];
            setStoredAccounts(accounts);
        }

        const visibleAccounts = sortAccounts(filterAccounts(accounts));
        if (visibleAccounts.length === 0) {
            passwordCards.innerHTML = '<div class="add-new-card">+</div>';
        } else {
            passwordCards.innerHTML = visibleAccounts.map((account) => {
                const logoUrl = account.url
                    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}`
                    : 'https://via.placeholder.com/32';

                return `
                    <div class="card" data-account-id="${account.id}">
                        <div class="card-logo">
                            <img src="${logoUrl}" alt="${account.serviceName} logo" />
                        </div>
                        <div class="card-details">
                            <h3>${account.serviceName}</h3>
                            <p>${account.login}</p>
                        </div>
                    </div>
                `;
            }).join('') + '<div class="add-new-card">+</div>';
        }

        bindCards();
    };

    try {
        await loadAccounts();
        errorContainer.style.display = 'none';
    } catch (error) {
        errorContainer.style.display = 'block';
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Ошибка при загрузке аккаунтов';
        }
        return;
    }

    fabButton.addEventListener('click', openAddAccountModal);
    addAccountModal.addEventListener('click', (event) => {
        if (event.target === addAccountModal) {
            closeAllModals();
        }
    });

    cancelAccountBtn.addEventListener('click', () => {
        closeAllModals();
        clearAddForm();
    });

    submitAccountBtn.addEventListener('click', async () => {
        const serviceName = (document.getElementById('account-service-name') as HTMLInputElement).value.trim();
        const login = (document.getElementById('account-login') as HTMLInputElement).value.trim();
        const password = (document.getElementById('account-password') as HTMLInputElement).value.trim();
        const description = (document.getElementById('account-description') as HTMLTextAreaElement).value.trim();
        const url = (document.getElementById('account-url') as HTMLInputElement).value.trim();

        if (!serviceName || !login || !password) {
            accountError.style.display = 'block';
            accountError.textContent = 'Заполните все обязательные поля';
            return;
        }

        try {
            const newAccount = await addAccount({ serviceName, login, password, description, url, masterPassword });
            const decryptedAccount = await getAccountById(newAccount.id, masterPassword);
            const accounts = [...getStoredAccounts(), { ...decryptedAccount, isFavorite: false }];
            setStoredAccounts(accounts);
            await loadAccounts();
            clearAddForm();
            closeAllModals();
        } catch (error: any) {
            accountError.style.display = 'block';
            accountError.textContent = `Ошибка: ${error.message}`;
        }
    });

    accountModal.addEventListener('click', (event) => {
        if (event.target === accountModal) {
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach(button => {
        button.addEventListener('click', () => {
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        });
    });

    (document.getElementById('account-delete-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!currentAccountId) {
            return;
        }

        try {
            await deleteAccount(currentAccountId);
            sessionStorage.removeItem('accounts');
            accountModal.style.display = 'none';
            await loadAccounts();
        } catch (error: any) {
            alert(`Ошибка при удалении аккаунта: ${error.message}`);
        }
    });

    (document.getElementById('account-update-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!isAccountEditMode) {
            toggleAccountEditMode(true);
            return;
        }

        if (!currentAccountId) {
            return;
        }

        const login = (document.getElementById('edit-login') as HTMLInputElement).value;
        const password = (document.getElementById('edit-encrypted-password') as HTMLInputElement).value;
        const serviceName = (document.getElementById('edit-service-name') as HTMLInputElement).value;
        const url = (document.getElementById('edit-url') as HTMLInputElement).value;
        const description = (document.getElementById('edit-description') as HTMLTextAreaElement).value;

        try {
            await updateAccount({ id: currentAccountId, newLogin: login, newPassword: password, newURL: url, newDescription: description, newServiceName: serviceName, masterPassword });
            sessionStorage.removeItem('accounts');
            toggleAccountEditMode(false);
            await loadAccounts();
        } catch (error: any) {
            alert(`Ошибка при обновлении аккаунта: ${error.message}`);
        }
    });

    searchInput.addEventListener('input', debounce(async () => await loadAccounts(), 300));
    sortDropdown.addEventListener('change', debounce(async () => await loadAccounts(), 300));
});
