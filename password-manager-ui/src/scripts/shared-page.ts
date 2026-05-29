import { logout, ping } from '../services/api.ts';
import { clearAuthToken, clearSensitiveSession, touchSensitiveSession } from '../services/security-session.ts';
import { navigateTo } from './routes.ts';

const FIELD_LIMITS: Record<string, number> = {
    username: 25,
    email: 256,
    'account-service-name': 450,
    'edit-service-name': 450,
    'account-login': 450,
    'edit-login': 450,
    'account-password': 512,
    'edit-encrypted-password': 512,
    'account-url': 2048,
    'edit-url': 2048,
    'account-description': 1000,
    'edit-description': 1000,
    'note-title': 100,
    'edit-note-title': 100,
    'note-content': 4000,
    'edit-note-content': 4000,
    generatorLength: 3,
    totpCodeInput: 6,
    'totp-code-input': 6
};

const NUMERIC_FIELD_IDS = new Set([
    'generatorLength',
    'totpCodeInput',
    'totp-code-input'
]);

export function applyFieldInputRules(root: ParentNode = document): void {
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field) => {
        const limit = FIELD_LIMITS[field.id];
        if (limit) {
            field.maxLength = limit;
        }

        if (NUMERIC_FIELD_IDS.has(field.id)) {
            field.inputMode = 'numeric';
            if (field instanceof HTMLInputElement) {
                field.pattern = '[0-9]*';
            }
            field.addEventListener('input', () => {
                field.value = field.value.replace(/\D/g, '');
            });
        }
    });
}

function disableAutocompleteOutsideLogin(): void {
    document.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
        form.setAttribute('autocomplete', 'off');
    });

    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field) => {
        if (field.autocomplete === 'one-time-code') {
            return;
        }

        if (field instanceof HTMLInputElement && field.type === 'password') {
            field.setAttribute('autocomplete', 'new-password');
        } else {
            field.setAttribute('autocomplete', 'off');
        }

        field.setAttribute('autocorrect', 'off');
        field.setAttribute('autocapitalize', 'off');
        field.spellcheck = false;
    });
}

export function initializeSharedPageShell(): void {
    const container = document.querySelector('.container') as HTMLElement | null;
    const titleElement = document.querySelector('.title') as HTMLElement | null;
    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');

    disableAutocompleteOutsideLogin();
    applyFieldInputRules();
    touchSensitiveSession();

    const activityEvents: Array<keyof DocumentEventMap> = ['click', 'keydown', 'pointerdown'];
    activityEvents.forEach((eventName) => {
        document.addEventListener(eventName, touchSensitiveSession, { passive: true });
    });

    if (usernameElement && username) {
        usernameElement.textContent = username;
    }

    if (emailElement && email) {
        emailElement.textContent = email;
    }

    if (titleElement) {
        titleElement.style.cursor = 'pointer';
        titleElement.addEventListener('click', () => {
            navigateTo('home');
        });
    }

    const profile = document.querySelector('.profile') as HTMLElement | null;
    const dropdown = document.querySelector('.profile-dropdown') as HTMLElement | null;
    const menu = document.getElementById('profileMenu');

    if (profile && dropdown && menu) {
        profile.addEventListener('click', (event) => {
            event.stopPropagation();
            const isMenuOpen = menu.style.display === 'block';
            menu.style.display = isMenuOpen ? 'none' : 'block';
            dropdown.textContent = isMenuOpen ? '\u25B2' : '\u25BC';
        });

        document.addEventListener('click', (event) => {
            if (!profile.contains(event.target as Node) && !menu.contains(event.target as Node)) {
                menu.style.display = 'none';
                dropdown.textContent = '\u25BC';
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', async () => {
        try {
            await logout();
        } catch {
            // Ignore logout request errors and still clear local auth state.
        } finally {
            clearAuthToken();
            clearSensitiveSession();
            navigateTo('login');
        }
    });

    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn?.addEventListener('click', () => {
        navigateTo('settings');
    });

    const sidebarList = document.querySelector('.sidebar ul');
    const passwordGeneratorLink = sidebarList?.querySelector<HTMLAnchorElement>('a[href="/password-generator"]');
    if (sidebarList && !passwordGeneratorLink) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = '/password-generator';
        link.dataset.navPasswordGenerator = 'true';
        link.textContent = 'Генератор паролей';

        if (window.location.pathname === '/password-generator') {
            link.classList.add('active');
        }

        item.appendChild(link);
        sidebarList.appendChild(item);
    }

    if (passwordGeneratorLink && window.location.pathname === '/password-generator') {
        passwordGeneratorLink.classList.add('active');
    }

    const sidebar = document.getElementById('sidebar');
    const hideBtn = document.getElementById('hideBtn');
    if (container && sidebar && hideBtn) {
        const renderSidebarToggle = () => {
            const isHidden = container.classList.contains('sidebar-collapsed');
            hideBtn.textContent = '';
            hideBtn.setAttribute('aria-label', isHidden ? 'Показать боковое меню' : 'Скрыть боковое меню');
        };

        renderSidebarToggle();

        hideBtn.addEventListener('click', () => {
            container.classList.toggle('sidebar-collapsed');
            sidebar.classList.toggle('hidden');
            renderSidebarToggle();
        });
    }

    window.setInterval(() => {
        void ping().catch(() => {
            // The API response interceptor handles expired or revoked sessions.
        });
    }, 15000);
}
