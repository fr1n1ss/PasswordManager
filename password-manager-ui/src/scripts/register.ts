import { register } from '../services/api.ts';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm') as HTMLFormElement;
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const passwordConfirm = document.getElementById('confirmPassword') as HTMLInputElement;
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const masterPasswordInput = document.getElementById('masterPassword') as HTMLInputElement;
    const errorContainer = document.getElementById('errorContainer')!;
    const errorMessage = document.getElementById('errorMessage')!;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

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

        if(password !== confirmPassword){
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Введённые пароли не совпадают';
            return
        }

        if(password === masterPassword){
            errorContainer.style.display = 'block';
            errorMessage.textContent = 'Пароль и мастер-пароль должны отличаться';
            return
        }

        try {
            await register(username, email, password, masterPassword);
            alert('Регистрация прошла успешно!');
            window.location.href = 'login.html';
        } catch (error: any) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Ошибка регистрации: ${error.message}`;
        }
    });
});
