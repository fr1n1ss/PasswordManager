import { logout } from '../services/api.ts';
import { navigateTo } from './routes.ts';

export function initializeSharedPageShell(): void {
    const container = document.querySelector('.container') as HTMLElement | null;
    const titleElement = document.querySelector('.title') as HTMLElement | null;
    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');

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
            dropdown.textContent = isMenuOpen ? '\u25BC' : '\u25B2';
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
            localStorage.removeItem('token');
            sessionStorage.clear();
            navigateTo('login');
        }
    });

    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn?.addEventListener('click', () => {
        navigateTo('settings');
    });

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
}
