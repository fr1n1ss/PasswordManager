import { getAccounts, getUserInfo, getUserNotes, ping, validateMasterPassword } from '../services/api.ts';

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

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
}

async function checkServerAvailability(): Promise<boolean> {
    try {
        const data = await ping();
        return data.status === 'ok';
    } catch {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement;
    const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
    const modal = document.getElementById('master-password-modal') as HTMLDivElement;
    const modalTitle = document.querySelector('#master-password-modal .modal-content h2') as HTMLElement;
    const modalErrorMessage = document.getElementById('modal-error-message') as HTMLDivElement;
    const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
    const retryBtn = document.querySelector('.retry-btn') as HTMLButtonElement;
    const logoutBtn = document.querySelector('.logout-btn') as HTMLButtonElement;

    modal.style.display = 'none';
    errorContainer.style.display = 'none';

    if (sessionStorage.getItem('isDataLoaded') === 'true') {
        window.location.href = '/index.html';
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        const isServerAvailable = await checkServerAvailability();
        errorContainer.style.display = 'block';
        if (isServerAvailable) {
            errorMessage.textContent = 'Токен отсутствует. Перенаправляем на страницу логина...';
            setTimeout(() => window.location.href = '/pages/login-page.html', 2000);
        } else {
            errorMessage.innerHTML = '<p>Сервер недоступен. Пожалуйста, попробуйте снова.</p><button class="retry-button" onclick="window.location.reload()">Повторить</button>';
        }
        return;
    }

    if (!await checkServerAvailability()) {
        errorContainer.style.display = 'block';
        errorMessage.innerHTML = 'Сервер недоступен. Пожалуйста, попробуйте позже. <button class="retry-button" onclick="window.location.reload()">Повторить</button>';
        return;
    }

    let user: { username: string; email: string; salt: string };
    try {
        user = await getUserInfo();
        if (!user.username || !user.email) {
            throw new Error('Не удалось получить данные пользователя');
        }
    } catch (error: any) {
        errorContainer.style.display = 'block';
        if (error.response?.status === 401) {
            errorMessage.textContent = 'Сессия истекла или авторизация не удалась. Пожалуйста, войдите заново.';
            localStorage.removeItem('token');
            setTimeout(() => window.location.href = '/pages/login-page.html', 2000);
        } else {
            errorMessage.innerHTML = `Ошибка загрузки пользователя: ${error.message} <button onclick="window.location.reload()">Повторить</button>`;
        }
        return;
    }

    const persistUserContext = (masterPassword: string) => {
        sessionStorage.setItem('masterPassword', masterPassword);
        sessionStorage.setItem('username', user.username || '');
        sessionStorage.setItem('email', user.email || '');
        sessionStorage.setItem('cryptoSalt', user.salt || '');
    };

    let masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        modal.style.display = 'flex';
        modalTitle.textContent = 'Ввод мастер-пароля';
        modalErrorMessage.textContent = 'Пожалуйста, введите мастер-пароль';
    } else {
        persistUserContext(masterPassword);
    }

    const loadData = async (mp: string) => {
        try {
            const accounts = await getAccounts(mp) as Account[];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
        } catch (error: any) {
            console.error('[loading] accounts load failed:', error);
            sessionStorage.setItem('accounts', JSON.stringify([]));
            sessionStorage.setItem('accountsLoadError', 'true');
        }

        try {
            const notes = await getUserNotes(mp) as Note[];
            sessionStorage.setItem('notes', JSON.stringify(notes));
        } catch (error: any) {
            console.error('[loading] notes load failed:', error);
            sessionStorage.setItem('notes', JSON.stringify([]));
            sessionStorage.setItem('notesLoadError', 'true');
        }
    };

    const tryLoadData = async (mp: string) => {
        sessionStorage.removeItem('accountsLoadError');
        sessionStorage.removeItem('notesLoadError');

        try {
            await validateMasterPassword(mp);
            persistUserContext(mp);
            await loadData(mp);
            sessionStorage.setItem('isDataLoaded', 'true');
            window.location.href = '/index.html';
        } catch (error: any) {
            sessionStorage.removeItem('masterPassword');
            sessionStorage.removeItem('accounts');
            sessionStorage.removeItem('notes');

            if (error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403) {
                modalTitle.textContent = 'Ошибка';
                modalErrorMessage.textContent = 'Неверный мастер-пароль. Пожалуйста, попробуйте снова.';
                modal.style.display = 'flex';
            } else {
                errorContainer.style.display = 'block';
                errorMessage.innerHTML = `Ошибка загрузки данных: ${error.message} <button onclick="window.location.reload()">Повторить</button>`;
            }
        }
    };

    if (masterPassword) {
        await tryLoadData(masterPassword);
    }

    retryBtn.addEventListener('click', async () => {
        await (window as any).retryMasterPassword();
    });

    logoutBtn.addEventListener('click', () => {
        (window as any).logout();
    });

    (window as any).retryMasterPassword = async () => {
        const newMasterPassword = masterPasswordInput.value.trim();
        if (!newMasterPassword) {
            modalTitle.textContent = 'Ошибка';
            modalErrorMessage.textContent = 'Мастер-пароль не введён. Пожалуйста, введите мастер-пароль.';
            return;
        }

        modal.style.display = 'none';
        masterPasswordInput.value = '';
        await tryLoadData(newMasterPassword);
    };

    (window as any).logout = () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('masterPassword');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('cryptoSalt');
        sessionStorage.removeItem('accounts');
        sessionStorage.removeItem('notes');
        sessionStorage.removeItem('notesLoadError');
        sessionStorage.removeItem('isDataLoaded');
        window.location.href = '/pages/login-page.html';
    };
});
