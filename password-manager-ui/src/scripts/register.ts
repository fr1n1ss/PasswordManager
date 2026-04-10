import { register } from '../services/api.ts';
import { createMasterPasswordVerifier, generateClientSalt } from '../services/zero-knowledge.ts';
import { enhancePasswordField } from './password-visibility.ts';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm') as HTMLFormElement | null;
    const usernameInput = document.getElementById('username') as HTMLInputElement | null;
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    const passwordConfirm = document.getElementById('confirmPassword') as HTMLInputElement | null;
    const emailInput = document.getElementById('email') as HTMLInputElement | null;
    const masterPasswordInput = document.getElementById('masterPassword') as HTMLInputElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const errorMessage = document.getElementById('errorMessage') as HTMLParagraphElement | null;

    if (!registerForm || !usernameInput || !passwordInput || !passwordConfirm || !emailInput || !masterPasswordInput || !errorContainer || !errorMessage) {
        return;
    }

    enhancePasswordField(passwordInput);
    enhancePasswordField(passwordConfirm);
    enhancePasswordField(masterPasswordInput);

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

        if (password !== confirmPassword) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Введённые пароли не совпадают';
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
            window.location.href = './login-page.html';
        } catch (error: any) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Ошибка регистрации: ${error.message}`;
        }
    });
});
