import { getUserFavorites, deleteAccount, deleteNote, updateAccount, updateNote } from '../services/api.ts';

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
    if (!passwordCards || !notesCards || !errorContainer || !errorMessage) return;

    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    let favorites: FavoritesResponse;
    try {
        favorites = await getUserFavorites(masterPassword) as FavoritesResponse;
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

        errorContainer.style.display = 'none';

        // Привязываем обработчики событий для карточек
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
        bindCardListeners();
    } catch (error: any) {
        errorContainer.style.display = 'block';
        errorMessage.textContent = `Ошибка загрузки избранного: ${error.message}`;
        return;
    }

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
                favorites = await getUserFavorites(masterPassword) as FavoritesResponse;
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
                favorites = await getUserFavorites(masterPassword) as FavoritesResponse;
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
                    const accountIndex = favorites.accounts.findIndex(acc => acc.id === currentAccountId);
                    if (accountIndex !== -1) {
                        favorites.accounts[accountIndex] = {
                            ...favorites.accounts[accountIndex],
                            serviceName,
                            login,
                            encryptedPassword: password,
                            description,
                            url,
                        };
                    }
                    toggleAccountEditMode(false);
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
                    const noteIndex = favorites.notes.findIndex(n => n.id === currentNoteId);
                    if (noteIndex !== -1) {
                        favorites.notes[noteIndex] = { ...favorites.notes[noteIndex], title: newTitle, encryptedContent: newContent };
                    }
                    toggleNoteEditMode(false);
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
});