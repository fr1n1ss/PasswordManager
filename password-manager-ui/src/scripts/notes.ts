import { getUserNotes, deleteNote, updateNote, addNote, getNoteById } from '../services/api.ts';

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    decryptedContent?: string; // Добавляем поле для расшифрованного содержимого
    createdAt: string;
    updatedAt: string;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing notes...');

    // Проверка, загружены ли данные
    const isDataLoaded = sessionStorage.getItem('isDataLoaded');
    if (!isDataLoaded) {
        console.warn('Data not loaded. Redirecting to loading page...');
        window.location.href = '/pages/loading-page.html';
        return;
    }

    // Извлечение информации о пользователе
    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');

    if (usernameElement && username) {
        usernameElement.textContent = username;
    } else {
        console.warn('Username not found in sessionStorage');
    }
    if (emailElement && email) {
        emailElement.textContent = email;
    } else {
        console.warn('Email not found in sessionStorage');
    }

    const notesCards = document.getElementById('notesCards')!;
    const errorContainer = document.getElementById('errorContainer')!;
    const fabButton = document.getElementById('fabButton')!;
    const addNoteModal = document.getElementById('add-note-modal')!;
    const cancelNoteBtn = document.getElementById('cancel-note')!;
    const submitNoteBtn = document.getElementById('submit-note')!;
    const noteError = document.getElementById('note-error')!;

    // Получение мастер-пароля
    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        console.warn('Master password not found in session. Redirecting to login...');
        window.location.href = '/pages/login-page.html';
        return;
    }

    // Загрузка и отображение заметок
    const loadNotes = async () => {
        const notesStr = sessionStorage.getItem('notes');
        let notes: Note[] = [];
        if (notesStr) {
            notes = JSON.parse(notesStr);
        } else {
            const encryptedNotes = await getUserNotes(masterPassword) as Note[];
            // Расшифровываем каждую заметку
            notes = await Promise.all(encryptedNotes.map(async (note) => {
                try {
                    const decryptedNote = await getNoteById(note.id, masterPassword);
                    return { ...note, decryptedContent: decryptedNote.decryptedContent || note.encryptedContent };
                } catch (error) {
                    console.error(`Failed to decrypt note ID ${note.id}:`, error);
                    return { ...note, decryptedContent: note.encryptedContent }; // Используем зашифрованное содержимое в случае ошибки
                }
            }));
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

    try {
        await loadNotes();
        errorContainer.style.display = 'none';
    } catch (error) {
        console.error('Error loading notes:', error);
        errorContainer.style.display = 'block';
        const errorMessage = document.getElementById('errorMessage')!;
        errorMessage.textContent = 'Ошибка при загрузке заметок';
        return;
    }

    // Модальные окна для заметок
    let currentNoteId: number | null = null;

    // Функция для скрытия всех модальных окон
    const closeAllModals = () => {
        addNoteModal.style.display = 'none';
        const noteModal = document.getElementById('note-modal')!;
        noteModal.style.display = 'none';
        noteError.style.display = 'none';
    };

    // Обработчик для карточки "+"
    notesCards.querySelectorAll('.add-new-card').forEach(card => {
        card.addEventListener('click', () => {
            closeAllModals();
            addNoteModal.style.display = 'flex';
        });
    });

    // Обработчик для FAB кнопки
    fabButton.addEventListener('click', () => {
        closeAllModals();
        addNoteModal.style.display = 'flex';
    });

    // Закрытие модального окна при клике на фон
    addNoteModal.addEventListener('click', (e) => {
        if (e.target === addNoteModal) {
            closeAllModals();
        }
    });

    // Отмена добавления
    cancelNoteBtn.addEventListener('click', () => {
        closeAllModals();
        (document.getElementById('note-title') as HTMLInputElement).value = '';
        (document.getElementById('note-content') as HTMLTextAreaElement).value = '';
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
            console.log('Adding new note:', { title, content });
            const newNote = await addNote(title, content, masterPassword);
            console.log('Note added (encrypted response):', newNote);
            const noteId = newNote.id;
            if (!noteId) {
                throw new Error('Note ID is missing in the response');
            }
            console.log('Fetching decrypted note with ID:', noteId);
            const decryptedNote = await getNoteById(noteId, masterPassword);
            console.log('Decrypted note:', decryptedNote);
            const updatedNotes = [...JSON.parse(sessionStorage.getItem('notes') || '[]'), { ...newNote, encryptedContent: decryptedNote.encryptedContent || newNote.encryptedContent }];
            sessionStorage.setItem('notes', JSON.stringify(updatedNotes));
            await loadNotes();
            closeAllModals();
            alert('Заметка успешно добавлена!');
        } catch (error: any) {
            noteError.style.display = 'block';
            noteError.textContent = `Ошибка: ${error.message}`;
            console.error('Error details:', error.response?.data || error.message);
        }
    });

    // Открытие модального окна для заметок
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
        content.textContent = note.decryptedContent || note.encryptedContent; // Используем расшифрованное содержимое
        creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU') || 'Не указана';
        updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU') || 'Не указана';

        modal.style.display = 'flex';
        console.log('Note modal displayed');
    };

    // Закрытие модального окна
    const noteModal = document.getElementById('note-modal')!;
    const closeButtons = document.querySelectorAll('.modal-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Closing modal');
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        });
    });
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            console.log('Closing note modal via click outside');
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
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
            // Расшифровываем заметки после удаления
            const decryptedNotes = await Promise.all(notes.map(async (note) => {
                try {
                    const decryptedNote = await getNoteById(note.id, masterPassword);
                    return { ...note, decryptedContent: decryptedNote.decryptedContent || note.encryptedContent };
                } catch (error) {
                    console.error(`Failed to decrypt note ID ${note.id}:`, error);
                    return { ...note, decryptedContent: note.encryptedContent };
                }
            }));
            sessionStorage.setItem('notes', JSON.stringify(decryptedNotes));
            await loadNotes();
        } catch (error: any) {
            console.error('Error deleting note:', error.message);
            alert('Ошибка при удалении заметки: ' + error.message);
        }
    });

    // Логика редактирования заметки
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
            const note = JSON.parse(sessionStorage.getItem('notes') || '[]').find((n: Note) => n.id === currentNoteId);
            if (note) {
                title.textContent = note.title;
                content.textContent = note.decryptedContent || note.encryptedContent; // Используем расшифрованное содержимое
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
                const updatedNote = await getNoteById(currentNoteId, masterPassword);
                const notes = JSON.parse(sessionStorage.getItem('notes') || '[]');
                const noteIndex = notes.findIndex((n: Note) => n.id === currentNoteId);
                if (noteIndex !== -1) {
                    notes[noteIndex] = { ...notes[noteIndex], title: newTitle, encryptedContent: updatedNote.encryptedContent, decryptedContent: updatedNote.decryptedContent || updatedNote.encryptedContent };
                }
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