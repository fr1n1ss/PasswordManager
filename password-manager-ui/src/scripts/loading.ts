import { getAccounts, getTotpAccounts, getUserInfo, getUserNotes, ping, rotateMasterPassword, updateMasterPasswordVerifier } from '../services/api.ts';
import { clearAuthToken, clearSensitiveSession, getAuthToken, getMasterPassword, setMasterPassword } from '../services/security-session.ts';
import { navigateTo } from './routes.ts';
import {
    buildRotatedAccountPayloads,
    buildRotatedNotePayloads,
    buildRotatedTotpPayloads,
    canDecryptAnyPayload,
    createMasterPasswordVerifier,
    decryptAccounts,
    decryptNotes,
    verifyMasterPasswordLocally
} from '../services/zero-knowledge.ts';
import { enhancePasswordField } from './password-visibility.ts';

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

interface UserInfo {
    username: string;
    email: string;
    salt: string;
    masterPasswordVerifier?: string | null;
    is2FaEnabled?: boolean;
}

interface TotpAccount {
    id: number;
    userId: number;
    serviceName: string;
    issuer: string;
    secret: string;
    digits: number;
    period: number;
}

function hasRequiredWebCrypto(): boolean {
    return Boolean(window.isSecureContext && globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
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
    const modalTitle = document.querySelector('#master-password-modal .auth-modal-title') as HTMLElement;
    const modalErrorMessage = document.getElementById('modal-error-message') as HTMLParagraphElement;
    const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
    const retryBtn = document.querySelector('.retry-btn') as HTMLButtonElement;
    const logoutBtn = document.querySelector('.logout-btn') as HTMLButtonElement;

    modal.style.display = 'none';
    errorContainer.style.display = 'none';
    masterPasswordInput.setAttribute('autocomplete', 'new-password');
    masterPasswordInput.setAttribute('autocorrect', 'off');
    masterPasswordInput.setAttribute('autocapitalize', 'off');
    masterPasswordInput.spellcheck = false;

    enhancePasswordField(masterPasswordInput, {
        groupClass: 'password-input-group auth-password-input-group',
        toggleClass: 'password-toggle auth-password-toggle'
    });

    if (!hasRequiredWebCrypto()) {
        errorContainer.style.display = 'block';
        errorMessage.innerHTML = `
            <p>Для расшифровки данных нужен Web Crypto API, а по обычному HTTP на другом устройстве браузер его блокирует.</p>
            <p>Откройте приложение на этом компьютере через localhost или поднимите фронт по HTTPS, если хотите входить с Mac по сети.</p>
            <button class="retry-button" onclick="window.location.reload()">Повторить</button>
        `;
        return;
    }

    if (sessionStorage.getItem('isDataLoaded') === 'true') {
        navigateTo('home');
        return;
    }

    const token = getAuthToken();
    if (!token) {
        const isServerAvailable = await checkServerAvailability();
        errorContainer.style.display = 'block';
        if (isServerAvailable) {
            errorMessage.textContent = 'Токен отсутствует. Перенаправляем на страницу входа...';
            setTimeout(() => navigateTo('login'), 2000);
        } else {
            errorMessage.innerHTML = `
                <p>Сервер недоступен. Пожалуйста, попробуйте снова.</p>
                <button class="retry-button" onclick="window.location.reload()">Повторить</button>
            `;
        }
        return;
    }

    if (!await checkServerAvailability()) {
        errorContainer.style.display = 'block';
        errorMessage.innerHTML = `
            <p>Сервер недоступен. Пожалуйста, попробуйте позже.</p>
            <button class="retry-button" onclick="window.location.reload()">Повторить</button>
        `;
        return;
    }

    let user: UserInfo;
    try {
        user = await getUserInfo();
        if (!user.username || !user.email) {
            throw new Error('Не удалось получить данные пользователя');
        }
    } catch (error: any) {
        errorContainer.style.display = 'block';
        if (error.response?.status === 401) {
            errorMessage.textContent = 'Сессия истекла или авторизация не удалась. Пожалуйста, войдите заново.';
            clearAuthToken();
            setTimeout(() => navigateTo('login'), 2000);
        } else {
            errorMessage.innerHTML = `
                <p>Ошибка загрузки пользователя: ${error.message}</p>
                <button class="retry-button" onclick="window.location.reload()">Повторить</button>
            `;
        }
        return;
    }

    const persistUserContext = (masterPassword: string) => {
        setMasterPassword(masterPassword);
        sessionStorage.setItem('username', user.username || '');
        sessionStorage.setItem('email', user.email || '');
        sessionStorage.setItem('cryptoSalt', user.salt || '');
    };

    const tryLoadData = async (masterPassword: string) => {
        try {
            const [accountPayloads, notePayloads, totpPayloads] = await Promise.all([
                getAccounts() as Promise<Account[]>,
                getUserNotes() as Promise<Note[]>,
                getTotpAccounts() as Promise<TotpAccount[]>
            ]);

            const verifierStatus = await verifyMasterPasswordLocally(masterPassword, user.salt, user.masterPasswordVerifier);
            const payloadValid = await canDecryptAnyPayload(accountPayloads, notePayloads, totpPayloads, masterPassword, user.salt);
            const hasEncryptedPayloads = accountPayloads.some((item) => item.encryptedPassword.startsWith('zk1:'))
                || notePayloads.some((item) => item.encryptedContent.startsWith('zk1:'))
                || totpPayloads.some((item) => item.secret.startsWith('zk1:'));
            let storedAccountPayloads = accountPayloads;
            let storedNotePayloads = notePayloads;

            if (verifierStatus === false) {
                throw new Error('INVALID_MASTER_PASSWORD');
            }

            if (verifierStatus === null && hasEncryptedPayloads && !payloadValid) {
                throw new Error('INVALID_MASTER_PASSWORD');
            }

            await Promise.all([
                decryptAccounts(accountPayloads, masterPassword, user.salt),
                decryptNotes(notePayloads, masterPassword, user.salt)
            ]);

            if (verifierStatus === null) {
                const verifier = await createMasterPasswordVerifier(masterPassword, user.salt);

                if (hasEncryptedPayloads) {
                    await updateMasterPasswordVerifier(verifier);
                } else {
                    const [rotatedAccounts, rotatedNotes, rotatedTotpAccounts] = await Promise.all([
                        buildRotatedAccountPayloads(accountPayloads, masterPassword, masterPassword, user.salt),
                        buildRotatedNotePayloads(notePayloads, masterPassword, masterPassword, user.salt),
                        buildRotatedTotpPayloads(totpPayloads, masterPassword, masterPassword, user.salt)
                    ]);

                    await rotateMasterPassword({
                        accounts: rotatedAccounts,
                        notes: rotatedNotes,
                        totpAccounts: rotatedTotpAccounts,
                        masterPasswordVerifier: verifier,
                        clearServerVerifier: false
                    });

                    const rotatedAccountById = new Map(rotatedAccounts.map((item) => [item.id, item.encryptedPassword]));
                    const rotatedNoteById = new Map(rotatedNotes.map((item) => [item.id, item.encryptedContent]));
                    storedAccountPayloads = accountPayloads.map((item) => ({
                        ...item,
                        encryptedPassword: rotatedAccountById.get(item.id) || item.encryptedPassword
                    }));
                    storedNotePayloads = notePayloads.map((item) => ({
                        ...item,
                        encryptedContent: rotatedNoteById.get(item.id) || item.encryptedContent
                    }));
                }

                user.masterPasswordVerifier = verifier;
            }

            persistUserContext(masterPassword);
            sessionStorage.setItem('accounts', JSON.stringify(storedAccountPayloads));
            sessionStorage.setItem('notes', JSON.stringify(storedNotePayloads));

            sessionStorage.setItem('isDataLoaded', 'true');
            navigateTo('home');
        } catch (error: any) {
            clearSensitiveSession(true);

            if (error.message === 'INVALID_MASTER_PASSWORD') {
                modalTitle.textContent = 'Введите мастер-пароль';
                modalErrorMessage.textContent = 'Неверный мастер-пароль. Попробуйте еще раз.';
                modal.style.display = 'flex';
            } else {
                errorContainer.style.display = 'block';
                errorMessage.innerHTML = `
                    <p>Ошибка загрузки данных: ${error.message}</p>
                    <button class="retry-button" onclick="window.location.reload()">Повторить</button>
                `;
            }
        }
    };

    const masterPassword = getMasterPassword();
    if (!masterPassword) {
        modal.style.display = 'flex';
        modalTitle.textContent = 'Введите мастер-пароль';
        modalErrorMessage.textContent = 'Пожалуйста, введите мастер-пароль.';
    } else {
        persistUserContext(masterPassword);
        await tryLoadData(masterPassword);
    }

    retryBtn.addEventListener('click', async () => {
        const value = masterPasswordInput.value.trim();
        if (!value) {
            modalTitle.textContent = 'Введите мастер-пароль';
            modalErrorMessage.textContent = 'Мастер-пароль не введен. Пожалуйста, заполните поле.';
            return;
        }

        modal.style.display = 'none';
        masterPasswordInput.value = '';
        await tryLoadData(value);
    });

    logoutBtn.addEventListener('click', () => {
        clearAuthToken();
        clearSensitiveSession();
        navigateTo('login');
    });
});
