import {
    getUserFavorites,
    deleteAccount,
    deleteNote,
    updateAccount,
    updateNote
} from '../services/api.ts';
import { initializeSharedPageShell } from './shared-page.ts';

interface Account {
    id: number;
    userID: number;
    serviceName: string;
    login: string;
    encryptedPassword: string;
    description: string;
    url: string;
    creationDate: string;
}

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
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
    initializeSharedPageShell();

    const passwordCards = document.getElementById('passwordCards') as HTMLDivElement | null;
    const notesCards = document.getElementById('notesCards') as HTMLDivElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const errorMessage = document.getElementById('errorMessage') as HTMLDivElement | null;
    const searchInput = document.querySelector('.search-bar') as HTMLInputElement | null;
    const sortDropdown = document.querySelector('.sort-dropdown') as HTMLSelectElement | null;

    if (!passwordCards || !notesCards || !errorContainer || !errorMessage || !searchInput || !sortDropdown) {
        return;
    }

    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    let favorites: FavoritesResponse = { accounts: [], notes: [] };
    let currentAccountId: number | null = null;
    let currentNoteId: number | null = null;
    let isAccountEditMode = false;
    let isNoteEditMode = false;

    const syncSharedAccount = (account: Account) => {
        const accounts = JSON.parse(sessionStorage.getItem('accounts') || '[]') as Account[];
        const accountIndex = accounts.findIndex(item => item.id === account.id);
        if (accountIndex !== -1) {
            accounts[accountIndex] = { ...accounts[accountIndex], ...account };
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
        }
    };

    const syncSharedNote = (note: Note) => {
        const notes = JSON.parse(sessionStorage.getItem('notes') || '[]') as Note[];
        const noteIndex = notes.findIndex(item => item.id === note.id);
        if (noteIndex !== -1) {
            notes[noteIndex] = { ...notes[noteIndex], ...note };
            sessionStorage.setItem('notes', JSON.stringify(notes));
        }
    };

    const removeSharedAccount = (accountId: number) => {
        const accounts = JSON.parse(sessionStorage.getItem('accounts') || '[]') as Account[];
        sessionStorage.setItem('accounts', JSON.stringify(accounts.filter(account => account.id !== accountId)));
    };

    const removeSharedNote = (noteId: number) => {
        const notes = JSON.parse(sessionStorage.getItem('notes') || '[]') as Note[];
        sessionStorage.setItem('notes', JSON.stringify(notes.filter(note => note.id !== noteId)));
    };

    const updateStoredAccount = (accountId: number, patch: Partial<Account>) => {
        favorites.accounts = favorites.accounts.map(account => account.id === accountId ? { ...account, ...patch } : account);
        const updated = favorites.accounts.find(account => account.id === accountId);
        if (updated) {
            syncSharedAccount(updated);
        }
    };

    const updateStoredNote = (noteId: number, patch: Partial<Note>) => {
        favorites.notes = favorites.notes.map(note => note.id === noteId ? { ...note, ...patch } : note);
        const updated = favorites.notes.find(note => note.id === noteId);
        if (updated) {
            syncSharedNote(updated);
        }
    };

    const removeStoredAccount = (accountId: number) => {
        favorites.accounts = favorites.accounts.filter(account => account.id !== accountId);
        removeSharedAccount(accountId);
    };

    const removeStoredNote = (noteId: number) => {
        favorites.notes = favorites.notes.filter(note => note.id !== noteId);
        removeSharedNote(noteId);
    };

    const filterFavorites = (source: FavoritesResponse): FavoritesResponse => {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
            return source;
        }

        return {
            accounts: source.accounts.filter(account => account.serviceName.toLowerCase().includes(term)),
            notes: source.notes.filter(note => note.title.toLowerCase().includes(term))
        };
    };

    const sortFavorites = (source: FavoritesResponse): FavoritesResponse => {
        const sortedAccounts = [...source.accounts];
        const sortedNotes = [...source.notes];

        switch (sortDropdown.value) {
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

    const renderFavorites = () => {
        const visibleFavorites = sortFavorites(filterFavorites(favorites));

        passwordCards.innerHTML = visibleFavorites.accounts.map((account) => {
            const logoUrl = account.url
                ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}`
                : 'https://via.placeholder.com/32';

            return `
                <div class="card" data-account-id="${account.id}">
                    <div class="card-logo">
                        <img src="${logoUrl}" alt="${account.serviceName} logo" />
                    </div>
                    <div class="card-details">
                        <h3>${account.serviceName}</h3>
                        <p>${account.login}</p>
                    </div>
                </div>
            `;
        }).join('');

        notesCards.innerHTML = visibleFavorites.notes.map((note) => `
            <div class="card" data-note-id="${note.id}">
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
            renderFavorites();
            errorContainer.style.display = 'none';
        } catch (error: any) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `Ошибка загрузки избранного: ${error.message}`;
        }
    };

    const bindCardListeners = () => {
        passwordCards.querySelectorAll<HTMLElement>('.card[data-account-id]').forEach(card => {
            card.addEventListener('click', () => openAccountModal(Number(card.dataset.accountId)));
        });

        notesCards.querySelectorAll<HTMLElement>('.card[data-note-id]').forEach(card => {
            card.addEventListener('click', () => openNoteModal(Number(card.dataset.noteId)));
        });
    };

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

    document.body.insertAdjacentHTML('beforeend', accountModalHtml);
    document.body.insertAdjacentHTML('beforeend', noteModalHtml);

    const accountModal = document.getElementById('account-modal') as HTMLDivElement;
    const noteModal = document.getElementById('note-modal') as HTMLDivElement;
    const accountUpdateBtn = document.getElementById('account-update-btn') as HTMLButtonElement;
    const noteUpdateBtn = document.getElementById('note-update-btn') as HTMLButtonElement;

    const toggleAccountEditMode = (enable: boolean) => {
        isAccountEditMode = enable;
        const serviceName = document.getElementById('modal-service-name') as HTMLElement;
        const login = document.getElementById('modal-login') as HTMLElement;
        const encryptedPassword = document.getElementById('modal-encrypted-password') as HTMLElement;
        const description = document.getElementById('modal-description') as HTMLElement;
        const url = document.getElementById('modal-url') as HTMLElement;
        const creationDate = document.getElementById('modal-creation-date') as HTMLElement;

        if (enable) {
            serviceName.innerHTML = `<input type="text" id="edit-service-name" value="${serviceName.textContent || ''}" />`;
            login.innerHTML = `<input type="text" id="edit-login" value="${login.textContent || ''}" />`;
            encryptedPassword.innerHTML = `<input type="text" id="edit-encrypted-password" value="${encryptedPassword.textContent || ''}" />`;
            description.innerHTML = `<textarea id="edit-description">${description.textContent || ''}</textarea>`;
            url.innerHTML = `<input type="text" id="edit-url" value="${url.textContent || ''}" />`;
            accountUpdateBtn.textContent = 'Сохранить';
            return;
        }

        const account = favorites.accounts.find(item => item.id === currentAccountId);
        if (account) {
            serviceName.textContent = account.serviceName;
            login.textContent = account.login;
            encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
            description.textContent = account.description || 'Не указано';
            url.textContent = account.url || 'Не указан';
            creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU');
        }
        accountUpdateBtn.textContent = 'Изменить';
    };

    const toggleNoteEditMode = (enable: boolean) => {
        isNoteEditMode = enable;
        const title = document.getElementById('modal-note-title') as HTMLElement;
        const content = document.getElementById('modal-note-content') as HTMLElement;
        const creationDate = document.getElementById('modal-note-creation-date') as HTMLElement;
        const updatedDate = document.getElementById('modal-note-updated-date') as HTMLElement;

        if (enable) {
            title.innerHTML = `<input type="text" id="edit-note-title" value="${title.textContent || ''}" />`;
            content.innerHTML = `<textarea id="edit-note-content">${content.textContent || ''}</textarea>`;
            noteUpdateBtn.textContent = 'Сохранить';
            return;
        }

        const note = favorites.notes.find(item => item.id === currentNoteId);
        if (note) {
            title.textContent = note.title;
            content.textContent = note.encryptedContent;
            creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU');
            updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU');
        }
        noteUpdateBtn.textContent = 'Изменить';
    };

    const openAccountModal = (accountId: number) => {
        const account = favorites.accounts.find(item => item.id === accountId);
        if (!account) {
            return;
        }

        currentAccountId = accountId;
        (document.getElementById('modal-service-name') as HTMLElement).textContent = account.serviceName;
        (document.getElementById('modal-login') as HTMLElement).textContent = account.login;
        (document.getElementById('modal-encrypted-password') as HTMLElement).textContent = account.encryptedPassword || 'Не указан';
        (document.getElementById('modal-description') as HTMLElement).textContent = account.description || 'Не указано';
        (document.getElementById('modal-url') as HTMLElement).textContent = account.url || 'Не указан';
        (document.getElementById('modal-creation-date') as HTMLElement).textContent = new Date(account.creationDate).toLocaleString('ru-RU');
        accountModal.style.display = 'flex';
    };

    const openNoteModal = (noteId: number) => {
        const note = favorites.notes.find(item => item.id === noteId);
        if (!note) {
            return;
        }

        currentNoteId = noteId;
        (document.getElementById('modal-note-title') as HTMLElement).textContent = note.title;
        (document.getElementById('modal-note-content') as HTMLElement).textContent = note.encryptedContent;
        (document.getElementById('modal-note-creation-date') as HTMLElement).textContent = new Date(note.createdAt).toLocaleString('ru-RU');
        (document.getElementById('modal-note-updated-date') as HTMLElement).textContent = new Date(note.updatedAt).toLocaleString('ru-RU');
        noteModal.style.display = 'flex';
    };

    document.querySelectorAll('.modal-close-btn').forEach(button => {
        button.addEventListener('click', () => {
            accountModal.style.display = 'none';
            noteModal.style.display = 'none';
            toggleAccountEditMode(false);
            toggleNoteEditMode(false);
        });
    });

    accountModal.addEventListener('click', (event) => {
        if (event.target === accountModal) {
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        }
    });

    noteModal.addEventListener('click', (event) => {
        if (event.target === noteModal) {
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        }
    });

    (document.getElementById('account-delete-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!currentAccountId) {
            return;
        }

        try {
            await deleteAccount(currentAccountId);
            removeStoredAccount(currentAccountId);
            accountModal.style.display = 'none';
            renderFavorites();
        } catch (error: any) {
            alert(`Ошибка при удалении аккаунта: ${error.message}`);
        }
    });

    (document.getElementById('note-delete-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!currentNoteId) {
            return;
        }

        try {
            await deleteNote(currentNoteId);
            removeStoredNote(currentNoteId);
            noteModal.style.display = 'none';
            renderFavorites();
        } catch (error: any) {
            alert(`Ошибка при удалении заметки: ${error.message}`);
        }
    });

    accountUpdateBtn.addEventListener('click', async () => {
        if (!isAccountEditMode) {
            toggleAccountEditMode(true);
            return;
        }

        if (!currentAccountId) {
            return;
        }

        const patch = {
            serviceName: (document.getElementById('edit-service-name') as HTMLInputElement).value,
            login: (document.getElementById('edit-login') as HTMLInputElement).value,
            encryptedPassword: (document.getElementById('edit-encrypted-password') as HTMLInputElement).value,
            description: (document.getElementById('edit-description') as HTMLTextAreaElement).value,
            url: (document.getElementById('edit-url') as HTMLInputElement).value
        };

        try {
            await updateAccount({
                id: currentAccountId,
                newLogin: patch.login,
                newPassword: patch.encryptedPassword,
                newURL: patch.url,
                newDescription: patch.description,
                newServiceName: patch.serviceName,
                masterPassword
            });
            updateStoredAccount(currentAccountId, patch);
            toggleAccountEditMode(false);
            renderFavorites();
        } catch (error: any) {
            alert(`Ошибка при обновлении аккаунта: ${error.message}`);
        }
    });

    noteUpdateBtn.addEventListener('click', async () => {
        if (!isNoteEditMode) {
            toggleNoteEditMode(true);
            return;
        }

        if (!currentNoteId) {
            return;
        }

        const patch = {
            title: (document.getElementById('edit-note-title') as HTMLInputElement).value,
            encryptedContent: (document.getElementById('edit-note-content') as HTMLTextAreaElement).value,
            updatedAt: new Date().toISOString()
        };

        try {
            await updateNote(currentNoteId, patch.title, patch.encryptedContent, masterPassword);
            updateStoredNote(currentNoteId, patch);
            toggleNoteEditMode(false);
            renderFavorites();
        } catch (error: any) {
            alert(`Ошибка при обновлении заметки: ${error.message}`);
        }
    });

    searchInput.addEventListener('input', debounce(renderFavorites, 300));
    sortDropdown.addEventListener('change', debounce(renderFavorites, 300));

    await loadFavorites();
});
