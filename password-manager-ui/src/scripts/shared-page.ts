export function initializeSharedPageShell(): void {
    const container = document.querySelector('.container') as HTMLElement | null;
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

    const profile = document.querySelector('.profile') as HTMLElement | null;
    const dropdown = document.querySelector('.profile-dropdown') as HTMLElement | null;
    const menu = document.getElementById('profileMenu');

    if (profile && dropdown && menu) {
        profile.addEventListener('click', (event) => {
            event.stopPropagation();
            const isMenuOpen = menu.style.display === 'block';
            menu.style.display = isMenuOpen ? 'none' : 'block';
            dropdown.textContent = isMenuOpen ? '▼' : '▲';
        });

        document.addEventListener('click', (event) => {
            if (!profile.contains(event.target as Node) && !menu.contains(event.target as Node)) {
                menu.style.display = 'none';
                dropdown.textContent = '▼';
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('token');
        sessionStorage.clear();
        window.location.href = '/pages/login-page.html';
    });

    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn?.addEventListener('click', () => {
        window.location.href = '/pages/settings-page.html';
    });

    const sidebar = document.getElementById('sidebar');
    const hideBtn = document.getElementById('hideBtn');
    if (container && sidebar && hideBtn) {
        const renderSidebarToggle = () => {
            const isHidden = container.classList.contains('sidebar-collapsed');
            hideBtn.textContent = isHidden ? '≡' : '‹';
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
