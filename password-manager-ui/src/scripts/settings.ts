import { disable2FA, getUserInfo, setup2FA, verify2FA } from '../services/api.ts';
import { initializeSharedPageShell } from './shared-page.ts';

interface UserInfo {
    username: string;
    email: string;
    salt: string;
    is2FaEnabled?: boolean;
}

const RU = {
    enabledStatus: 'Двухфакторная аутентификация включена. После ввода пароля потребуется TOTP-код.',
    disabledStatus: 'Двухфакторная аутентификация выключена. Сейчас вход выполняется только по паролю и мастер-паролю.',
    enabledBadge: 'Включена',
    disabledBadge: 'Выключена',
    setupStartError: 'Не удалось начать настройку 2FA',
    setupCodeRequired: 'Введите текущий TOTP-код, чтобы завершить настройку.',
    enableError: 'Не удалось включить 2FA',
    disableError: 'Не удалось отключить 2FA',
    loadError: 'Не удалось загрузить настройки'
};

document.addEventListener('DOMContentLoaded', async () => {
    initializeSharedPageShell();

    const start2faSetupBtn = document.getElementById('start2faSetupBtn') as HTMLButtonElement | null;
    const disable2faBtn = document.getElementById('disable2faBtn') as HTMLButtonElement | null;
    const verify2faBtn = document.getElementById('verify2faBtn') as HTMLButtonElement | null;
    const twofaStatusText = document.getElementById('twofaStatusText') as HTMLParagraphElement | null;
    const twofaStatusBadge = document.getElementById('twofaStatusBadge') as HTMLSpanElement | null;
    const twofaSetupPanel = document.getElementById('twofaSetupPanel') as HTMLDivElement | null;
    const twofaUri = document.getElementById('twofaUri') as HTMLTextAreaElement | null;
    const twofaCode = document.getElementById('twofaCode') as HTMLInputElement | null;
    const twofaQrImage = document.getElementById('twofaQrImage') as HTMLImageElement | null;
    const settingsError = document.getElementById('settingsError') as HTMLDivElement | null;

    if (!start2faSetupBtn || !disable2faBtn || !verify2faBtn || !twofaStatusText || !twofaStatusBadge || !twofaSetupPanel || !twofaUri || !twofaCode || !twofaQrImage || !settingsError) {
        return;
    }

    const showError = (message: string) => {
        settingsError.style.display = 'block';
        settingsError.textContent = message;
    };

    const hideError = () => {
        settingsError.style.display = 'none';
        settingsError.textContent = '';
    };

    const renderStatus = (enabled: boolean) => {
        twofaStatusText.textContent = enabled ? RU.enabledStatus : RU.disabledStatus;
        twofaStatusBadge.textContent = enabled ? RU.enabledBadge : RU.disabledBadge;
        twofaStatusBadge.classList.toggle('settings-badge-active', enabled);
        start2faSetupBtn.style.display = enabled ? 'none' : 'block';
        disable2faBtn.style.display = enabled ? 'block' : 'none';
        if (enabled) {
            twofaSetupPanel.style.display = 'none';
        }
        twofaCode.value = '';
    };

    const renderQr = (uri: string) => {
        twofaQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(uri)}`;
    };

    const loadUserState = async () => {
        hideError();
        const user = await getUserInfo() as UserInfo;
        sessionStorage.setItem('username', user.username || '');
        sessionStorage.setItem('email', user.email || '');
        sessionStorage.setItem('cryptoSalt', user.salt || '');
        renderStatus(Boolean(user.is2FaEnabled));
    };

    start2faSetupBtn.addEventListener('click', async () => {
        try {
            hideError();
            const result = await setup2FA();
            twofaUri.value = result.uri;
            renderQr(result.uri);
            twofaSetupPanel.style.display = 'block';
            twofaCode.focus();
        } catch (error: any) {
            showError(`${RU.setupStartError}: ${error.response?.data?.message || error.message}`);
        }
    });

    verify2faBtn.addEventListener('click', async () => {
        const code = twofaCode.value.trim();
        if (!code) {
            showError(RU.setupCodeRequired);
            return;
        }

        try {
            hideError();
            await verify2FA(code);
            renderStatus(true);
        } catch (error: any) {
            showError(`${RU.enableError}: ${error.response?.data?.message || error.message}`);
        }
    });

    disable2faBtn.addEventListener('click', async () => {
        try {
            hideError();
            await disable2FA();
            twofaSetupPanel.style.display = 'none';
            twofaUri.value = '';
            twofaQrImage.removeAttribute('src');
            renderStatus(false);
        } catch (error: any) {
            showError(`${RU.disableError}: ${error.response?.data?.message || error.message}`);
        }
    });

    try {
        await loadUserState();
    } catch (error: any) {
        showError(`${RU.loadError}: ${error.response?.data?.message || error.message}`);
    }
});
