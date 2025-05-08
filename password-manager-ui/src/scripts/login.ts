import { login } from '../services/api.ts';

console.log('Login script loaded');

document.addEventListener('DOMContentLoaded', () => {
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
            localStorage.setItem('token', token);

            // После успешного логина переходим на загрузку, установив флаг
            sessionStorage.setItem('awaitingMasterPassword', 'true');
            window.location.href = '/pages/loading-page.html';
        } catch (error: any) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Ошибка авторизации: ${error.message}`;
        }
    });
});
