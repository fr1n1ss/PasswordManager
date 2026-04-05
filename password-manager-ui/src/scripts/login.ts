import { login, loginWith2FA } from '../services/api.ts';
import { enhancePasswordField } from './password-visibility.ts';

interface LoginResponse {
    token?: string;
    requires2FA?: boolean;
    tempToken?: string;
}

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

    if (!loginForm || !usernameInput || !passwordInput || !errorContainer || !errorMessage || !masterPasswordModal || !totpModal || !totpCodeInput || !submitTotpButton || !cancelTotpButton) {
        return;
    }

    enhancePasswordField(passwordInput);

    let pendingTempToken = '';

    const showError = (message: string) => {
        errorContainer.style.display = 'block';
        errorMessage.textContent = message;
    };

    const hideError = () => {
        errorContainer.style.display = 'none';
        errorMessage.textContent = '';
    };

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
                showError('Master password is required');
                return;
            }

            sessionStorage.setItem('masterPassword', masterPassword);
            masterPasswordModal.style.display = 'none';
            masterPasswordInput.value = '';
            sessionStorage.removeItem('isDataLoaded');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('email');
            sessionStorage.removeItem('accounts');
            sessionStorage.removeItem('notes');
            window.location.href = '/pages/loading-page.html';
        };

        (window as any).cancelMasterPassword = () => {
            masterPasswordModal.style.display = 'none';
            const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
            masterPasswordInput.value = '';
            localStorage.removeItem('token');
            showError('Master password entry was cancelled. Please sign in again.');
        };
    };

    const closeTotpModal = () => {
        pendingTempToken = '';
        totpCodeInput.value = '';
        totpModal.style.display = 'none';
    };

    const finishLogin = (token: string) => {
        localStorage.setItem('token', token);
        closeTotpModal();
        requestAnimationFrame(() => {
            openMasterPasswordModal();
        });
    };

    submitTotpButton.addEventListener('click', async () => {
        const code = totpCodeInput.value.trim();
        if (!pendingTempToken || !code) {
            showError('Enter the TOTP code from your authenticator app');
            return;
        }

        try {
            hideError();
            submitTotpButton.disabled = true;
            const response = await loginWith2FA(pendingTempToken, code);
            finishLogin(response.token);
        } catch (error: any) {
            showError(`2FA error: ${error.response?.data?.message || error.message}`);
        } finally {
            submitTotpButton.disabled = false;
        }
    });

    cancelTotpButton.addEventListener('click', () => {
        closeTotpModal();
        localStorage.removeItem('token');
    });

    totpModal.addEventListener('click', (event) => {
        if (event.target === totpModal) {
            closeTotpModal();
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
            showError('Enter username and password');
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

            throw new Error('Login response did not contain a token');
        } catch (error: any) {
            if (!error.response && (error.message.includes('Network') || error.message.includes('Failed to fetch'))) {
                showError('Network error. Redirecting to loading page...');
                setTimeout(() => window.location.href = '/pages/loading-page.html', 2000);
            } else {
                showError(`Authorization error: ${error.response?.data?.message || error.message}`);
            }
        }
    });
});
