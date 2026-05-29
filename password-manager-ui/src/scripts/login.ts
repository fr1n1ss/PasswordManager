import {
    login,
    loginWith2FA,
    requestPasswordReset,
    resetPassword
} from '../services/api.ts';
import { clearAuthToken, clearSensitiveSession, setAuthToken, setMasterPassword } from '../services/security-session.ts';
import { enhancePasswordField } from './password-visibility.ts';
import { navigateTo } from './routes.ts';

interface LoginResponse {
    token?: string;
    requires2FA?: boolean;
    tempToken?: string;
}

const EMAIL_MAX_LENGTH = 256;
const AUTH_PASSWORD_MAX_LENGTH = 128;
const CONFIRMATION_CODE_LENGTH = 6;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm') as HTMLFormElement | null;
    const usernameInput = document.getElementById('username') as HTMLInputElement | null;
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const errorMessage = document.getElementById('errorMessage') as HTMLParagraphElement | null;
    const masterPasswordModal = document.getElementById('master-password-modal') as HTMLDivElement | null;
    const totpModal = document.getElementById('totp-modal') as HTMLDivElement | null;
    const totpCodeInput = document.getElementById('totp-code-input') as HTMLInputElement | null;
    const submitTotpButton = document.getElementById('submit-totp-button') as HTMLButtonElement | null;
    const cancelTotpButton = document.getElementById('cancel-totp-button') as HTMLButtonElement | null;
    const forgotPasswordButton = document.getElementById('forgot-password-button') as HTMLElement | null;
    const forgotPasswordModal = document.getElementById('forgot-password-modal') as HTMLDivElement | null;
    const resetEmailInput = document.getElementById('reset-email-input') as HTMLInputElement | null;
    const resetCodeInput = document.getElementById('reset-code-input') as HTMLInputElement | null;
    const resetPasswordInput = document.getElementById('reset-password-input') as HTMLInputElement | null;
    const resetErrorMessage = document.getElementById('reset-error-message') as HTMLParagraphElement | null;
    const requestResetCodeButton = document.getElementById('request-reset-code-button') as HTMLButtonElement | null;
    const submitResetPasswordButton = document.getElementById('submit-reset-password-button') as HTMLButtonElement | null;
    const cancelResetPasswordButton = document.getElementById('cancel-reset-password-button') as HTMLButtonElement | null;

    if (
        !loginForm || !usernameInput || !passwordInput || !errorContainer || !errorMessage ||
        !masterPasswordModal || !totpModal || !totpCodeInput || !submitTotpButton || !cancelTotpButton ||
        !forgotPasswordButton || !forgotPasswordModal || !resetEmailInput || !resetCodeInput ||
        !resetPasswordInput || !resetErrorMessage || !requestResetCodeButton ||
        !submitResetPasswordButton || !cancelResetPasswordButton
    ) {
        return;
    }

    enhancePasswordField(passwordInput);
    enhancePasswordField(resetPasswordInput);
    usernameInput.maxLength = EMAIL_MAX_LENGTH;
    passwordInput.maxLength = AUTH_PASSWORD_MAX_LENGTH;
    resetEmailInput.maxLength = EMAIL_MAX_LENGTH;
    resetPasswordInput.maxLength = AUTH_PASSWORD_MAX_LENGTH;

    [totpCodeInput, resetCodeInput].forEach((input) => {
        input.maxLength = CONFIRMATION_CODE_LENGTH;
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '');
        });
    });

    let pendingTempToken = '';

    const showError = (message: string) => {
        errorContainer.style.display = 'block';
        errorMessage.textContent = message;
    };

    const hideError = () => {
        errorContainer.style.display = 'none';
        errorMessage.textContent = '';
    };

    const showResetMessage = (message: string) => {
        resetErrorMessage.style.display = 'block';
        resetErrorMessage.textContent = message;
    };

    const hideResetMessage = () => {
        resetErrorMessage.style.display = 'none';
        resetErrorMessage.textContent = '';
    };

    if (new URLSearchParams(window.location.search).get('sessionExpired')) {
        showError('Сессия истекла или была отозвана. Войдите снова.');
    }

    const openMasterPasswordModal = () => {
        masterPasswordModal.style.display = 'flex';
        const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement | null;
        if (masterPasswordInput) {
            enhancePasswordField(masterPasswordInput, {
                groupClass: 'password-input-group auth-password-input-group',
                toggleClass: 'password-toggle auth-password-toggle'
            });
        }

        (window as any).submitMasterPassword = () => {
            const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
            const masterPassword = masterPasswordInput.value.trim();

            if (!masterPassword) {
                showError('Введите мастер-пароль');
                return;
            }

            setMasterPassword(masterPassword);
            masterPasswordModal.style.display = 'none';
            masterPasswordInput.value = '';
            clearSensitiveSession();
            setMasterPassword(masterPassword);
            navigateTo('loading');
        };

        (window as any).cancelMasterPassword = () => {
            masterPasswordModal.style.display = 'none';
            const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
            masterPasswordInput.value = '';
            clearAuthToken();
            clearSensitiveSession();
            showError('Ввод мастер-пароля отменен. Войдите снова.');
        };
    };

    const closeTotpModal = () => {
        pendingTempToken = '';
        totpCodeInput.value = '';
        totpModal.style.display = 'none';
    };

    const openForgotPasswordModal = () => {
        resetEmailInput.value = '';
        resetCodeInput.value = '';
        resetPasswordInput.value = '';
        hideResetMessage();
        forgotPasswordModal.style.display = 'flex';
        resetEmailInput.focus();
    };

    const closeForgotPasswordModal = () => {
        forgotPasswordModal.style.display = 'none';
        resetCodeInput.value = '';
        resetPasswordInput.value = '';
        hideResetMessage();
    };

    const finishLogin = (token: string) => {
        setAuthToken(token);
        closeTotpModal();
        requestAnimationFrame(openMasterPasswordModal);
    };

    submitTotpButton.addEventListener('click', async () => {
        const code = totpCodeInput.value.trim();
        if (!pendingTempToken || !code) {
            showError('Введите TOTP-код из приложения-аутентификатора');
            return;
        }

        try {
            hideError();
            submitTotpButton.disabled = true;
            const response = await loginWith2FA(pendingTempToken, code);
            finishLogin(response.token);
        } catch (error: any) {
            showError(`Ошибка 2FA: ${error.response?.data?.message || error.message}`);
        } finally {
            submitTotpButton.disabled = false;
        }
    });

    cancelTotpButton.addEventListener('click', () => {
        closeTotpModal();
        clearAuthToken();
        clearSensitiveSession();
    });

    forgotPasswordButton.addEventListener('click', (event) => {
        event.preventDefault();
        openForgotPasswordModal();
    });

    requestResetCodeButton.addEventListener('click', async () => {
        const email = resetEmailInput.value.trim();
        if (!email) {
            showResetMessage('Введите email аккаунта');
            return;
        }

        if (email.length > EMAIL_MAX_LENGTH) {
            showResetMessage(`Email должен быть не длиннее ${EMAIL_MAX_LENGTH} символов`);
            return;
        }

        try {
            hideResetMessage();
            const response = await requestPasswordReset(email);
            if (response.previewCode) {
                console.info(`[DEV] Код восстановления пароля для ${email}: ${response.previewCode}`);
            }

            showResetMessage(response.previewCode
                ? `Код восстановления отправлен. Код для разработки: ${response.previewCode}`
                : 'Код восстановления отправлен, если email подтвержден.');
        } catch (error: any) {
            showResetMessage(`Ошибка запроса восстановления: ${error.response?.data?.message || error.message}`);
        }
    });

    submitResetPasswordButton.addEventListener('click', async () => {
        const email = resetEmailInput.value.trim();
        const code = resetCodeInput.value.trim();
        const newPassword = resetPasswordInput.value.trim();

        if (!email || !code || !newPassword) {
            showResetMessage('Введите email, код и новый пароль');
            return;
        }

        if (email.length > EMAIL_MAX_LENGTH || newPassword.length > AUTH_PASSWORD_MAX_LENGTH) {
            showResetMessage('Email или новый пароль слишком длинные');
            return;
        }

        try {
            hideResetMessage();
            await resetPassword(email, code, newPassword);
            closeForgotPasswordModal();
            showError('Пароль изменен. Войдите с новым паролем.');
        } catch (error: any) {
            showResetMessage(`Ошибка восстановления пароля: ${error.response?.data?.message || error.message}`);
        }
    });

    cancelResetPasswordButton.addEventListener('click', closeForgotPasswordModal);

    totpModal.addEventListener('click', (event) => {
        if (event.target === totpModal) {
            closeTotpModal();
        }
    });

    forgotPasswordModal.addEventListener('click', (event) => {
        if (event.target === forgotPasswordModal) {
            closeForgotPasswordModal();
        }
    });

    masterPasswordModal.addEventListener('click', (event) => {
        if (event.target === masterPasswordModal && (window as any).cancelMasterPassword) {
            (window as any).cancelMasterPassword();
        }
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showError('Введите логин или email и пароль');
            return;
        }

        if (username.length > EMAIL_MAX_LENGTH || password.length > AUTH_PASSWORD_MAX_LENGTH) {
            showError('Логин, email или пароль слишком длинные');
            return;
        }

        try {
            hideError();
            const response = await login(username, password) as LoginResponse;

            if (response.requires2FA && response.tempToken) {
                pendingTempToken = response.tempToken;
                totpCodeInput.value = '';
                totpModal.style.display = 'flex';
                totpCodeInput.focus();
                return;
            }

            if (response.token) {
                finishLogin(response.token);
                return;
            }

            throw new Error('Ответ сервера не содержит токен входа');
        } catch (error: any) {
            if (error.response?.status === 403 && error.response?.data?.emailConfirmationRequired) {
                const email = error.response.data.email || '';
                if (error.response.data.previewCode) {
                    console.info(`[DEV] Код подтверждения email для ${email}: ${error.response.data.previewCode}`);
                }

                if (email) {
                    sessionStorage.setItem('pendingEmailConfirmation', email);
                }

                window.location.href = `/confirm-email${email ? `?email=${encodeURIComponent(email)}` : ''}`;
                return;
            }

            if (!error.response && (error.message.includes('Network') || error.message.includes('Failed to fetch'))) {
                showError('Ошибка сети. Перенаправляем на страницу загрузки...');
                setTimeout(() => navigateTo('loading'), 2000);
            } else {
                showError(`Ошибка авторизации: ${error.response?.data?.message || error.message}`);
            }
        }
    });
});
