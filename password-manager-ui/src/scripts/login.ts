import { login } from '../services/api.ts';
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

            const modal = document.getElementById('master-password-modal')!;
            modal.style.display = 'block';

            (window as any).submitMasterPassword = null;
            (window as any).cancelMasterPassword = null;

            (window as any).submitMasterPassword = () => {
                const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
                const masterPassword = masterPasswordInput.value.trim();
                if (!masterPassword) {
                    errorMessage.textContent = 'Мастер-пароль не введён';
                    errorContainer.style.display = 'block';
                    return;
                }
                sessionStorage.setItem('masterPassword', masterPassword);
                modal.style.display = 'none';
                masterPasswordInput.value = '';

                sessionStorage.removeItem('isDataLoaded');
                sessionStorage.removeItem('username');
                sessionStorage.removeItem('email');
                sessionStorage.removeItem('accounts');
                sessionStorage.removeItem('notes');

                window.location.href = '/pages/loading-page.html';
            };

            (window as any).cancelMasterPassword = () => {
                modal.style.display = 'none';
                const masterPasswordInput = document.getElementById('master-password-input') as HTMLInputElement;
                masterPasswordInput.value = '';
                errorContainer.style.display = 'block';
                errorMessage.textContent = 'Ввод мастер-пароля отменён. Пожалуйста, войдите снова.';
                localStorage.removeItem('token');
            };

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    (window as any).cancelMasterPassword();
                }
            });
        } catch (error: any) {
            if (!error.response && (error.message.includes('Network') || error.message.includes('Failed to fetch'))) {
                errorContainer.style.display = 'block';
                errorMessage.textContent = 'Ошибка сети. Перенаправляем на страницу загрузки...';
                setTimeout(() => window.location.href = '/pages/loading-page.html', 2000);
            } else {
                errorContainer.style.display = 'block';
                errorMessage.textContent = `Ошибка авторизации: ${error.message} (Статус: ${error.response?.status})`;
            }
        }
    });
});