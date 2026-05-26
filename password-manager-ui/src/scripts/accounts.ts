import { addAccount, addToFavorites, deleteAccount, getAccounts, getUserFavorites, removeFromFavorites, updateAccount } from '../services/api.ts';
import { getMasterPassword } from '../services/security-session.ts';
import { decryptAccounts, encryptOpaquePayload } from '../services/zero-knowledge.ts';
import { navigateTo } from './routes.ts';
import { initializeSharedPageShell } from './shared-page.ts';
import { favoriteButtonLabel, UI_TEXT } from './ui-text.ts';

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

interface FavoritesResponse {
    accounts?: Array<{ id: number }>;
}

function debounce(func: Function, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] || char));
}

function getAccountInitial(serviceName: string): string {
    const trimmedName = serviceName.trim();
    return trimmedName ? trimmedName[0].toUpperCase() : '?';
}

document.addEventListener('DOMContentLoaded', async () => {
    console.info('[PERF accounts] accounts.ts loaded, DOMContentLoaded started');

    if (!sessionStorage.getItem('isDataLoaded')) {
        console.warn('[PERF accounts] isDataLoaded is missing, redirecting to loading page');
        navigateTo('loading');
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

    if (!passwordCards || !errorContainer || !fabButton || !addAccountModal || !accountModal || !cancelAccountBtn || !submitAccountBtn || !accountError || !searchInput || !sortDropdown) {
        return;
    }

    const masterPassword = getMasterPassword();
    const cryptoSalt = sessionStorage.getItem('cryptoSalt');
    if (!cryptoSalt) {
        console.warn('[PERF accounts] cryptoSalt is missing, redirecting to login page');
        navigateTo('login');
        return;
    }

    if (!masterPassword) {
        console.warn('[PERF accounts] masterPassword is missing or expired, redirecting to loading page');
        navigateTo('loading');
        return;
    }

    let currentAccountId: number | null = null;
    let isAccountEditMode = false;
    let hasSyncedFavorites = false;

    const getStoredAccounts = () => JSON.parse(sessionStorage.getItem('accounts') || '[]') as Account[];
    const setStoredAccounts = (accounts: Account[]) => sessionStorage.setItem('accounts', JSON.stringify(accounts));
    const syncStoredFavoriteState = async (accounts: Account[]) => {
        let favorites: FavoritesResponse;
        try {
            favorites = await getUserFavorites() as FavoritesResponse;
        } catch (error) {
            console.warn('[PERF accounts] favorites sync failed, using current favorite flags for measurement', error);
            return accounts;
        }

        const favoriteIds = new Set((favorites.accounts || []).map((account) => account.id));
        const syncedAccounts = accounts.map((account) => ({
            ...account,
            isFavorite: favoriteIds.has(account.id)
        }));
        setStoredAccounts(syncedAccounts);
        return syncedAccounts;
    };

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
        setStoredAccounts(getStoredAccounts().map((account) => account.id === accountId ? { ...account, ...patch } : account));
    };

    const filterAccounts = (accounts: Account[]) => {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
            return accounts;
        }

        return accounts.filter((account) => account.serviceName.toLowerCase().includes(term));
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
            accountUpdateBtn.textContent = UI_TEXT.common.save;
            return;
        }

        const account = getStoredAccounts().find((item) => item.id === currentAccountId);
        if (account) {
            serviceName.textContent = account.serviceName;
            login.textContent = account.login;
            encryptedPassword.textContent = account.encryptedPassword || UI_TEXT.common.notSpecified;
            description.textContent = account.description || UI_TEXT.common.notSpecifiedNeuter;
            url.textContent = account.url || UI_TEXT.common.notSpecified;
            creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU');
        }

        accountUpdateBtn.textContent = UI_TEXT.common.edit;
    };

    const openAccountModal = (accountId: number) => {
        const account = getStoredAccounts().find((item) => item.id === accountId);
        if (!account) {
            return;
        }

        currentAccountId = accountId;
        (document.getElementById('modal-service-name') as HTMLElement).textContent = account.serviceName;
        (document.getElementById('modal-login') as HTMLElement).textContent = account.login;
        (document.getElementById('modal-encrypted-password') as HTMLElement).textContent = account.encryptedPassword || UI_TEXT.common.notSpecified;
        (document.getElementById('modal-description') as HTMLElement).textContent = account.description || UI_TEXT.common.notSpecifiedNeuter;
        (document.getElementById('modal-url') as HTMLElement).textContent = account.url || UI_TEXT.common.notSpecified;
        (document.getElementById('modal-creation-date') as HTMLElement).textContent = new Date(account.creationDate).toLocaleString('ru-RU');
        accountModal.style.display = 'flex';
    };

    const toggleFavorite = async (accountId: number, nextState: boolean) => {
        if (nextState) {
            await addToFavorites('account', accountId);
        } else {
            await removeFromFavorites('account', accountId);
        }

        updateStoredAccount(accountId, { isFavorite: nextState });
    };

    const bindCards = () => {
        passwordCards.querySelectorAll<HTMLElement>('.card[data-account-id]').forEach((card) => {
            card.addEventListener('click', () => {
                openAccountModal(Number(card.dataset.accountId));
            });
        });

        passwordCards.querySelectorAll<HTMLElement>('.add-new-card').forEach((card) => {
            card.addEventListener('click', openAddAccountModal);
        });

        passwordCards.querySelectorAll<HTMLElement>('.card-favorite-toggle').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const accountId = Number(button.dataset.itemId);
                const isCurrentlyFavorite = button.dataset.isFavorite === 'true';
                if (!accountId) {
                    return;
                }

                try {
                    await toggleFavorite(accountId, !isCurrentlyFavorite);
                    await loadAccounts();
                } catch (error: any) {
                    alert(`${UI_TEXT.common.errorPrefix}: ${error.message}`);
                }
            });
        });
    };

    const loadAccounts = async (options: { forceFavoriteSync?: boolean } = {}) => {
        // TEMP PERF MEASURE: remove this block after performance research.
        const measureStarted = performance.now();
        console.info('[PERF accounts] loadAccounts started');
        let storageReadFinished = measureStarted;
        let serverLoadFinished = measureStarted;
        let decryptFinished = measureStarted;
        let favoritesSyncFinished = measureStarted;
        let filterSortFinished = measureStarted;
        let renderFinished = measureStarted;

        let accounts = getStoredAccounts();
        storageReadFinished = performance.now();

        if (!sessionStorage.getItem('accounts')) {
            const encryptedAccounts = await getAccounts() as Account[];
            serverLoadFinished = performance.now();
            accounts = await decryptAccounts(encryptedAccounts, masterPassword, cryptoSalt);
            decryptFinished = performance.now();
        } else {
            serverLoadFinished = storageReadFinished;
            decryptFinished = storageReadFinished;
        }

        if (options.forceFavoriteSync || !hasSyncedFavorites) {
            accounts = await syncStoredFavoriteState(accounts);
            hasSyncedFavorites = true;
        }

        favoritesSyncFinished = performance.now();

        const visibleAccounts = sortAccounts(filterAccounts(accounts));

        filterSortFinished = performance.now();

        passwordCards.innerHTML = visibleAccounts.map((account) => {
            const serviceName = escapeHtml(account.serviceName);
            const login = escapeHtml(account.login);
            const logoInitial = escapeHtml(getAccountInitial(account.serviceName));
            const logoUrl = account.url
                ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}&sz=64`
                : '';

            return `
                <div class="card" data-account-id="${account.id}">
                    <button
                        type="button"
                        class="card-favorite-toggle${account.isFavorite ? ' is-active' : ''}"
                        data-item-id="${account.id}"
                        data-is-favorite="${account.isFavorite ? 'true' : 'false'}"
                        aria-label="${favoriteButtonLabel(Boolean(account.isFavorite))}"
                        title="${favoriteButtonLabel(Boolean(account.isFavorite))}"
                    >&starf;</button>
                    <div class="card-logo">
                        ${logoUrl
                            ? `<img src="${logoUrl}" alt="${serviceName} logo" loading="lazy" onload="if (this.naturalWidth <= 16 && this.naturalHeight <= 16) { this.style.display='none'; this.nextElementSibling.style.display='inline-flex'; }" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />`
                            : ''}
                        <span class="card-logo-initial" aria-hidden="true"${logoUrl ? ' style="display: none;"' : ''}>${logoInitial}</span>
                    </div>
                    <div class="card-details">
                        <h3>${serviceName}</h3>
                        <p>${login}</p>
                    </div>
                </div>
            `;
        }).join('') + '<button type="button" class="add-new-card" aria-label="Добавить аккаунт">+</button>';

        renderFinished = performance.now();

        bindCards();

        const measureFinished = performance.now();
        console.info(`[PERF accounts] done: ${Number((measureFinished - measureStarted).toFixed(2))} ms, accounts: ${accounts.length}, visible: ${visibleAccounts.length}`);
        console.table({
            '1 sessionStorage read, ms': Number((storageReadFinished - measureStarted).toFixed(2)),
            '2 server GetAccounts, ms': Number((serverLoadFinished - storageReadFinished).toFixed(2)),
            '3 decrypt accounts, ms': Number((decryptFinished - serverLoadFinished).toFixed(2)),
            '4 favorites sync, ms': Number((favoritesSyncFinished - decryptFinished).toFixed(2)),
            '5 filter and sort, ms': Number((filterSortFinished - favoritesSyncFinished).toFixed(2)),
            '6 render html, ms': Number((renderFinished - filterSortFinished).toFixed(2)),
            '7 bind events, ms': Number((measureFinished - renderFinished).toFixed(2)),
            'total, ms': Number((measureFinished - measureStarted).toFixed(2)),
            'all accounts': accounts.length,
            'visible accounts': visibleAccounts.length,
        });
    };

    try {
        await loadAccounts();
        errorContainer.style.display = 'none';
    } catch (error) {
        console.error('[PERF accounts] loadAccounts failed before measurement finished', error);
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
            const encryptedPassword = await encryptOpaquePayload(password, masterPassword, cryptoSalt);
            const newAccount = await addAccount({ serviceName, login, password: encryptedPassword, description, url });

            setStoredAccounts([...getStoredAccounts(), {
                ...newAccount,
                encryptedPassword: password,
                isFavorite: false
            }]);

            await loadAccounts();
            clearAddForm();
            closeAllModals();
        } catch (error: any) {
            accountError.style.display = 'block';
            accountError.textContent = `${UI_TEXT.common.errorPrefix}: ${error.message}`;
        }
    });

    accountModal.addEventListener('click', (event) => {
        if (event.target === accountModal) {
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach((button) => {
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
            setStoredAccounts(getStoredAccounts().filter((account) => account.id !== currentAccountId));
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
            const encryptedPassword = await encryptOpaquePayload(password, masterPassword, cryptoSalt);
            await updateAccount({
                id: currentAccountId,
                newLogin: login,
                newPassword: encryptedPassword,
                newURL: url,
                newDescription: description,
                newServiceName: serviceName,
            });

            updateStoredAccount(currentAccountId, {
                login,
                encryptedPassword: password,
                serviceName,
                url,
                description
            });

            toggleAccountEditMode(false);
            await loadAccounts();
        } catch (error: any) {
            alert(`Ошибка при обновлении аккаунта: ${error.message}`);
        }
    });

    searchInput.addEventListener('input', debounce(async () => await loadAccounts(), 300));
    sortDropdown.addEventListener('change', async () => await loadAccounts());
});
