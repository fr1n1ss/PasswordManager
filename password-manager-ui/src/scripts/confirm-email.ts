import { confirmRegistrationEmail, resendRegistrationEmail } from '../services/api.ts';
import { navigateTo } from './routes.ts';

const EMAIL_MAX_LENGTH = 256;
const CONFIRMATION_CODE_LENGTH = 6;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('confirmEmailForm') as HTMLFormElement | null;
    const emailInput = document.getElementById('email') as HTMLInputElement | null;
    const codeInput = document.getElementById('code') as HTMLInputElement | null;
    const subtitle = document.getElementById('confirmEmailSubtitle') as HTMLParagraphElement | null;
    const resendButton = document.getElementById('resendCodeBtn') as HTMLButtonElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const errorMessage = document.getElementById('errorMessage') as HTMLParagraphElement | null;

    if (!form || !emailInput || !codeInput || !subtitle || !resendButton || !errorContainer || !errorMessage) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialEmail = params.get('email') || sessionStorage.getItem('pendingEmailConfirmation') || '';
    if (initialEmail) {
        emailInput.value = initialEmail;
        subtitle.textContent = `Введите код из письма, отправленного на ${initialEmail}.`;
        codeInput.focus();
    }

    emailInput.maxLength = EMAIL_MAX_LENGTH;
    codeInput.maxLength = CONFIRMATION_CODE_LENGTH;
    codeInput.addEventListener('input', () => {
        codeInput.value = codeInput.value.replace(/\D/g, '');
    });

    const showMessage = (message: string) => {
        errorContainer.style.display = 'block';
        errorMessage.textContent = message;
    };

    const hideMessage = () => {
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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const code = codeInput.value.trim();
        if (!email || !code) {
            showMessage('Введите email и код подтверждения');
            return;
        }

        if (email.length > EMAIL_MAX_LENGTH) {
            showMessage(`Email должен быть не длиннее ${EMAIL_MAX_LENGTH} символов`);
            return;
        }

        try {
            hideMessage();
            await confirmRegistrationEmail(email, code);
            sessionStorage.removeItem('pendingEmailConfirmation');
            showMessage('Email подтвержден. Сейчас перенаправим на вход.');
            window.setTimeout(() => navigateTo('login'), 900);
        } catch (error: any) {
            showMessage(`Ошибка подтверждения email: ${getApiErrorMessage(error)}`);
        }
    });

    resendButton.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
            showMessage('Введите email');
            return;
        }

        if (email.length > EMAIL_MAX_LENGTH) {
            showMessage(`Email должен быть не длиннее ${EMAIL_MAX_LENGTH} символов`);
            return;
        }

        try {
            hideMessage();
            await resendRegistrationEmail(email);
            showMessage('Код отправлен повторно.');
        } catch (error: any) {
            showMessage(`Ошибка повторной отправки: ${getApiErrorMessage(error)}`);
        }
    });
});
