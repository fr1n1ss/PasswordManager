export function initializeSharedPageShell(): void {
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

    const dropdown = document.querySelector('.profile-dropdown') as HTMLElement | null;
    const menu = document.getElementById('profileMenu');

    if (dropdown && menu) {
        dropdown.addEventListener('click', () => {
            const isMenuOpen = menu.style.display === 'block';
            menu.style.display = isMenuOpen ? 'none' : 'block';
            dropdown.textContent = isMenuOpen ? '▼' : '▲';
        });

        document.addEventListener('click', (event) => {
            if (!dropdown.contains(event.target as Node) && !menu.contains(event.target as Node)) {
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

    const sidebar = document.getElementById('sidebar');
    const hideBtn = document.getElementById('hideBtn');
    if (sidebar && hideBtn) {
        hideBtn.addEventListener('click', () => {
            const isHidden = sidebar.classList.contains('hidden');
            sidebar.classList.toggle('hidden');
            hideBtn.textContent = isHidden ? '≪' : '≫';
        });
    }
}
