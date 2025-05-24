import { getAccounts, deleteAccount, updateAccount, addAccount, getAccountById, hashAccounts } from '../services/api.ts';

async function hashData(data: any): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data));
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

interface Account {
    id: number;
    userID: number;
    serviceName: string;
    login: string;
    encryptedPassword: string;
    description: string;
    url: string;
    creationDate: string;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing accounts...');

    // Проверка, загружены ли данные
    const isDataLoaded = sessionStorage.getItem('isDataLoaded');
    if (!isDataLoaded) {
        console.warn('Data not loaded. Redirecting to loading page...');
        window.location.href = '/pages/loading-page.html';
        return;
    }

    // Извлечение информации о пользователе
    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');

    if (usernameElement && username) {
        usernameElement.textContent = username;
    } else {
        console.warn('Username not found in sessionStorage');
    }
    if (emailElement && email) {
        emailElement.textContent = email;
    } else {
        console.warn('Email not found in sessionStorage');
    }

    const passwordCards = document.getElementById('passwordCards')!;
    const errorContainer = document.getElementById('errorContainer')!;
    const fabButton = document.getElementById('fabButton')!;
    const addAccountModal = document.getElementById('add-account-modal')!;
    const cancelAccountBtn = document.getElementById('cancel-account')!;
    const submitAccountBtn = document.getElementById('submit-account')!;
    const accountError = document.getElementById('account-error')!;

    // Получение мастер-пароля
    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        console.warn('Master password not found in session. Redirecting to login...');
        window.location.href = '/pages/login-page.html';
        return;
    }
    const syncData = async () => {
        const masterPassword = sessionStorage.getItem('masterPassword');
        if (!masterPassword) return;

        try {
            const cachedAccounts = JSON.parse(sessionStorage.getItem('accounts') || '[]');

            const localAccountsHash = await hashData(cachedAccounts);

            const accountsHash = await hashAccounts();

            if (localAccountsHash !== accountsHash) {
                const updatedAccounts = await getAccounts(masterPassword);
                sessionStorage.setItem('accounts', JSON.stringify(updatedAccounts));
                await loadAccounts();
                console.log('[sync] Accounts обновлены');
            }

        } catch (err) {
            console.error('[syncData] Ошибка синхронизации:', err);
        }
    };

    // Загрузка и отображение аккаунтов
    const loadAccounts = async () => {
        const accountsStr = sessionStorage.getItem('accounts');
        let accounts: Account[] = [];
        if (accountsStr) {
            accounts = JSON.parse(accountsStr);
        } else {
            accounts = await getAccounts(masterPassword) as Account[];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
        }
        console.log('Accounts retrieved:', accounts);
        if (accounts.length === 0) {
            console.log('No accounts to display');
            passwordCards.innerHTML = '<div class="add-new-card">+</div>';
        } else {
            passwordCards.innerHTML = accounts
                .map((account: Account) => {
                    const logoUrl = account.url
                        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}`
                        : 'https://via.placeholder.com/32';
                    return `
                        <div class="card" onclick="openAccountModal(${account.id})">
                            <div class="card-logo">
                                <img src="${logoUrl}" alt="${account.serviceName} logo" />
                            </div>
                            <div class="card-details">
                                <h3>${account.serviceName}</h3>
                                <p>${account.login}</p>
                            </div>
                        </div>
                    `;
                })
                .join('') + '<div class="add-new-card">+</div>';
        }
    };

    await loadAccounts();
    errorContainer.style.display = 'none';

    // Модальное окно для аккаунтов уже есть в HTML
    let currentAccountId: number | null = null;

    // Функция для скрытия всех модальных окон
    const closeAllModals = () => {
        addAccountModal.style.display = 'none';
        const accountModal = document.getElementById('account-modal')!;
        accountModal.style.display = 'none';
        accountError.style.display = 'none';
    };

    // Обработчик для карточки "+"
    passwordCards.querySelectorAll('.add-new-card').forEach(card => {
        card.addEventListener('click', () => {
            closeAllModals();
            addAccountModal.style.display = 'flex';
        });
    });

    // Обработчик для FAB кнопки
    fabButton.addEventListener('click', () => {
        closeAllModals();
        addAccountModal.style.display = 'flex';
    });

    // Закрытие модального окна добавления при клике на фон
    addAccountModal.addEventListener('click', (e) => {
        if (e.target === addAccountModal) {
            closeAllModals();
        }
    });

    // Отмена добавления
    cancelAccountBtn.addEventListener('click', () => {
        closeAllModals();
        (document.getElementById('account-service-name') as HTMLInputElement).value = '';
        (document.getElementById('account-login') as HTMLInputElement).value = '';
        (document.getElementById('account-password') as HTMLInputElement).value = '';
        (document.getElementById('account-description') as HTMLTextAreaElement).value = '';
        (document.getElementById('account-url') as HTMLInputElement).value = '';
    });

    // Добавление аккаунта
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
            console.log('Account added (encrypted response):', newAccount);
            const accountId = newAccount.id;
            if (!accountId) {
                throw new Error('Account ID is missing in the response');
            }
            console.log('Fetching decrypted account with ID:', accountId);
            const decryptedAccount = await getAccountById(accountId, masterPassword);
            console.log('Decrypted account:', decryptedAccount);
            const accounts = [...JSON.parse(sessionStorage.getItem('accounts') || '[]'), decryptedAccount];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
            await loadAccounts();
            closeAllModals();
            alert('Аккаунт успешно добавлен!');
        } catch (error: any) {
            accountError.style.display = 'block';
            accountError.textContent = `Ошибка: ${error.message}`;
            console.error('Error details:', error.response?.data || error.message);
        }
    });

    // Открытие модального окна для аккаунтов
    (window as any).openAccountModal = (accountId: number) => {
        console.log('Opening account modal for ID:', accountId);
        const account = JSON.parse(sessionStorage.getItem('accounts') || '[]').find((acc: Account) => acc.id === accountId);
        if (!account) {
            console.error('Account not found:', accountId);
            return;
        }

        currentAccountId = accountId;

        const modal = document.getElementById('account-modal')!;
        const serviceName = document.getElementById('modal-service-name')!;
        const login = document.getElementById('modal-login')!;
        const encryptedPassword = document.getElementById('modal-encrypted-password')!;
        const description = document.getElementById('modal-description')!;
        const url = document.getElementById('modal-url')!;
        const creationDate = document.getElementById('modal-creation-date')!;

        serviceName.textContent = account.serviceName;
        login.textContent = account.login;
        encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
        description.textContent = account.description || 'Не указано';
        url.textContent = account.url || 'Не указан';
        creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU') || 'Не указана';

        modal.style.display = 'flex';
        console.log('Account modal displayed');
    };

    // Закрытие модального окна
    const accountModal = document.getElementById('account-modal')!;
    const closeButtons = document.querySelectorAll('.modal-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Closing modal');
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        });
    });

    accountModal.addEventListener('click', (e) => {
        if (e.target === accountModal) {
            console.log('Closing account modal via click outside');
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        }
    });

    // Логика удаления аккаунта
    const accountDeleteBtn = document.getElementById('account-delete-btn')!;
    accountDeleteBtn.addEventListener('click', async () => {
        if (!currentAccountId) {
            console.error('No account ID to delete');
            return;
        }
        try {
            console.log('Deleting account:', currentAccountId);
            await deleteAccount(currentAccountId);
            console.log('Account deleted successfully');
            accountModal.style.display = 'none';
            const accounts = await getAccounts(masterPassword) as Account[];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
            await loadAccounts();
        } catch (error: any) {
            console.error('Error deleting account:', error.message);
            alert('Ошибка при удалении аккаунта: ' + error.message);
        }
    });

    // Логика редактирования аккаунта
    let isAccountEditMode = false;
    const accountUpdateBtn = document.getElementById('account-update-btn')!;
    const toggleAccountEditMode = (enable: boolean) => {
        isAccountEditMode = enable;
        const serviceName = document.getElementById('modal-service-name')!;
        const login = document.getElementById('modal-login')!;
        const encryptedPassword = document.getElementById('modal-encrypted-password')!;
        const description = document.getElementById('modal-description')!;
        const url = document.getElementById('modal-url')!;
        const creationDate = document.getElementById('modal-creation-date')!;

        if (enable) {
            serviceName.innerHTML = `<input type="text" id="edit-service-name" value="${serviceName.textContent || ''}" />`;
            login.innerHTML = `<input type="text" id="edit-login" value="${login.textContent || ''}" />`;
            encryptedPassword.innerHTML = `<input type="text" id="edit-encrypted-password" value="${encryptedPassword.textContent || ''}" />`;
            description.innerHTML = `<textarea id="edit-description">${description.textContent || ''}</textarea>`;
            url.innerHTML = `<input type="text" id="edit-url" value="${url.textContent || ''}" />`;
            accountUpdateBtn.textContent = 'Сохранить';
        } else {
            const account = JSON.parse(sessionStorage.getItem('accounts') || '[]').find((acc: Account) => acc.id === currentAccountId);
            if (account) {
                serviceName.textContent = account.serviceName;
                login.textContent = account.login;
                encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
                description.textContent = account.description || 'Не указано';
                url.textContent = account.url || 'Не указан';
                creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU') || 'Не указана';
            }
            accountUpdateBtn.textContent = 'Изменить';
        }
    };

    accountUpdateBtn.addEventListener('click', async () => {
        if (!isAccountEditMode) {
            toggleAccountEditMode(true);
        } else {
            if (!currentAccountId) {
                console.error('No account ID to update');
                return;
            }
            const login = (document.getElementById('edit-login') as HTMLInputElement).value;
            const password = (document.getElementById('edit-encrypted-password') as HTMLInputElement).value;
            const serviceName = (document.getElementById('edit-service-name') as HTMLInputElement).value;
            const url = (document.getElementById('edit-url') as HTMLInputElement).value;
            const description = (document.getElementById('edit-description') as HTMLTextAreaElement).value;

            const updatedAccount: Partial<Account> = {
                id: currentAccountId,
                serviceName: serviceName,
                login: login,
                encryptedPassword: password,
                description: description,
                url: url,
            };

            try {
                console.log('Updating account:', updatedAccount);
                await updateAccount({ id: currentAccountId, newLogin: login, newPassword: password, newURL: url, newDescription: description, newServiceName: serviceName, masterPassword });
                console.log('Account updated successfully');
                const accounts = await getAccounts(masterPassword) as Account[];
                sessionStorage.setItem('accounts', JSON.stringify(accounts));
                toggleAccountEditMode(false);
                await loadAccounts();
            } catch (error: any) {
                console.error('Error updating account:', error.message);
                alert('Ошибка при обновлении аккаунта: ' + error.message);
            }
        }
    });

    // Обработка выпадающего меню
    const dropdown = document.querySelector('.profile-dropdown')!;
    const menu = document.getElementById('profileMenu')!;
    dropdown.addEventListener('click', () => {
        const isMenuOpen = menu.style.display === 'block';
        menu.style.display = isMenuOpen ? 'none' : 'block';
        dropdown.textContent = isMenuOpen ? '▼' : '▲';
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target as Node) && !menu.contains(e.target as Node)) {
            menu.style.display = 'none';
            dropdown.textContent = '▼';
        }
    });

    // Обработка выхода
    const logoutBtn = document.getElementById('logoutBtn')!;
    logoutBtn.addEventListener('click', () => {
        console.log('Logging out');
        localStorage.removeItem('token');
        sessionStorage.removeItem('masterPassword');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('accounts');
        sessionStorage.removeItem('notes');
        sessionStorage.removeItem('isDataLoaded');
        window.location.href = '/pages/login-page.html';
    });

    // Переключение боковой панели
    const sidebar = document.getElementById('sidebar')!;
    const hideBtn = document.getElementById('hideBtn')!;
    hideBtn.addEventListener('click', () => {
        const isHidden = sidebar.classList.contains('hidden');
        sidebar.classList.toggle('hidden');
        hideBtn.textContent = isHidden ? '≪' : '≫';
        console.log('Sidebar toggled, hidden:', !isHidden);
    });

    setInterval(syncData, 10000);
});