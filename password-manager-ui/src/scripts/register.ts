import { register } from '../services/api.ts';
import { analyzePassword } from '../services/password-security.ts';
import { createMasterPasswordVerifier, generateClientSalt } from '../services/zero-knowledge.ts';
import { enhancePasswordField } from './password-visibility.ts';

const USERNAME_MAX_LENGTH = 25;
const EMAIL_MAX_LENGTH = 256;
const AUTH_PASSWORD_MAX_LENGTH = 128;
const MASTER_PASSWORD_MIN_LENGTH = 7;
const MASTER_PASSWORD_MAX_LENGTH = 256;

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm') as HTMLFormElement | null;
    const usernameInput = document.getElementById('username') as HTMLInputElement | null;
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    const passwordConfirm = document.getElementById('confirmPassword') as HTMLInputElement | null;
    const emailInput = document.getElementById('email') as HTMLInputElement | null;
    const masterPasswordInput = document.getElementById('masterPassword') as HTMLInputElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const errorMessage = document.getElementById('errorMessage') as HTMLParagraphElement | null;
    const passwordFeedback = document.getElementById('registerPasswordFeedback') as HTMLDivElement | null;

    if (!registerForm || !usernameInput || !passwordInput || !passwordConfirm || !emailInput || !masterPasswordInput || !errorContainer || !errorMessage || !passwordFeedback) {
        return;
    }

    const showError = (message: string) => {
        errorContainer.style.display = 'block';
        errorMessage.textContent = message;
    };

    const hideError = () => {
        errorContainer.style.display = 'none';
        errorMessage.textContent = '';
    };

    const getApiErrorMessage = (error: any): string => {
        const responseData = error?.response?.data;
        if (typeof responseData === 'string' && responseData.trim()) {
            return responseData;
        }

        if (typeof responseData?.message === 'string' && responseData.message.trim()) {
            return responseData.message;
        }

        return error?.message || 'Неизвестная ошибка';
    };

    registerForm.setAttribute('autocomplete', 'off');
    [usernameInput, emailInput].forEach((input) => {
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.spellcheck = false;
    });

    usernameInput.maxLength = USERNAME_MAX_LENGTH;
    emailInput.maxLength = EMAIL_MAX_LENGTH;
    passwordInput.maxLength = AUTH_PASSWORD_MAX_LENGTH;
    passwordConfirm.maxLength = AUTH_PASSWORD_MAX_LENGTH;
    masterPasswordInput.minLength = MASTER_PASSWORD_MIN_LENGTH;
    masterPasswordInput.maxLength = MASTER_PASSWORD_MAX_LENGTH;

    [passwordInput, passwordConfirm, masterPasswordInput].forEach((input) => {
        input.setAttribute('autocomplete', 'new-password');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.spellcheck = false;
    });

    enhancePasswordField(passwordInput);
    enhancePasswordField(passwordConfirm);
    enhancePasswordField(masterPasswordInput);

    const renderPasswordFeedback = () => {
        const analysis = analyzePassword(passwordInput.value, {
            personalValues: [usernameInput.value, emailInput.value]
        });

        const issues = analysis.vulnerabilities.length > 0
            ? `<div>${analysis.vulnerabilities.join(' ')}</div>`
            : '<div>Используйте длинный пароль со строчными и заглавными буквами, цифрами и спецсимволами.</div>';

        passwordFeedback.className = `auth-password-feedback ${analysis.isPolicyCompliant ? 'is-valid' : 'is-invalid'}`;
        passwordFeedback.innerHTML = `
            <strong>${analysis.strengthLabel}</strong>
            <div>${analysis.checks.map((check) => `${check.passed ? '✓' : '•'} ${check.label}`).join(' | ')}</div>
            ${issues}
        `;
    };

    renderPasswordFeedback();
    passwordInput.addEventListener('input', renderPasswordFeedback);
    usernameInput.addEventListener('input', renderPasswordFeedback);
    emailInput.addEventListener('input', renderPasswordFeedback);

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = passwordConfirm.value.trim();
        const email = emailInput.value.trim();
        const masterPassword = masterPasswordInput.value.trim();

        if (!username || !password || !email || !masterPassword) {
            showError('Заполните все поля');
            return;
        }

        if (username.length > USERNAME_MAX_LENGTH) {
            showError(`Имя пользователя должно быть не длиннее ${USERNAME_MAX_LENGTH} символов`);
            return;
        }

        if (email.length > EMAIL_MAX_LENGTH) {
            showError(`Email должен быть не длиннее ${EMAIL_MAX_LENGTH} символов`);
            return;
        }

        if (password.length > AUTH_PASSWORD_MAX_LENGTH || confirmPassword.length > AUTH_PASSWORD_MAX_LENGTH) {
            showError(`Пароль должен быть не длиннее ${AUTH_PASSWORD_MAX_LENGTH} символов`);
            return;
        }

        if (masterPassword.length < MASTER_PASSWORD_MIN_LENGTH) {
            showError(`Мастер-пароль должен быть не короче ${MASTER_PASSWORD_MIN_LENGTH} символов`);
            return;
        }

        if (masterPassword.length > MASTER_PASSWORD_MAX_LENGTH) {
            showError(`Мастер-пароль должен быть не длиннее ${MASTER_PASSWORD_MAX_LENGTH} символов`);
            return;
        }

        if (password !== confirmPassword) {
            showError('Введенные пароли не совпадают');
            return;
        }

        const analysis = analyzePassword(password, {
            personalValues: [username, email]
        });

        if (!analysis.isPolicyCompliant) {
            showError(analysis.vulnerabilities[0] || 'Пароль не соответствует требованиям сложности');
            return;
        }

        if (password === masterPassword) {
            showError('Пароль и мастер-пароль должны отличаться');
            return;
        }

        try {
            hideError();
            const salt = generateClientSalt();
            const verifier = await createMasterPasswordVerifier(masterPassword, salt);
            await register(username, email, password, salt, verifier);
            sessionStorage.setItem('pendingEmailConfirmation', email);
            window.location.href = `/confirm-email?email=${encodeURIComponent(email)}`;
        } catch (error: any) {
            showError(`Ошибка регистрации: ${getApiErrorMessage(error)}`);
        }
    });
});
