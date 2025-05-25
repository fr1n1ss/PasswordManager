import {
    getUserFavorites,
    deleteAccount,
    deleteNote,
    updateAccount,
    updateNote,
    hashFavorites
} from '../services/api.ts';

async function hashData(data: any): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data));
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

interface Account {
    id: number;
    userID: number;
    serviceName: string;
    login: string;
    encryptedPassword: string;
    description: string;
    url: string;
    creationDate: string;
    isFavorite: boolean;
}

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
    isFavorite: boolean;
}

interface FavoritesResponse {
    accounts: Account[];
    notes: Note[];
}

function debounce(func: Function, delay: number) {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');
    if (usernameElement && username) usernameElement.textContent = username;
    if (emailElement && email) emailElement.textContent = email;

    const passwordCards = document.getElementById('passwordCards');
    const notesCards = document.getElementById('notesCards');
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    const searchInput = document.querySelector('.search-bar') as HTMLInputElement;
    const sortDropdown = document.querySelector('.sort-dropdown') as HTMLSelectElement;

    if (!passwordCards || !notesCards || !errorContainer || !errorMessage || !searchInput || !sortDropdown) {
        console.error('Required DOM elements are missing');
        return;
    }

    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    let favorites: FavoritesResponse;

    const filterFavorites = (favorites: FavoritesResponse, searchTerm: string): FavoritesResponse => {
        if (!searchTerm) return favorites;
        const filteredAccounts = favorites.accounts.filter(account =>
            account.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const filteredNotes = favorites.notes.filter(note =>
            note.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return { accounts: filteredAccounts, notes: filteredNotes };
    };

    const sortFavorites = (favorites: FavoritesResponse, sortBy: string): FavoritesResponse => {
        const sortedAccounts = [...favorites.accounts];
        const sortedNotes = [...favorites.notes];

        switch (sortBy) {
            case 'az':
                sortedAccounts.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
                sortedNotes.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'za':
                sortedAccounts.sort((a, b) => b.serviceName.localeCompare(a.serviceName));
                sortedNotes.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'oldest':
                sortedAccounts.sort((a, b) => new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime());
                sortedNotes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'newest':
                sortedAccounts.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                sortedNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }

        return { accounts: sortedAccounts, notes: sortedNotes };
    };

    const renderFavorites = (favorites: FavoritesResponse) => {
        passwordCards.innerHTML = favorites.accounts
            .map((account: Account) => {
                const logoUrl = account.url
                    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}`
                    : 'https://via.placeholder.com/32';
                return `
                    <div class="card" data-id="${account.id}">
                        <div class="card-logo">
                            <img src="${logoUrl}" alt="${account.serviceName} logo" />
                        </div>
                        <div class="card-details">
                            <h3>${account.serviceName}</h3>
                            <p>${account.login}</p>
                        </div>
                    </div>
                `;
            })
            .join('');

        notesCards.innerHTML = favorites.notes
            .map((note: Note) => `
                <div class="card" data-id="${note.id}">
                    <div class="card-logo"></div>
                    <div class="card-details">
                        <h3>${note.title}</h3>
                        <p>Создана: ${new Date(note.createdAt).toLocaleDateString('ru-RU')}</p>
                    </div>
                </div>
            `).join('');

        bindCardListeners();
    };

    const loadFavorites = async () => {
        try {
            favorites = await getUserFavorites(masterPassword) as FavoritesResponse;
            let filteredFavorites = filterFavorites(favorites, searchInput.value);
            filteredFavorites = sortFavorites(filteredFavorites, sortDropdown.value);
            renderFavorites(filteredFavorites);
            errorContainer.style.display = 'none';
        } catch (error: any) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Ошибка загрузки избранного: ${error.message}`;
            return;
        }
    };

    const bindCardListeners = () => {
        const accountCards = passwordCards.querySelectorAll('.card');
        accountCards.forEach(card => {
            const accountId = parseInt(card.getAttribute('data-id') || '0', 10);
            card.addEventListener('click', () => openAccountModal(accountId));
        });

        const noteCards = notesCards.querySelectorAll('.card');
        noteCards.forEach(card => {
            const noteId = parseInt(card.getAttribute('data-id') || '0', 10);
            card.addEventListener('click', () => openNoteModal(noteId));
        });
    };

    const syncFavorites = async () => {
        const masterPassword = sessionStorage.getItem('masterPassword');
        if (!masterPassword) return;

        try {
            const localFavorites: FavoritesResponse = favorites;
            const localHash = await hashData(localFavorites);
            const { favoritesHash } = await hashFavorites();

            if (localHash !== favoritesHash) {
                console.log('[sync] Избранное изменилось — обновляем');
                await loadFavorites();
            }
        } catch (error) {
            console.error('[syncFavorites] Ошибка синхронизации избранного:', error);
        }
    };

    await loadFavorites();

    const accountModalHtml = `
        <div id="account-modal" class="modal">
            <div class="modal-content">
                <h2 id="modal-service-name"></h2>
                <div class="modal-field">
                    <span class="modal-label">Логин:</span>
                    <span id="modal-login"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Пароль:</span>
                    <span id="modal-encrypted-password"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Описание:</span>
                    <span id="modal-description"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">URL:</span>
                    <span id="modal-url"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Дата создания:</span>
                    <span id="modal-creation-date"></span>
                </div>
                <button class="modal-update-btn" id="account-update-btn">Изменить</button>
                <button class="modal-delete-btn" id="account-delete-btn">Удалить</button>
                <button class="modal-close-btn">Закрыть</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', accountModalHtml);

    const noteModalHtml = `
        <div id="note-modal" class="modal">
            <div class="modal-content">
                <h2 id="modal-note-title"></h2>
                <div class="modal-field">
                    <span class="modal-label">Содержимое:</span>
                    <span id="modal-note-content"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Дата создания:</span>
                    <span id="modal-note-creation-date"></span>
                </div>
                <div class="modal-field">
                    <span class="modal-label">Дата обновления:</span>
                    <span id="modal-note-updated-date"></span>
                </div>
                <button class="modal-update-btn" id="note-update-btn">Изменить</button>
                <button class="modal-delete-btn" id="note-delete-btn">Удалить</button>
                <button class="modal-close-btn">Закрыть</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', noteModalHtml);

    let currentAccountId: number | null = null;
    const openAccountModal = (accountId: number) => {
        const account = favorites.accounts.find(acc => acc.id === accountId);
        if (!account) return;

        currentAccountId = accountId;

        const accountModal = document.getElementById('account-modal');
        const serviceName = document.getElementById('modal-service-name');
        const login = document.getElementById('modal-login');
        const encryptedPassword = document.getElementById('modal-encrypted-password');
        const description = document.getElementById('modal-description');
        const url = document.getElementById('modal-url');
        const creationDate = document.getElementById('modal-creation-date');
        if (!accountModal || !serviceName || !login || !encryptedPassword || !description || !url || !creationDate) return;

        serviceName.textContent = account.serviceName;
        login.textContent = account.login;
        encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
        description.textContent = account.description || 'Не указано';
        url.textContent = account.url || 'Не указан';
        creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU') || 'Не указана';

        accountModal.style.display = 'flex';
    };

    let currentNoteId: number | null = null;
    const openNoteModal = (noteId: number) => {
        const note = favorites.notes.find(n => n.id === noteId);
        if (!note) return;

        currentNoteId = noteId;

        const noteModal = document.getElementById('note-modal');
        const title = document.getElementById('modal-note-title');
        const content = document.getElementById('modal-note-content');
        const creationDate = document.getElementById('modal-note-creation-date');
        const updatedDate = document.getElementById('modal-note-updated-date');
        if (!noteModal || !title || !content || !creationDate || !updatedDate) return;

        title.textContent = note.title;
        content.textContent = note.encryptedContent;
        creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU') || 'Не указана';
        updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU') || 'Не указана';

        noteModal.style.display = 'flex';
    };

    const accountModal = document.getElementById('account-modal');
    const noteModal = document.getElementById('note-modal');
    if (!accountModal || !noteModal) return;

    const closeButtons = document.querySelectorAll('.modal-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            accountModal.style.display = 'none';
            noteModal.style.display = 'none';
            toggleAccountEditMode(false);
            toggleNoteEditMode(false);
        });
    });

    accountModal.addEventListener('click', (e) => {
        if (e.target === accountModal) {
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        }
    });

    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        }
    });

    const accountDeleteBtn = document.getElementById('account-delete-btn');
    if (accountDeleteBtn) {
        accountDeleteBtn.addEventListener('click', async () => {
            if (!currentAccountId) return;
            try {
                await deleteAccount(currentAccountId);
                accountModal.style.display = 'none';
                await loadFavorites();
            } catch (error: any) {
                alert('Ошибка при удалении аккаунта: ' + error.message);
            }
        });
    }

    const noteDeleteBtn = document.getElementById('note-delete-btn');
    if (noteDeleteBtn) {
        noteDeleteBtn.addEventListener('click', async () => {
            if (!currentNoteId) return;
            try {
                await deleteNote(currentNoteId);
                noteModal.style.display = 'none';
                await loadFavorites();
            } catch (error: any) {
                alert('Ошибка при удалении заметки: ' + error.message);
            }
        });
    }

    let isAccountEditMode = false;
    const accountUpdateBtn = document.getElementById('account-update-btn');
    const toggleAccountEditMode = (enable: boolean) => {
        isAccountEditMode = enable;
        const serviceName = document.getElementById('modal-service-name');
        const login = document.getElementById('modal-login');
        const encryptedPassword = document.getElementById('modal-encrypted-password');
        const description = document.getElementById('modal-description');
        const url = document.getElementById('modal-url');
        const creationDate = document.getElementById('modal-creation-date');
        if (!serviceName || !login || !encryptedPassword || !description || !url || !creationDate || !accountUpdateBtn) return;

        if (enable) {
            serviceName.innerHTML = `<input type="text" id="edit-service-name" value="${serviceName.textContent || ''}" />`;
            login.innerHTML = `<input type="text" id="edit-login" value="${login.textContent || ''}" />`;
            encryptedPassword.innerHTML = `<input type="text" id="edit-encrypted-password" value="${encryptedPassword.textContent || ''}" />`;
            description.innerHTML = `<textarea id="edit-description">${description.textContent || ''}</textarea>`;
            url.innerHTML = `<input type="text" id="edit-url" value="${url.textContent || ''}" />`;
            accountUpdateBtn.textContent = 'Сохранить';
        } else {
            const account = favorites.accounts.find(acc => acc.id === currentAccountId);
            if (account) {
                serviceName.textContent = account.serviceName;
                login.textContent = account.login;
                encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
                description.textContent = account.description || 'Не указано';
                url.textContent = account.url || 'Не указан';
                creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU') || 'Не указана';
            }
            accountUpdateBtn.textContent = 'Изменить';
        }
    };

    if (accountUpdateBtn) {
        accountUpdateBtn.addEventListener('click', async () => {
            if (!isAccountEditMode) {
                toggleAccountEditMode(true);
            } else if (currentAccountId) {
                const login = (document.getElementById('edit-login') as HTMLInputElement).value;
                const password = (document.getElementById('edit-encrypted-password') as HTMLInputElement).value;
                const serviceName = (document.getElementById('edit-service-name') as HTMLInputElement).value;
                const url = (document.getElementById('edit-url') as HTMLInputElement).value;
                const description = (document.getElementById('edit-description') as HTMLTextAreaElement).value;

                try {
                    await updateAccount({ id: currentAccountId, newLogin: login, newPassword: password, newURL: url, newDescription: description, newServiceName: serviceName, masterPassword });
                    await loadFavorites();
                    toggleAccountEditMode(false);
                } catch (error: any) {
                    alert('Ошибка при обновлении аккаунта: ' + error.message);
                }
            }
        });
    }

    let isNoteEditMode = false;
    const noteUpdateBtn = document.getElementById('note-update-btn');
    const toggleNoteEditMode = (enable: boolean) => {
        isNoteEditMode = enable;
        const title = document.getElementById('modal-note-title');
        const content = document.getElementById('modal-note-content');
        const creationDate = document.getElementById('modal-note-creation-date');
        const updatedDate = document.getElementById('modal-note-updated-date');
        if (!title || !content || !creationDate || !updatedDate || !noteUpdateBtn) return;

        if (enable) {
            title.innerHTML = `<input type="text" id="edit-note-title" value="${title.textContent || ''}" />`;
            content.innerHTML = `<textarea id="edit-note-content">${content.textContent || ''}</textarea>`;
            noteUpdateBtn.textContent = 'Сохранить';
        } else {
            const note = favorites.notes.find(n => n.id === currentNoteId);
            if (note) {
                title.textContent = note.title;
                content.textContent = note.encryptedContent;
                creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU') || 'Не указана';
                updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU') || 'Не указана';
            }
            noteUpdateBtn.textContent = 'Изменить';
        }
    };

    if (noteUpdateBtn) {
        noteUpdateBtn.addEventListener('click', async () => {
            if (!isNoteEditMode) {
                toggleNoteEditMode(true);
            } else if (currentNoteId) {
                const newTitle = (document.getElementById('edit-note-title') as HTMLInputElement).value;
                const newContent = (document.getElementById('edit-note-content') as HTMLTextAreaElement).value;
                try {
                    await updateNote(currentNoteId, newTitle, newContent, masterPassword);
                    await loadFavorites();
                    toggleNoteEditMode(false);
                } catch (error: any) {
                    alert('Ошибка при обновлении заметки: ' + error.message);
                }
            }
        });
    }

    const dropdown = document.querySelector('.profile-dropdown');
    const menu = document.getElementById('profileMenu');
    if (dropdown && menu) {
        dropdown.addEventListener('click', () => {
            const isMenuOpen = menu.style.display === 'block';
            menu.style.display = isMenuOpen ? 'none' : 'block';
            dropdown.textContent = isMenuOpen ? '▼' : '▲';
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target as Node) && !menu.contains(e.target as Node)) {
                menu.style.display = 'none';
                dropdown.textContent = '▼';
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            sessionStorage.removeItem('masterPassword');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('email');
            window.location.href = '/pages/login-page.html';
        });
    }

    const sidebar = document.getElementById('sidebar');
    const hideBtn = document.getElementById('hideBtn');
    if (sidebar && hideBtn) {
        hideBtn.addEventListener('click', () => {
            const isHidden = sidebar.classList.contains('hidden');
            sidebar.classList.toggle('hidden');
            hideBtn.textContent = isHidden ? '≪' : '≫';
        });
    }

    const debouncedSearch = debounce(async () => {
        let filteredFavorites = filterFavorites(favorites, searchInput.value);
        filteredFavorites = sortFavorites(filteredFavorites, sortDropdown.value);
        renderFavorites(filteredFavorites);
    }, 300);
    searchInput.addEventListener('input', debouncedSearch);

    const debouncedSort = debounce(async () => {
        let filteredFavorites = filterFavorites(favorites, searchInput.value);
        filteredFavorites = sortFavorites(filteredFavorites, sortDropdown.value);
        renderFavorites(filteredFavorites);
    }, 300);
    sortDropdown.addEventListener('change', debouncedSort);

    setInterval(syncFavorites, 10000);
});