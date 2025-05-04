import { getAccounts } from '../services/api.ts';

console.log('Script loaded');

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
    console.log('DOM loaded, initializing...');
    const passwordCards = document.getElementById('passwordCards')!;
    const errorContainer = document.getElementById('errorContainer')!;
    const errorMessage = document.getElementById('errorMessage')!;

    // Получение мастер-пароля из sessionStorage
    const masterPassword = sessionStorage.getItem('masterPassword');

    if (!masterPassword) {
        console.warn('Master password not found in session. Redirecting to login...');
        window.location.href = '../pages/login-page.html';
        return;
    }

    // Загрузка аккаунтов
    console.log('Loading accounts...');
    let accounts: Account[] = [];
    try {
        accounts = await getAccounts(masterPassword) as Account[];
        console.log('Accounts received:', accounts);
        if (accounts.length > 0) {
            console.log('First account structure:', accounts[0]);
        }
        passwordCards.innerHTML = accounts
            .map(
                (account: Account) => {
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
                }
            )
            .join('');
        errorContainer.style.display = 'none';
    } catch (error: any) {
        console.error('Error loading accounts:', error.message, error.response?.status, error.response?.data);
        errorContainer.style.display = 'block';
        errorMessage.textContent = `Ошибка загрузки аккаунтов: ${error.message} (Статус: ${error.response?.status})`;
        return;
    }

    // Создание модального окна
    console.log('Creating modal...');
    const modalHtml = `
        <div id="account-modal" class="modal">
            <div class="modal-content">
                <h2 id="modal-service-name"></h2>
                <div class="modal-field">
                    <span class="modal-label">Логин:</span>
                    <span id="modal-login"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Пароль:</span>
                    <span id="modal-encrypted-password"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Описание:</span>
                    <span id="modal-description"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">URL:</span>
                    <span id="modal-url"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Дата создания:</span>
                    <span id="modal-creation-date"></span>
                </div>
                <button class="modal-close-btn">Закрыть</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    console.log('Modal created');

    // Глобальная функция для открытия модального окна
    (window as any).openAccountModal = (accountId: number) => {
        console.log('Opening modal for account ID:', accountId);
        const account = accounts.find(acc => acc.id === accountId);
        if (!account) {
            console.error('Account not found:', accountId);
            return;
        }

        const modal = document.getElementById('account-modal');
        const serviceName = document.getElementById('modal-service-name');
        const login = document.getElementById('modal-login');
        const encryptedPassword = document.getElementById('modal-encrypted-password');
        const description = document.getElementById('modal-description');
        const url = document.getElementById('modal-url');
        const creationDate = document.getElementById('modal-creation-date');

        if (!modal || !serviceName || !login || !encryptedPassword || !description || !url || !creationDate) {
            console.error('Modal elements not found:', { modal, serviceName, login, encryptedPassword, description, url, creationDate });
            return;
        }

        console.log('Filling modal with account:', account);
        serviceName.textContent = account.serviceName;
        login.textContent = account.login;
        encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
        description.textContent = account.description || 'Не указано';
        url.textContent = account.url || 'Не указан';
        creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU') || 'Не указана';

        modal.style.display = 'block';
        console.log('Modal displayed');
    };

    // Привязка событий для закрытия модального окна
    const modal = document.getElementById('account-modal');
    const closeBtn = document.querySelector('.modal-close-btn');
    if (modal && closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('Closing modal via button');
            modal.style.display = 'none';
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Closing modal via click outside');
                modal.style.display = 'none';
            }
        });
    } else {
        console.error('Modal or close button not found:', { modal, closeBtn });
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('masterPassword');
    window.location.href = '../pages/login-page.html';
});