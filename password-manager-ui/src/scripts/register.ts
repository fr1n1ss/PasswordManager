import { register } from '../services/api.ts';
import { analyzePassword } from '../services/password-security.ts';
import { createMasterPasswordVerifier, generateClientSalt } from '../services/zero-knowledge.ts';
import { enhancePasswordField } from './password-visibility.ts';
import { navigateTo } from './routes.ts';

const USERNAME_MAX_LENGTH = 25;

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

    registerForm.setAttribute('autocomplete', 'off');
    [usernameInput, emailInput].forEach((input) => {
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.spellcheck = false;
    });
    usernameInput.maxLength = USERNAME_MAX_LENGTH;
    [passwordInput, passwordConfirm, masterPasswordInput].forEach((input) => {
        input.setAttribute('autocomplete', 'new-password');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.spellcheck = false;
    });

    enhancePasswordField(passwordInput);
    enhancePasswordField(passwordConfirm);
    enhancePasswordField(masterPasswordInput);

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
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Заполните все поля';
            return;
        }

        if (username.length > USERNAME_MAX_LENGTH) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Имя пользователя должно быть не длиннее ${USERNAME_MAX_LENGTH} символов`;
            return;
        }

        if (password !== confirmPassword) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Введённые пароли не совпадают';
            return;
        }

        const analysis = analyzePassword(password, {
            personalValues: [username, email]
        });

        if (!analysis.isPolicyCompliant) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = analysis.vulnerabilities[0] || 'Пароль не соответствует требованиям сложности';
            return;
        }

        if (password === masterPassword) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Пароль и мастер-пароль должны отличаться';
            return;
        }

        try {
            const salt = generateClientSalt();
            const verifier = await createMasterPasswordVerifier(masterPassword, salt);
            await register(username, email, password, salt, verifier);
            alert('Регистрация прошла успешно');
            navigateTo('login');
        } catch (error: any) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Ошибка регистрации: ${getApiErrorMessage(error)}`;
        }
    });
});
