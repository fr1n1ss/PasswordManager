import { getUserNotes, deleteNote, updateNote } from '../services/api.ts';

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
}

document.addEventListener('DOMContentLoaded', () => {
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
    const errorMessage = document.getElementById('errorMessage')!;

    // Извлечение заметок из sessionStorage
    const notesStr = sessionStorage.getItem('notes');
    if (!notesStr) {
        console.error('No notes found in sessionStorage');
        errorContainer.style.display = 'block';
        errorMessage.textContent = 'Ошибка: данные заметок не найдены';
        return;
    }

    const notes: Note[] = JSON.parse(notesStr);
    console.log('Notes retrieved from sessionStorage:', notes);

    // Рендеринг заметок
    if (notes.length === 0) {
        console.log('No notes to display');
        notesCards.innerHTML = '';
    } else {
        notesCards.innerHTML = notes
            .map((note: Note) => `
                <div class="card" onclick="openNoteModal(${note.id})">
                    <div class="card-logo">
                        <img src="https://via.placeholder.com/32" alt="${note.title} icon" />
                    </div>
                    <div class="card-details">
                        <h3>${note.title}</h3>
                    </div>
                </div>
            `)
            .join('');
    }
    errorContainer.style.display = 'none';

    // Модальное окно для заметок
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
    console.log('Note modal created');

    // Открытие модального окна для заметок
    let currentNoteId: number | null = null;
    (window as any).openNoteModal = (noteId: number) => {
        console.log('Opening note modal for ID:', noteId);
        const note = notes.find(n => n.id === noteId);
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

        modal.style.display = 'block';
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
            // Обновляем список заметок
            const updatedNotes = await getUserNotes(sessionStorage.getItem('masterPassword') || '');
            sessionStorage.setItem('notes', JSON.stringify(updatedNotes));
            if (updatedNotes.length === 0) {
                notesCards.innerHTML = '';
            } else {
                notesCards.innerHTML = updatedNotes
                    .map((note: Note) => `
                        <div class="card" onclick="openNoteModal(${note.id})">
                            <div class="card-logo">
                                <img src="https://via.placeholder.com/32" alt="${note.title} icon" />
                            </div>
                            <div class="card-details">
                                <h3>${note.title}</h3>
                            </div>
                        </div>
                    `)
                    .join('');
            }
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
            const note = notes.find(n => n.id === currentNoteId);
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
                await updateNote(currentNoteId, newTitle, newContent, sessionStorage.getItem('masterPassword') || '');
                console.log('Note updated successfully');
                // Обновляем локальный массив
                const noteIndex = notes.findIndex(n => n.id === currentNoteId);
                if (noteIndex !== -1) {
                    notes[noteIndex] = { ...notes[noteIndex], title: newTitle, encryptedContent: newContent };
                }
                sessionStorage.setItem('notes', JSON.stringify(notes));
                toggleNoteEditMode(false);
                // Обновляем список заметок на странице
                if (notes.length === 0) {
                    notesCards.innerHTML = '';
                } else {
                    notesCards.innerHTML = notes
                        .map((note: Note) => `
                            <div class="card" onclick="openNoteModal(${note.id})">
                                <div class="card-logo">
                                    <img src="https://via.placeholder.com/32" alt="${note.title} icon" />
                                </div>
                                <div class="card-details">
                                    <h3>${note.title}</h3>
                                </div>
                            </div>
                        `)
                        .join('');
                }
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