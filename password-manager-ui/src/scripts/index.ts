import { getAccounts, getUserNotes, deleteAccount, deleteNote, updateAccount, updateNote, addAccount, addNote, getAccountById, addToFavorites, removeFromFavorites, isFavorite, hashAll } from '../services/api.ts';
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
    isFavorite?: boolean;
}

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
    isFavorite?: boolean;
}

document.addEventListener('DOMContentLoaded', async () => {
    const isDataLoaded = sessionStorage.getItem('isDataLoaded');
    if (!isDataLoaded) {
        window.location.href = '/pages/loading-page.html';
        return;
    }

    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');
    if (usernameElement && username) usernameElement.textContent = username;
    if (emailElement && email) emailElement.textContent = email;

    const passwordCards = document.getElementById('passwordCards');
    const notesCards = document.getElementById('notesCards');
    const errorContainer = document.getElementById('errorContainer');
    const fabButton = document.getElementById('fabButton');
    const addChoiceModal = document.getElementById('add-choice-modal');
    const addAccountModal = document.getElementById('add-account-modal');
    const addNoteModal = document.getElementById('add-note-modal');
    const chooseAccountBtn = document.getElementById('chooseAccount');
    const chooseNoteBtn = document.getElementById('chooseNote');
    const cancelAccountBtn = document.getElementById('cancel-account');
    const cancelNoteBtn = document.getElementById('cancel-note');
    const submitAccountBtn = document.getElementById('submit-account');
    const submitNoteBtn = document.getElementById('submit-note');
    const accountError = document.getElementById('account-error');
    const noteError = document.getElementById('note-error');
    const accountModal = document.getElementById('account-modal');
    const noteModal = document.getElementById('note-modal');

    if (!passwordCards || !notesCards || !errorContainer || !fabButton || !addChoiceModal || !addAccountModal || !addNoteModal || !chooseAccountBtn || !chooseNoteBtn || !cancelAccountBtn || !cancelNoteBtn || !submitAccountBtn || !submitNoteBtn || !accountError || !noteError || !accountModal || !noteModal) {
        return;
    }

    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    const syncData = async () => {
        const masterPassword = sessionStorage.getItem('masterPassword');
        if (!masterPassword) return;

        try {
            const cachedAccounts = JSON.parse(sessionStorage.getItem('accounts') || '[]');
            const cachedNotes = JSON.parse(sessionStorage.getItem('notes') || '[]');

            const localAccountsHash = await hashData(cachedAccounts);
            const localNotesHash = await hashData(cachedNotes);

            const { accountsHash, notesHash } = await hashAll();

            if (localAccountsHash !== accountsHash) {
                const updatedAccounts = await getAccounts(masterPassword);
                sessionStorage.setItem('accounts', JSON.stringify(updatedAccounts));
                await loadAccounts();
                console.log('[sync] Accounts обновлены');
            }

            if (localNotesHash !== notesHash) {
                const updatedNotes = await getUserNotes(masterPassword);
                sessionStorage.setItem('notes', JSON.stringify(updatedNotes));
                await loadNotes();
                console.log('[sync] Notes обновлены');
            }
        } catch (err) {
            console.error('[syncData] Ошибка синхронизации:', err);
        }
    };

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    const loadAccounts = async () => {
        try {
            let accounts: Account[] = [];
            const accountsStr = sessionStorage.getItem('accounts');
            if (accountsStr) {
                accounts = JSON.parse(accountsStr);
            } else {
                accounts = await getAccounts(masterPassword) as Account[];
                sessionStorage.setItem('accounts', JSON.stringify(accounts));
            }

            if (accounts.length === 0) {
                passwordCards.innerHTML = '<div class="add-new-card">+</div>';
            } else {
                const accountsWithFavorite = await Promise.all(accounts.map(async (account) => {
                    const fav = await isFavorite('account', account.id).catch(() => false);
                    return { ...account, isFavorite: fav };
                }));
                passwordCards.innerHTML = accountsWithFavorite
                    .map((account) => `
                        <div class="card" data-id="${account.id}">
                            <div class="card-logo"><img src="${account.url ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}` : 'https://via.placeholder.com/32'}" alt="${account.serviceName} logo" /></div>
                            <div class="card-details"><h3>${account.serviceName}</h3><p>${account.login}</p></div>
                        </div>
                    `)
                    .join('') + '<div class="add-new-card">+</div>';
                bindCardListeners();
            }
        } catch (error) {
            passwordCards.innerHTML = '<div class="add-new-card">+</div>';
            bindCardListeners();
        }
    };

    const loadNotes = async () => {
        try {
            let notes: Note[] = [];
            const notesStr = sessionStorage.getItem('notes');
            if (notesStr) {
                notes = JSON.parse(notesStr);
            } else {
                notes = await getUserNotes(masterPassword) as Note[];
                sessionStorage.setItem('notes', JSON.stringify(notes));
            }

            if (notes.length === 0) {
                notesCards.innerHTML = '<div class="add-new-card">+</div>';
            } else {
                const notesWithFavorite = await Promise.all(notes.map(async (note) => {
                    const fav = await isFavorite('note', note.id).catch(() => false);
                    return { ...note, isFavorite: fav };
                }));
                notesCards.innerHTML = notesWithFavorite
                    .map((note) => `
                        <div class="card" data-id="${note.id}">
                            <div class="card-logo"></div>
                            <div class="card-details"><h3>${note.title}</h3><p>Создана: ${new Date(note.createdAt).toLocaleDateString('ru-RU')}</p></div>
                        </div>
                    `)
                    .join('') + '<div class="add-new-card">+</div>';
                bindCardListeners();
            }
        } catch (error) {
            notesCards.innerHTML = '<div class="add-new-card">+</div>';
            bindCardListeners();
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

        const addAccountCards = passwordCards.querySelectorAll('.add-new-card');
        addAccountCards.forEach(card => card.addEventListener('click', () => {
            closeAllModals();
            addAccountModal.style.display = 'flex';
        }));

        const addNoteCards = notesCards.querySelectorAll('.add-new-card');
        addNoteCards.forEach(card => card.addEventListener('click', () => {
            closeAllModals();
            addNoteModal.style.display = 'flex';
        }));
    };

    await Promise.all([loadAccounts(), loadNotes()]);
    errorContainer.style.display = 'none';

    let currentAccountId: number | null = null;
    let currentNoteId: number | null = null;

    const closeAllModals = () => {
        [addChoiceModal, addAccountModal, addNoteModal, accountModal, noteModal].forEach(modal => {
            modal.style.display = 'none';
            const accountFavBtn = document.getElementById('account-favorite-btn');
            const noteFavBtn = document.getElementById('note-favorite-btn');
            if (accountFavBtn) {
                accountFavBtn.textContent = '';
                accountFavBtn.innerHTML = '';
            }
            if (noteFavBtn) {
                noteFavBtn.textContent = '';
                noteFavBtn.innerHTML = '';
            }
        });
        accountError.style.display = 'none';
        noteError.style.display = 'none';
    };

    fabButton.addEventListener('click', () => {
        closeAllModals();
        addChoiceModal.style.display = 'flex';
    });

    chooseAccountBtn.addEventListener('click', () => {
        closeAllModals();
        addAccountModal.style.display = 'flex';
    });

    chooseNoteBtn.addEventListener('click', () => {
        closeAllModals();
        addNoteModal.style.display = 'flex';
    });

    [addChoiceModal, addAccountModal, addNoteModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAllModals();
        });
    });

    cancelAccountBtn.addEventListener('click', () => {
        closeAllModals();
        (document.getElementById('account-service-name') as HTMLInputElement).value = '';
        (document.getElementById('account-login') as HTMLInputElement).value = '';
        (document.getElementById('account-password') as HTMLInputElement).value = '';
        (document.getElementById('account-description') as HTMLTextAreaElement).value = '';
        (document.getElementById('account-url') as HTMLTextAreaElement).value = '';
    });

    cancelNoteBtn.addEventListener('click', () => {
        closeAllModals();
        (document.getElementById('note-title') as HTMLInputElement).value = '';
        (document.getElementById('note-content') as HTMLTextAreaElement).value = '';
    });

    submitAccountBtn.addEventListener('click', async () => {
        const serviceName = (document.getElementById('account-service-name') as HTMLInputElement).value.trim();
        const login = (document.getElementById('account-login') as HTMLInputElement).value.trim();
        const password = (document.getElementById('account-password') as HTMLInputElement).value.trim();
        const description = (document.getElementById('account-description') as HTMLTextAreaElement).value.trim();
        const url = (document.getElementById('account-url') as HTMLTextAreaElement).value.trim();

        if (!serviceName || !login || !password) {
            accountError.style.display = 'block';
            accountError.textContent = 'Заполните все обязательные поля';
            return;
        }

        try {
            const newAccount = await addAccount({ serviceName, login, password, url, description, masterPassword });
            const decryptedAccount = await getAccountById(newAccount.id, masterPassword);
            const accounts = [...JSON.parse(sessionStorage.getItem('accounts') || '[]'), { ...decryptedAccount, isFavorite: false }];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
            await loadAccounts();
            closeAllModals();
            alert('Аккаунт успешно добавлен!');
        } catch (error: any) {
            accountError.style.display = 'block';
            accountError.textContent = `Ошибка: ${error.message}`;
        }
    });

    submitNoteBtn.addEventListener('click', async () => {
        const title = (document.getElementById('note-title') as HTMLInputElement).value.trim();
        const content = (document.getElementById('note-content') as HTMLTextAreaElement).value.trim();

        if (!title || !content) {
            noteError.style.display = 'block';
            noteError.textContent = 'Заполните все поля';
            return;
        }

        try {
            const newNote = await addNote(title, content, masterPassword);
            const notes = [...JSON.parse(sessionStorage.getItem('notes') || '[]'), { ...newNote, isFavorite: false }];
            sessionStorage.setItem('notes', JSON.stringify(notes));
            await loadNotes();
            closeAllModals();
            alert('Заметка успешно добавлена!');
        } catch (error: any) {
            noteError.style.display = 'block';
            noteError.textContent = `Ошибка: ${error.message}`;
        }
    });

    const openAccountModal = async (accountId: number) => {
        const account = JSON.parse(sessionStorage.getItem('accounts') || '[]').find((acc: Account) => acc.id === accountId);
        if (!account) return;

        currentAccountId = accountId;

        const serviceName = document.getElementById('modal-service-name');
        const login = document.getElementById('modal-login');
        const encryptedPassword = document.getElementById('modal-encrypted-password');
        const description = document.getElementById('modal-description');
        const url = document.getElementById('modal-url');
        const creationDate = document.getElementById('modal-creation-date');
        const favoriteBtn = document.getElementById('account-favorite-btn');

        if (!serviceName || !login || !encryptedPassword || !description || !url || !creationDate || !favoriteBtn) return;

        serviceName.textContent = account.serviceName;
        login.textContent = account.login;
        encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
        description.textContent = account.description || 'Не указано';
        url.textContent = account.url || 'Не указан';
        creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU') || 'Не указана';

        const isFav = await isFavorite('account', accountId).catch(() => false);
        const buttonText = isFav ? 'Удалить из избранного' : 'Добавить в избранное';
        favoriteBtn.textContent = buttonText;
        favoriteBtn.style.display = 'inline-block';
        favoriteBtn.style.visibility = 'visible';

        favoriteBtn.onclick = async () => {
            try {
                const currentFavStatus = await isFavorite('account', accountId).catch(() => false);
                if (currentFavStatus) {
                    await removeFromFavorites('account', accountId);
                } else {
                    await addToFavorites('account', accountId);
                }
                const updatedFavStatus = await isFavorite('account', accountId).catch(() => false);
                const updatedText = updatedFavStatus ? 'Удалить из избранного' : 'Добавить в избранное';
                favoriteBtn.textContent = updatedText;
                const accounts = JSON.parse(sessionStorage.getItem('accounts') || '[]');
                const updatedAccounts = accounts.map((acc: Account) => acc.id === accountId ? { ...acc, isFavorite: updatedFavStatus } : acc);
                sessionStorage.setItem('accounts', JSON.stringify(updatedAccounts));
            } catch (error: any) {
                alert(`Ошибка: ${error.message}`);
            }
        };

        accountModal.style.display = 'flex';
    };

    const openNoteModal = async (noteId: number) => {
        const note = JSON.parse(sessionStorage.getItem('notes') || '[]').find((n: Note) => n.id === noteId);
        if (!note) return;

        currentNoteId = noteId;

        const title = document.getElementById('modal-note-title');
        const content = document.getElementById('modal-note-content');
        const creationDate = document.getElementById('modal-note-creation-date');
        const updatedDate = document.getElementById('modal-note-updated-date');
        const favoriteBtn = document.getElementById('note-favorite-btn');

        if (!title || !content || !creationDate || !updatedDate || !favoriteBtn) return;

        title.textContent = note.title;
        content.textContent = note.encryptedContent;
        creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU') || 'Не указана';
        updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU') || 'Не указана';

        const isFav = await isFavorite('note', noteId).catch(() => false);
        const buttonText = isFav ? 'Удалить из избранного' : 'Добавить в избранное';
        favoriteBtn.textContent = buttonText;
        favoriteBtn.style.display = 'inline-block';
        favoriteBtn.style.visibility = 'visible';

        favoriteBtn.onclick = async () => {
            try {
                const currentFavStatus = await isFavorite('note', noteId).catch(() => false);
                if (currentFavStatus) {
                    await removeFromFavorites('note', noteId);
                } else {
                    await addToFavorites('note', noteId);
                }
                const updatedFavStatus = await isFavorite('note', noteId).catch(() => false);
                const updatedText = updatedFavStatus ? 'Удалить из избранного' : 'Добавить в избранное';
                favoriteBtn.textContent = updatedText;
                const notes = JSON.parse(sessionStorage.getItem('notes') || '[]');
                const updatedNotes = notes.map((n: Note) => n.id === noteId ? { ...n, isFavorite: updatedFavStatus } : n);
                sessionStorage.setItem('notes', JSON.stringify(updatedNotes));
            } catch (error: any) {
                alert(`Ошибка: ${error.message}`);
            }
        };

        noteModal.style.display = 'flex';
    };

    const closeButtons = document.querySelectorAll('.modal-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    [accountModal, noteModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAllModals();
        });
    });

    const accountDeleteBtn = document.getElementById('account-delete-btn');
    if (accountDeleteBtn) {
        accountDeleteBtn.addEventListener('click', async () => {
            if (!currentAccountId) return;
            try {
                await deleteAccount(currentAccountId);
                const accounts = await getAccounts(masterPassword) as Account[];
                sessionStorage.setItem('accounts', JSON.stringify(accounts));
                await loadAccounts();
                closeAllModals();
            } catch (error: any) {
                alert('Ошибка: ' + error.message);
            }
        });
    }

    const noteDeleteBtn = document.getElementById('note-delete-btn');
    if (noteDeleteBtn) {
        noteDeleteBtn.addEventListener('click', async () => {
            if (!currentNoteId) return;
            try {
                await deleteNote(currentNoteId);
                const notes = await getUserNotes(masterPassword) as Note[];
                sessionStorage.setItem('notes', JSON.stringify(notes));
                await loadNotes();
                closeAllModals();
            } catch (error: any) {
                alert('Ошибка: ' + error.message);
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
            const account = JSON.parse(sessionStorage.getItem('accounts') || '[]').find((acc: Account) => acc.id === currentAccountId);
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
                const login = (document.getElementById('edit-login') as HTMLInputElement)?.value;
                const password = (document.getElementById('edit-encrypted-password') as HTMLInputElement)?.value;
                const serviceName = (document.getElementById('edit-service-name') as HTMLInputElement)?.value;
                const url = (document.getElementById('edit-url') as HTMLInputElement)?.value;
                const description = (document.getElementById('edit-description') as HTMLTextAreaElement)?.value;

                if (login && password && serviceName && url && description) {
                    try {
                        await updateAccount({ id: currentAccountId, newLogin: login, newPassword: password, newURL: url, newDescription: description, newServiceName: serviceName, masterPassword });
                        const accounts = await getAccounts(masterPassword) as Account[];
                        sessionStorage.setItem('accounts', JSON.stringify(accounts));
                        toggleAccountEditMode(false);
                        await loadAccounts();
                    } catch (error: any) {
                        alert('Ошибка: ' + error.message);
                    }
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
            const note = JSON.parse(sessionStorage.getItem('notes') || '[]').find((n: Note) => n.id === currentNoteId);
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
                const newTitle = (document.getElementById('edit-note-title') as HTMLInputElement)?.value;
                const newContent = (document.getElementById('edit-note-content') as HTMLTextAreaElement)?.value;

                if (newTitle && newContent) {
                    try {
                        await updateNote(currentNoteId, newTitle, newContent, masterPassword);
                        const notes = await getUserNotes(masterPassword) as Note[];
                        sessionStorage.setItem('notes', JSON.stringify(notes));
                        toggleNoteEditMode(false);
                        await loadNotes();
                    } catch (error: any) {
                        alert('Ошибка: ' + error.message);
                    }
                }
            }
        });
    }

    const dropdown = document.querySelector('.profile-dropdown');
    const menu = document.getElementById('profileMenu');
    if (dropdown && menu) {
        dropdown.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            dropdown.textContent = menu.style.display === 'block' ? '▲' : '▼';
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
            sessionStorage.clear();
            window.location.href = '/pages/login-page.html';
        });
    }

    const sidebar = document.getElementById('sidebar');
    const hideBtn = document.getElementById('hideBtn');
    if (sidebar && hideBtn) {
        hideBtn.addEventListener('click', () => {
            sidebar.classList.toggle('hidden');
            hideBtn.textContent = sidebar.classList.contains('hidden') ? '≪' : '≫';
        });
    }
    setInterval(syncData, 10000);
});