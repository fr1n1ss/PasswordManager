import { getUserNotes, deleteNote, updateNote, addNote, getNoteById, hashNotes, addToFavorites, removeFromFavorites, isFavorite } from '../services/api.ts';

async function hashData(data: any): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data));
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    decryptedContent?: string;
    createdAt: string;
    updatedAt: string;
    isFavorite?: boolean;
}

// Функция debounce
function debounce(func: Function, delay: number) {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing notes...');

    const isDataLoaded = sessionStorage.getItem('isDataLoaded');
    if (!isDataLoaded) {
        console.warn('Data not loaded. Redirecting to loading page...');
        window.location.href = '/pages/loading-page.html';
        return;
    }

    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');

    if (usernameElement && username) usernameElement.textContent = username;
    if (emailElement && email) emailElement.textContent = email;

    const notesCards = document.getElementById('notesCards')!;
    const errorContainer = document.getElementById('errorContainer')!;
    const fabButton = document.getElementById('fabButton')!;
    const addNoteModal = document.getElementById('add-note-modal')!;
    const cancelNoteBtn = document.getElementById('cancel-note')!;
    const submitNoteBtn = document.getElementById('submit-note')!;
    const noteError = document.getElementById('note-error')!;
    const searchInput = document.querySelector('.search-bar') as HTMLInputElement;
    const sortDropdown = document.querySelector('.sort-dropdown') as HTMLSelectElement;

    if (!notesCards || !errorContainer || !fabButton || !addNoteModal || !cancelNoteBtn || !submitNoteBtn || !noteError || !searchInput || !sortDropdown) {
        console.error('Required DOM elements are missing');
        return;
    }

    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        console.warn('Master password not found. Redirecting to login...');
        window.location.href = '/pages/login-page.html';
        return;
    }

    const syncData = async () => {
        const masterPassword = sessionStorage.getItem('masterPassword');
        if (!masterPassword) return;

        try {
            const cachedNotes = JSON.parse(sessionStorage.getItem('notes') || '[]');
            const localNotesHash = await hashData(cachedNotes);
            const notesHash = await hashNotes();

            if (localNotesHash !== notesHash) {
                const updatedNotes = await getUserNotes(masterPassword);
                const decryptedNotes = await Promise.all(updatedNotes.map(async (note: Note) => {
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
                console.log('[sync] Notes обновлены');
            }
        } catch (err) {
            console.error('[syncData] Ошибка синхронизации:', err);
        }
    };

    const filterNotes = (notes: Note[], searchTerm: string): Note[] => {
        if (!searchTerm) return notes;
        return notes.filter(note => note.title.toLowerCase().includes(searchTerm.toLowerCase()));
    };

    const sortNotes = (notes: Note[], sortBy: string): Note[] => {
        const sortedNotes = [...notes];
        switch (sortBy) {
            case 'az': sortedNotes.sort((a, b) => a.title.localeCompare(b.title)); break;
            case 'za': sortedNotes.sort((a, b) => b.title.localeCompare(a.title)); break;
            case 'oldest': sortedNotes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
            case 'newest': sortedNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
        }
        return sortedNotes;
    };

    const loadNotes = async () => {
        let notes: Note[] = [];
        const notesStr = sessionStorage.getItem('notes');
        if (notesStr) {
            notes = JSON.parse(notesStr);
        } else {
            const encryptedNotes = await getUserNotes(masterPassword) as Note[];
            notes = await Promise.all(encryptedNotes.map(async (note) => {
                try {
                    const decryptedNote = await getNoteById(note.id, masterPassword);
                    return { ...note, decryptedContent: decryptedNote.decryptedContent || note.encryptedContent };
                } catch (error) {
                    console.error(`Failed to decrypt note ID ${note.id}:`, error);
                    return { ...note, decryptedContent: note.encryptedContent };
                }
            }));
            sessionStorage.setItem('notes', JSON.stringify(notes));
        }
        console.log('Notes retrieved:', notes);

        let filteredNotes = filterNotes(notes, searchInput.value);
        filteredNotes = sortNotes(filteredNotes, sortDropdown.value);

        if (filteredNotes.length === 0) {
            console.log('No notes to display');
            notesCards.innerHTML = '<div class="add-new-card">+</div>';
        } else {
            const favoritePromises = filteredNotes.map(note => isFavorite('note', note.id).catch(() => false));
            const favoriteStatuses = await Promise.all(favoritePromises);
            const notesWithFavorite = filteredNotes.map((note, index) => ({
                ...note,
                isFavorite: favoriteStatuses[index]
            }));
            notesCards.innerHTML = notesWithFavorite
                .map((note) => `
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

        notesCards.querySelectorAll('.add-new-card').forEach(card => {
            card.addEventListener('click', () => {
                closeAllModals();
                addNoteModal.style.display = 'flex';
            });
        });
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

    let currentNoteId: number | null = null;

    const closeAllModals = () => {
        addNoteModal.style.display = 'none';
        const noteModal = document.getElementById('note-modal')!;
        noteModal.style.display = 'none';
        noteError.style.display = 'none';
        const favoriteBtn = document.getElementById('note-favorite-btn');
        if (favoriteBtn) {
            favoriteBtn.textContent = '';
            favoriteBtn.innerHTML = '';
        }
    };

    fabButton.addEventListener('click', () => {
        closeAllModals();
        addNoteModal.style.display = 'flex';
    });

    addNoteModal.addEventListener('click', (e) => {
        if (e.target === addNoteModal) closeAllModals();
    });

    cancelNoteBtn.addEventListener('click', () => {
        closeAllModals();
        (document.getElementById('note-title') as HTMLInputElement).value = '';
        (document.getElementById('note-content') as HTMLTextAreaElement).value = '';
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
            const decryptedNote = await getNoteById(newNote.id, masterPassword);
            const notes = [...JSON.parse(sessionStorage.getItem('notes') || '[]'), { ...newNote, decryptedContent: decryptedNote.decryptedContent || newNote.encryptedContent, isFavorite: false }];
            sessionStorage.setItem('notes', JSON.stringify(notes));
            await loadNotes();
            closeAllModals();
            alert('Заметка успешно добавлена!');
        } catch (error: any) {
            noteError.style.display = 'block';
            noteError.textContent = `Ошибка: ${error.message}`;
            console.error('Error details:', error.response?.data || error.message);
        }
    });

    (window as any).openNoteModal = async (noteId: number) => {
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
        const favoriteBtn = document.getElementById('note-favorite-btn')!;

        title.textContent = note.title;
        content.textContent = note.decryptedContent || note.encryptedContent;
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
                if (currentFavStatus) await removeFromFavorites('note', noteId);
                else await addToFavorites('note', noteId);
                const updatedFavStatus = await isFavorite('note', noteId).catch(() => false);
                favoriteBtn.textContent = updatedFavStatus ? 'Удалить из избранного' : 'Добавить в избранное';
                const notes = JSON.parse(sessionStorage.getItem('notes') || '[]');
                const updatedNotes = notes.map((n: Note) => n.id === noteId ? { ...n, isFavorite: updatedFavStatus } : n);
                sessionStorage.setItem('notes', JSON.stringify(updatedNotes));
            } catch (error: any) {
                alert(`Ошибка: ${error.message}`);
            }
        };

        modal.style.display = 'flex';
    };

    const noteModal = document.getElementById('note-modal')!;
    const closeButtons = document.querySelectorAll('.modal-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        });
    });
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        }
    });

    const noteDeleteBtn = document.getElementById('note-delete-btn')!;
    noteDeleteBtn.addEventListener('click', async () => {
        if (!currentNoteId) {
            console.error('No note ID to delete');
            return;
        }
        try {
            await deleteNote(currentNoteId);
            noteModal.style.display = 'none';
            const notes = await getUserNotes(masterPassword) as Note[];
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
                content.textContent = note.decryptedContent || note.encryptedContent;
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
                await updateNote(currentNoteId, newTitle, newContent, masterPassword);
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

    const logoutBtn = document.getElementById('logoutBtn')!;
    logoutBtn.addEventListener('click', () => {
        console.log('Logging out');
        localStorage.removeItem('token');
        sessionStorage.clear();
        window.location.href = '/pages/login-page.html';
    });

    const sidebar = document.getElementById('sidebar')!;
    const hideBtn = document.getElementById('hideBtn')!;
    hideBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
        hideBtn.textContent = sidebar.classList.contains('hidden') ? '≪' : '≫';
    });

    const debouncedSearch = debounce(async () => await loadNotes(), 300);
    searchInput.addEventListener('input', debouncedSearch);

    const debouncedSort = debounce(async () => await loadNotes(), 300);
    sortDropdown.addEventListener('change', debouncedSort);

    setInterval(syncData, 10000);
});