import { getUserNotes, deleteNote, updateNote, addNote, addToFavorites, removeFromFavorites, isFavorite } from '../services/api.ts';
import { initializeSharedPageShell } from './shared-page.ts';

interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
    isFavorite?: boolean;
}

function debounce(func: Function, delay: number) {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!sessionStorage.getItem('isDataLoaded')) {
        window.location.href = '/pages/loading-page.html';
        return;
    }

    initializeSharedPageShell();

    const notesCards = document.getElementById('notesCards') as HTMLDivElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const fabButton = document.getElementById('fabButton') as HTMLDivElement | null;
    const addNoteModal = document.getElementById('add-note-modal') as HTMLDivElement | null;
    const noteModal = document.getElementById('note-modal') as HTMLDivElement | null;
    const cancelNoteBtn = document.getElementById('cancel-note') as HTMLButtonElement | null;
    const submitNoteBtn = document.getElementById('submit-note') as HTMLButtonElement | null;
    const noteError = document.getElementById('note-error') as HTMLDivElement | null;
    const searchInput = document.querySelector('.search-bar') as HTMLInputElement | null;
    const sortDropdown = document.querySelector('.sort-dropdown') as HTMLSelectElement | null;
    const noteFavoriteBtn = document.getElementById('note-favorite-btn') as HTMLButtonElement | null;

    if (!notesCards || !errorContainer || !fabButton || !addNoteModal || !noteModal || !cancelNoteBtn || !submitNoteBtn || !noteError || !searchInput || !sortDropdown) {
        return;
    }

    const masterPassword = sessionStorage.getItem('masterPassword');
    if (!masterPassword) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    let currentNoteId: number | null = null;
    let isNoteEditMode = false;

    const getStoredNotes = () => JSON.parse(sessionStorage.getItem('notes') || '[]') as Note[];
    const setStoredNotes = (notes: Note[]) => sessionStorage.setItem('notes', JSON.stringify(notes));

    const closeAllModals = () => {
        addNoteModal.style.display = 'none';
        noteModal.style.display = 'none';
        noteError.style.display = 'none';
    };

    const clearAddForm = () => {
        (document.getElementById('note-title') as HTMLInputElement).value = '';
        (document.getElementById('note-content') as HTMLTextAreaElement).value = '';
    };

    const openAddNoteModal = () => {
        closeAllModals();
        addNoteModal.style.display = 'flex';
    };

    const updateStoredNote = (noteId: number, patch: Partial<Note>) => {
        const notes = getStoredNotes().map(note => note.id === noteId ? { ...note, ...patch } : note);
        setStoredNotes(notes);
    };

    const filterNotes = (notes: Note[]) => {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
            return notes;
        }

        return notes.filter(note => note.title.toLowerCase().includes(term));
    };

    const sortNotes = (notes: Note[]) => {
        const sortedNotes = [...notes];
        switch (sortDropdown.value) {
            case 'az':
                sortedNotes.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'za':
                sortedNotes.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'oldest':
                sortedNotes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'newest':
                sortedNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }
        return sortedNotes;
    };

    const toggleNoteEditMode = (enable: boolean) => {
        isNoteEditMode = enable;
        const title = document.getElementById('modal-note-title') as HTMLElement;
        const content = document.getElementById('modal-note-content') as HTMLElement;
        const creationDate = document.getElementById('modal-note-creation-date') as HTMLElement;
        const updatedDate = document.getElementById('modal-note-updated-date') as HTMLElement;
        const noteUpdateBtn = document.getElementById('note-update-btn') as HTMLButtonElement;

        if (enable) {
            title.innerHTML = `<input type="text" id="edit-note-title" value="${title.textContent || ''}" />`;
            content.innerHTML = `<textarea id="edit-note-content">${content.textContent || ''}</textarea>`;
            noteUpdateBtn.textContent = 'Сохранить';
            return;
        }

        const note = getStoredNotes().find(item => item.id === currentNoteId);
        if (note) {
            title.textContent = note.title;
            content.textContent = note.encryptedContent;
            creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU');
            updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU');
        }

        noteUpdateBtn.textContent = 'Изменить';
    };

    const applyFavoriteState = (noteId: number, isFav: boolean) => {
        if (!noteFavoriteBtn) {
            return;
        }

        noteFavoriteBtn.textContent = isFav ? 'Удалить из избранного' : 'Добавить в избранное';
        updateStoredNote(noteId, { isFavorite: isFav });
    };

    const openNoteModal = async (noteId: number) => {
        const note = getStoredNotes().find(item => item.id === noteId);
        if (!note) {
            return;
        }

        currentNoteId = noteId;

        (document.getElementById('modal-note-title') as HTMLElement).textContent = note.title;
        (document.getElementById('modal-note-content') as HTMLElement).textContent = note.encryptedContent;
        (document.getElementById('modal-note-creation-date') as HTMLElement).textContent = new Date(note.createdAt).toLocaleString('ru-RU');
        (document.getElementById('modal-note-updated-date') as HTMLElement).textContent = new Date(note.updatedAt).toLocaleString('ru-RU');

        if (noteFavoriteBtn) {
            applyFavoriteState(noteId, Boolean(note.isFavorite));
            noteFavoriteBtn.onclick = async () => {
                try {
                    const currentFavStatus = Boolean(getStoredNotes().find(item => item.id === noteId)?.isFavorite);
                    if (currentFavStatus) {
                        await removeFromFavorites('note', noteId);
                        applyFavoriteState(noteId, false);
                    } else {
                        await addToFavorites('note', noteId);
                        applyFavoriteState(noteId, true);
                    }
                } catch (error: any) {
                    alert(`Ошибка: ${error.message}`);
                }
            };
        }

        noteModal.style.display = 'flex';

        if (noteFavoriteBtn) {
            void isFavorite('note', noteId)
                .then((isFav) => applyFavoriteState(noteId, isFav))
                .catch(() => undefined);
        }
    };

    const bindCards = () => {
        notesCards.querySelectorAll<HTMLElement>('.card[data-note-id]').forEach(card => {
            card.addEventListener('click', () => {
                void openNoteModal(Number(card.dataset.noteId));
            });
        });

        notesCards.querySelectorAll<HTMLElement>('.add-new-card').forEach(card => {
            card.addEventListener('click', openAddNoteModal);
        });
    };

    const loadNotes = async () => {
        let notes = getStoredNotes();

        if (!sessionStorage.getItem('notes')) {
            notes = await getUserNotes(masterPassword) as Note[];
            setStoredNotes(notes);
        }

        const visibleNotes = sortNotes(filterNotes(notes));
        if (visibleNotes.length === 0) {
            notesCards.innerHTML = '<div class="add-new-card">+</div>';
        } else {
            notesCards.innerHTML = visibleNotes.map((note) => `
                <div class="card" data-note-id="${note.id}">
                    <div class="card-logo"></div>
                    <div class="card-details">
                        <h3>${note.title}</h3>
                        <p>Создана: ${new Date(note.createdAt).toLocaleDateString('ru-RU')}</p>
                    </div>
                </div>
            `).join('') + '<div class="add-new-card">+</div>';
        }

        bindCards();
    };

    try {
        await loadNotes();
        errorContainer.style.display = 'none';
    } catch (error) {
        errorContainer.style.display = 'block';
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Ошибка при загрузке заметок';
        }
        return;
    }

    fabButton.addEventListener('click', openAddNoteModal);
    addNoteModal.addEventListener('click', (event) => {
        if (event.target === addNoteModal) {
            closeAllModals();
        }
    });

    cancelNoteBtn.addEventListener('click', () => {
        closeAllModals();
        clearAddForm();
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
            const notes = [...getStoredNotes(), { ...newNote, encryptedContent: content, isFavorite: false }];
            setStoredNotes(notes);
            await loadNotes();
            clearAddForm();
            closeAllModals();
        } catch (error: any) {
            noteError.style.display = 'block';
            noteError.textContent = `Ошибка: ${error.message}`;
        }
    });

    noteModal.addEventListener('click', (event) => {
        if (event.target === noteModal) {
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach(button => {
        button.addEventListener('click', () => {
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        });
    });

    (document.getElementById('note-delete-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!currentNoteId) {
            return;
        }

        try {
            await deleteNote(currentNoteId);
            sessionStorage.removeItem('notes');
            noteModal.style.display = 'none';
            await loadNotes();
        } catch (error: any) {
            alert(`Ошибка при удалении заметки: ${error.message}`);
        }
    });

    (document.getElementById('note-update-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!isNoteEditMode) {
            toggleNoteEditMode(true);
            return;
        }

        if (!currentNoteId) {
            return;
        }

        const newTitle = (document.getElementById('edit-note-title') as HTMLInputElement).value;
        const newContent = (document.getElementById('edit-note-content') as HTMLTextAreaElement).value;

        try {
            await updateNote(currentNoteId, newTitle, newContent, masterPassword);
            const notes = getStoredNotes();
            const noteIndex = notes.findIndex(item => item.id === currentNoteId);
            if (noteIndex !== -1) {
                notes[noteIndex] = {
                    ...notes[noteIndex],
                    title: newTitle,
                    encryptedContent: newContent,
                    updatedAt: new Date().toISOString()
                };
            }
            setStoredNotes(notes);
            toggleNoteEditMode(false);
            await loadNotes();
        } catch (error: any) {
            alert(`Ошибка при обновлении заметки: ${error.message}`);
        }
    });

    searchInput.addEventListener('input', debounce(async () => await loadNotes(), 300));
    sortDropdown.addEventListener('change', debounce(async () => await loadNotes(), 300));
});
