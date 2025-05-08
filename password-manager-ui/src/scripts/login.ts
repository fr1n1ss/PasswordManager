import { login } from '../services/api.ts';

console.log('Login script loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up login handler...');

    const loginForm = document.getElementById('loginForm') as HTMLFormElement;
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const errorContainer = document.getElementById('errorContainer')!;
    const errorMessage = document.getElementById('errorMessage')!;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Введите имя пользователя и пароль';
            return;
        }

        try {
            const token = await login(username, password);
            console.log('Login successful, token:', token);
            localStorage.setItem('token', token);

            const modal = document.getElementById('master-password-modal')!;
            modal.style.display = 'block';
            console.log('Opening master password modal');

            (window as any).submitMasterPassword = () => {
                const masterPassword = (document.getElementById('master-password-input') as HTMLInputElement).value;
                if (!masterPassword) {
                    errorMessage.textContent = 'Мастер-пароль не введён';
                    return;
                }
                console.log('Master password submitted:', masterPassword);
                sessionStorage.setItem('masterPassword', masterPassword);
                modal.style.display = 'none';
                window.location.href = 'index.html';
            };
        } catch (error: any) {
            console.error('Login failed:', error.message, error.response?.status, error.response?.data);
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Ошибка авторизации: ${error.message} (Статус: ${error.response?.status})`;
        }
    });
});
