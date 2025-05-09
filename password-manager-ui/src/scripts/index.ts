import { getAccounts, getUserNotes, deleteAccount, deleteNote, updateAccount, updateNote, addAccount, addNote, getAccountById } from '../services/api.ts';

console.log('Script loaded');

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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing...');

    // Проверка, загружены ли данные
    const isDataLoaded = sessionStorage.getItem('isDataLoaded');
    if (!isDataLoaded) {
        console.warn('Data not loaded. Redirecting to loading page...');
        window.location.href = '/pages/loading-page.html';
        return;
    }

    // Получение информации о пользователе из sessionStorage
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

    const passwordCards = document.getElementById('passwordCards')!;
    const notesCards = document.getElementById('notesCards')!;
    const errorContainer = document.getElementById('errorContainer')!;
    const fabButton = document.getElementById('fabButton')!;
    const addChoiceModal = document.getElementById('add-choice-modal')!;
    const addAccountModal = document.getElementById('add-account-modal')!;
    const addNoteModal = document.getElementById('add-note-modal')!;
    const chooseAccountBtn = document.getElementById('chooseAccount')!;
    const chooseNoteBtn = document.getElementById('chooseNote')!;
    const cancelAccountBtn = document.getElementById('cancel-account')!;
    const cancelNoteBtn = document.getElementById('cancel-note')!;
    const submitAccountBtn = document.getElementById('submit-account')!;
    const submitNoteBtn = document.getElementById('submit-note')!;
    const accountError = document.getElementById('account-error')!;
    const noteError = document.getElementById('note-error')!;

    // Получение мастер-пароля
    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        console.warn('Master password not found in session. Redirecting to login...');
        window.location.href = '/pages/login-page.html';
        return;
    }

    // Загрузка и отображение аккаунтов
    const loadAccounts = async () => {
        const accountsStr = sessionStorage.getItem('accounts');
        let accounts: Account[] = [];
        if (accountsStr) {
            accounts = JSON.parse(accountsStr);
        } else {
            accounts = await getAccounts(masterPassword) as Account[];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
        }
        console.log('Accounts retrieved:', accounts);
        if (accounts.length === 0) {
            console.log('No accounts to display');
            passwordCards.innerHTML = '<div class="add-new-card">+</div>';
        } else {
            passwordCards.innerHTML = accounts
                .map((account: Account) => {
                    const logoUrl = account.url
                        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}`
                        : 'https://via.placeholder.com/32';
                    return `
                        <div class="card" onclick="openAccountModal(${account.id})">
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
                .join('') + '<div class="add-new-card">+</div>';
        }
    };

    // Загрузка и отображение заметок
    const loadNotes = async () => {
        const notesStr = sessionStorage.getItem('notes');
        let notes: Note[] = [];
        if (notesStr) {
            notes = JSON.parse(notesStr);
        } else {
            notes = await getUserNotes(masterPassword) as Note[];
            sessionStorage.setItem('notes', JSON.stringify(notes));
        }
        console.log('Notes retrieved:', notes);
        if (notes.length === 0) {
            console.log('No notes to display');
            notesCards.innerHTML = '<div class="add-new-card">+</div>';
        } else {
            notesCards.innerHTML = notes
                .map((note: Note) => `
                    <div class="card" onclick="openNoteModal(${note.id})">
                        <div class="card-logo"></div>
                        <div class="card-details">
                            <h3>${note.title}</h3>
                            <p>Создана: ${new Date(note.createdAt).toLocaleDateString('ru-RU')}</p>
                        </div>
                    </div>
                `)
                .join('') + '<div class="add-new-card">+</div>';
        }
    };

    await Promise.all([loadAccounts(), loadNotes()]);
    errorContainer.style.display = 'none';

    // Модальные окна для аккаунтов и заметок уже есть, добавим функционал добавления
    let currentAccountId: number | null = null;
    let currentNoteId: number | null = null;

    // Функция для скрытия всех модальных окон
    const closeAllModals = () => {
        addChoiceModal.style.display = 'none';
        addAccountModal.style.display = 'none';
        addNoteModal.style.display = 'none';
        accountError.style.display = 'none';
        noteError.style.display = 'none';
    };

    // Обработчик для карточки "+"
    passwordCards.querySelectorAll('.add-new-card').forEach(card => {
        card.addEventListener('click', () => {
            closeAllModals();
            addAccountModal.style.display = 'flex';
        });
    });
    notesCards.querySelectorAll('.add-new-card').forEach(card => {
        card.addEventListener('click', () => {
            closeAllModals();
            addNoteModal.style.display = 'flex';
        });
    });

    // Обработчик для круглой кнопки
    fabButton.addEventListener('click', () => {
        closeAllModals();
        addChoiceModal.style.display = 'flex';
    });

    // Обработчики выбора типа
    chooseAccountBtn.addEventListener('click', () => {
        closeAllModals();
        addAccountModal.style.display = 'flex';
    });

    chooseNoteBtn.addEventListener('click', () => {
        closeAllModals();
        addNoteModal.style.display = 'flex';
    });

    // Закрытие модальных окон при клике на фон
    [addChoiceModal, addAccountModal, addNoteModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });

    // Отмена добавления
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

    // Добавление аккаунта
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
            const newAccount = await addAccount({ serviceName: serviceName, login: login, password: password, url: url, description: description, masterPassword: masterPassword});
            console.log('Account added (encrypted response):', newAccount);
            // Получаем расшифрованный аккаунт по ID
            const accountId = newAccount.id; // Предполагаем, что id возвращается как число
            console.log('Fetching decrypted account with ID:', accountId);
            const decryptedAccount = await getAccountById(accountId, masterPassword);
            console.log('Decrypted account:', decryptedAccount);
            // Обновляем локальное хранилище с расшифрованным паролем
            const accounts = [...JSON.parse(sessionStorage.getItem('accounts') || '[]'), decryptedAccount];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
            await loadAccounts();
            closeAllModals();
            alert('Аккаунт успешно добавлен!');
        } catch (error: any) {
            accountError.style.display = 'block';
            accountError.textContent = `Ошибка: ${error.message}`;
            console.error('Error details:', error.response?.data || error.message);
        }
    });

    // Добавление заметки
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
            console.log('Note added:', newNote);
            sessionStorage.setItem('notes', JSON.stringify([...JSON.parse(sessionStorage.getItem('notes') || '[]'), newNote]));
            await loadNotes();
            closeAllModals();
            alert('Заметка успешно добавлена!');
        } catch (error: any) {
            noteError.style.display = 'block';
            noteError.textContent = `Ошибка: ${error.message}`;
        }
    });

    // Остальная логика (модальные окна, удаление, редактирование) осталась без изменений
    (window as any).openAccountModal = (accountId: number) => {
        console.log('Opening account modal for ID:', accountId);
        const account = JSON.parse(sessionStorage.getItem('accounts') || '[]').find((acc: Account) => acc.id === accountId);
        if (!account) {
            console.error('Account not found:', accountId);
            return;
        }

        currentAccountId = accountId;

        const modal = document.getElementById('account-modal')!;
        const serviceName = document.getElementById('modal-service-name')!;
        const login = document.getElementById('modal-login')!;
        const encryptedPassword = document.getElementById('modal-encrypted-password')!;
        const description = document.getElementById('modal-description')!;
        const url = document.getElementById('modal-url')!;
        const creationDate = document.getElementById('modal-creation-date')!;

        serviceName.textContent = account.serviceName;
        login.textContent = account.login;
        encryptedPassword.textContent = account.encryptedPassword || 'Не указан';
        description.textContent = account.description || 'Не указано';
        url.textContent = account.url || 'Не указан';
        creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU') || 'Не указана';

        modal.style.display = 'flex';
        console.log('Account modal displayed');
    };

    (window as any).openNoteModal = (noteId: number) => {
        console.log('Opening note modal for ID:', noteId);
        const note = JSON.parse(sessionStorage.getItem('notes') || '[]').find((n: Note) => n.id === noteId);
        if (!note) {
            console.error('Note not found:', noteId);
            return;
        }

        currentNoteId = noteId;

        const modal = document.getElementById('note-modal')!;
        const title = document.getElementById('modal-note-title')!;
        const content = document.getElementById('modal-note-content')!;
        const creationDate = document.getElementById('modal-note-creation-date')!;
        const updatedDate = document.getElementById('modal-note-updated-date')!;

        title.textContent = note.title;
        content.textContent = note.encryptedContent;
        creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU') || 'Не указана';
        updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU') || 'Не указана';

        modal.style.display = 'flex';
        console.log('Note modal displayed');
    };

    const accountModal = document.getElementById('account-modal')!;
    const noteModal = document.getElementById('note-modal')!;
    const closeButtons = document.querySelectorAll('.modal-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Closing modal');
            accountModal.style.display = 'none';
            noteModal.style.display = 'none';
            toggleAccountEditMode(false);
            toggleNoteEditMode(false);
        });
    });
    accountModal.addEventListener('click', (e) => {
        if (e.target === accountModal) {
            console.log('Closing account modal via click outside');
            accountModal.style.display = 'none';
            toggleAccountEditMode(false);
        }
    });
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            console.log('Closing note modal via click outside');
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        }
    });

    // Логика удаления аккаунта
    const accountDeleteBtn = document.getElementById('account-delete-btn')!;
    accountDeleteBtn.addEventListener('click', async () => {
        if (!currentAccountId) {
            console.error('No account ID to delete');
            return;
        }
        try {
            console.log('Deleting account:', currentAccountId);
            await deleteAccount(currentAccountId);
            console.log('Account deleted successfully');
            accountModal.style.display = 'none';
            const accounts = await getAccounts(masterPassword) as Account[];
            sessionStorage.setItem('accounts', JSON.stringify(accounts));
            await loadAccounts();
        } catch (error: any) {
            console.error('Error deleting account:', error.message);
            alert('Ошибка при удалении аккаунта: ' + error.message);
        }
    });

    // Логика удаления заметки
    const noteDeleteBtn = document.getElementById('note-delete-btn')!;
    noteDeleteBtn.addEventListener('click', async () => {
        if (!currentNoteId) {
            console.error('No note ID to delete');
            return;
        }
        try {
            console.log('Deleting note:', currentNoteId);
            await deleteNote(currentNoteId);
            console.log('Note deleted successfully');
            noteModal.style.display = 'none';
            const notes = await getUserNotes(masterPassword) as Note[];
            sessionStorage.setItem('notes', JSON.stringify(notes));
            await loadNotes();
        } catch (error: any) {
            console.error('Error deleting note:', error.message);
            alert('Ошибка при удалении заметки: ' + error.message);
        }
    });

    let isAccountEditMode = false;
    const accountUpdateBtn = document.getElementById('account-update-btn')!;
    const toggleAccountEditMode = (enable: boolean) => {
        isAccountEditMode = enable;
        const serviceName = document.getElementById('modal-service-name')!;
        const login = document.getElementById('modal-login')!;
        const encryptedPassword = document.getElementById('modal-encrypted-password')!;
        const description = document.getElementById('modal-description')!;
        const url = document.getElementById('modal-url')!;
        const creationDate = document.getElementById('modal-creation-date')!;

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

    accountUpdateBtn.addEventListener('click', async () => {
        if (!isAccountEditMode) {
            toggleAccountEditMode(true);
        } else {
            if (!currentAccountId) {
                console.error('No account ID to update');
                return;
            }
            const login = (document.getElementById('edit-login') as HTMLInputElement).value;
            const password = (document.getElementById('edit-encrypted-password') as HTMLInputElement).value;
            const serviceName = (document.getElementById('edit-service-name') as HTMLInputElement).value;
            const url = (document.getElementById('edit-url') as HTMLInputElement).value;
            const description = (document.getElementById('edit-description') as HTMLTextAreaElement).value;

            const updatedAccount: Partial<Account> = {
                id: currentAccountId,
                serviceName: serviceName,
                login: login,
                encryptedPassword: password,
                description: description,
                url: url,
            };

            try {
                console.log('Updating account:', updatedAccount);
                await updateAccount({ id: currentAccountId, newLogin: login, newPassword: password, newURL: url, newDescription: description, newServiceName: serviceName, masterPassword });
                console.log('Account updated successfully');
                const accounts = await getAccounts(masterPassword) as Account[];
                sessionStorage.setItem('accounts', JSON.stringify(accounts));
                toggleAccountEditMode(false);
                await loadAccounts();
            } catch (error: any) {
                console.error('Error updating account:', error.message);
                alert('Ошибка при обновлении аккаунта: ' + error.message);
            }
        }
    });

    let isNoteEditMode = false;
    const noteUpdateBtn = document.getElementById('note-update-btn')!;
    const toggleNoteEditMode = (enable: boolean) => {
        isNoteEditMode = enable;
        const title = document.getElementById('modal-note-title')!;
        const content = document.getElementById('modal-note-content')!;
        const creationDate = document.getElementById('modal-note-creation-date')!;
        const updatedDate = document.getElementById('modal-note-updated-date')!;

        if (enable) {
            title.innerHTML = `<input type="text" id="edit-note-title" value="${title.textContent || ''}" />`;
            content.innerHTML = `<textarea id="edit-note-content">${content.textContent || ''}</textarea>`;
            noteUpdateBtn.textContent = 'Сохранить';
        } else {
            const note = JSON.parse(sessionStorage.getItem('notes') || '[]').find((n: Account) => n.id === currentNoteId);
            if (note) {
                title.textContent = note.title;
                content.textContent = note.encryptedContent;
                creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU') || 'Не указана';
                updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU') || 'Не указана';
            }
            noteUpdateBtn.textContent = 'Изменить';
        }
    };

    noteUpdateBtn.addEventListener('click', async () => {
        if (!isNoteEditMode) {
            toggleNoteEditMode(true);
        } else {
            if (!currentNoteId) {
                console.error('No note ID to update');
                return;
            }
            const newTitle = (document.getElementById('edit-note-title') as HTMLInputElement).value;
            const newContent = (document.getElementById('edit-note-content') as HTMLTextAreaElement).value;
            try {
                console.log('Updating note:', { noteId: currentNoteId, newTitle, newContent });
                await updateNote(currentNoteId, newTitle, newContent, masterPassword);
                console.log('Note updated successfully');
                const notes = await getUserNotes(masterPassword) as Note[];
                sessionStorage.setItem('notes', JSON.stringify(notes));
                toggleNoteEditMode(false);
                await loadNotes();
            } catch (error: any) {
                console.error('Error updating note:', error.message);
                alert('Ошибка при обновлении заметки: ' + error.message);
            }
        }
    });

    // Обработка выпадающего меню
    const dropdown = document.querySelector('.profile-dropdown')!;
    const menu = document.getElementById('profileMenu')!;
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

    // Обработка выхода
    const logoutBtn = document.getElementById('logoutBtn')!;
    logoutBtn.addEventListener('click', () => {
        console.log('Logging out');
        localStorage.removeItem('token');
        sessionStorage.removeItem('masterPassword');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('accounts');
        sessionStorage.removeItem('notes');
        sessionStorage.removeItem('isDataLoaded');
        window.location.href = '/pages/login-page.html';
    });

    // Переключение боковой панели
    const sidebar = document.getElementById('sidebar')!;
    const hideBtn = document.getElementById('hideBtn')!;
    hideBtn.addEventListener('click', () => {
        const isHidden = sidebar.classList.contains('hidden');
        sidebar.classList.toggle('hidden');
        hideBtn.textContent = isHidden ? '≪' : '≫';
        console.log('Sidebar toggled, hidden:', !isHidden);
    });
});