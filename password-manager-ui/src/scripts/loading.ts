import { getAccounts, getUserInfo, getUserNotes, ping } from '../services/api.ts';

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
    } catch (error) {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const errorContainer = document.getElementById('errorContainer')!;
    const errorMessage = document.getElementById('errorMessage')!;
    const modal = document.getElementById('master-password-modal')!;
    const modalTitle = document.querySelector('#master-password-modal .modal-content h2') as HTMLElement;
    const modalErrorMessage = document.getElementById('modal-error-message')!;
    const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
    const retryBtn = document.querySelector('.retry-btn') as HTMLButtonElement;
    const logoutBtn = document.querySelector('.logout-btn') as HTMLButtonElement;

    modal.style.display = 'none';
    errorContainer.style.display = 'none';

    const isDataLoaded = sessionStorage.getItem('isDataLoaded');
    if (isDataLoaded === 'true') {
        window.location.href = '/index.html';
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        const isServerAvailable = await checkServerAvailability();
        if (isServerAvailable) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Токен отсутствует. Перенаправляем на страницу логина...';
            setTimeout(() => window.location.href = '/pages/login-page.html', 2000);
        } else {
            errorContainer.style.display = 'block';
            errorMessage.innerHTML = '<p>Сервер недоступен. Пожалуйста, попробуйте снова.</p> <button class="retry-button" onclick="window.location.reload()">Повторить</button>';
        }
        return;
    }

    const isServerAvailable = await checkServerAvailability();
    if (!isServerAvailable) {
        errorContainer.style.display = 'block';
        errorMessage.innerHTML = 'Сервер недоступен. Пожалуйста, попробуйте позже. <button class="retry-button" onclick="window.location.reload()">Повторить</button>';
        return;
    }

    let user;
    try {
        user = await getUserInfo();
        if (!user.username || !user.email) {
            throw new Error('Пользовательские данные (username или email) отсутствуют');
        }
    } catch (error: any) {
        if (error.response?.status === 401) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Сессия истекла или авторизация не удалась. Пожалуйста, войдите заново.';
            localStorage.removeItem('token');
            setTimeout(() => window.location.href = '/pages/login-page.html', 2000);
        } else {
            errorContainer.style.display = 'block';
            errorMessage.innerHTML = 'Сервер недоступен. Пожалуйста, попробуйте позже: ' + error.message + ' (Статус: ' + (error.response?.status || 'нет статуса') + ') <button onclick="window.location.reload()">Повторить</button>';
        }
        return;
    }

    let masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        modal.style.display = 'flex';
        modalTitle.textContent = 'Ввод мастер-пароля';
        modalErrorMessage.textContent = 'Пожалуйста, введите мастер-пароль';
    } else {
        sessionStorage.setItem('username', user.username || '');
        sessionStorage.setItem('email', user.email || '');
    }

    const loadData = async (mp: string) => {
        let accounts: Account[] = [];
        try {
            accounts = await getAccounts(mp) as Account[];
            if (accounts.length > 0) console.log('First account structure:', accounts[0]);
            else console.log('No accounts found');
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
        } catch (error: any) {
            throw error;
        }

        let notes: Note[] = [];
        try {
            notes = await getUserNotes(mp) as Note[];
            if (notes.length > 0) console.log('First note structure:', notes[0]);
            else console.log('No notes found');
            sessionStorage.setItem('notes', JSON.stringify(notes));
        } catch (error: any) {
            if (error.response?.status !== 400 || error.response?.data?.message !== 'No notes found') throw error;
            else {
                sessionStorage.setItem('notes', JSON.stringify([]));
            }
        }

        return { accounts, notes };
    };

    const tryLoadData = async (mp: string) => {
        try {
            await loadData(mp);
            sessionStorage.setItem('isDataLoaded', 'true');
            window.location.href = '/index.html';
        } catch (error: any) {
            if (error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403) {
                modalTitle.textContent = 'Ошибка';
                modalErrorMessage.textContent = 'Неверный мастер-пароль. Пожалуйста, попробуйте снова.';
                modal.style.display = 'flex';
            } else {
                errorContainer.style.display = 'block';
                errorMessage.innerHTML = 'Ошибка загрузки данных: ' + error.message + ' (Статус: ' + (error.response?.status || 'нет статуса') + ') <button onclick="window.location.reload()">Повторить</button>';
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
        sessionStorage.setItem('masterPassword', newMasterPassword);
        sessionStorage.setItem('username', user.username || '');
        sessionStorage.setItem('email', user.email || '');
        modal.style.display = 'none';
        masterPasswordInput.value = '';
        await tryLoadData(newMasterPassword);
    };

    (window as any).logout = () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('masterPassword');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('accounts');
        sessionStorage.removeItem('notes');
        sessionStorage.removeItem('isDataLoaded');
        window.location.href = '/pages/login-page.html';
    };
});