import { addNote, addToFavorites, deleteNote, getUserNotes, removeFromFavorites, updateNote } from '../services/api.ts';
import { decryptNotes, encryptOpaquePayload } from '../services/zero-knowledge.ts';
import { initializeSharedPageShell } from './shared-page.ts';
import { favoriteButtonLabel, UI_TEXT } from './ui-text.ts';

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

    if (!notesCards || !errorContainer || !fabButton || !addNoteModal || !noteModal || !cancelNoteBtn || !submitNoteBtn || !noteError || !searchInput || !sortDropdown) {
        return;
    }

    const masterPassword = sessionStorage.getItem('masterPassword');
    const cryptoSalt = sessionStorage.getItem('cryptoSalt');
    if (!masterPassword || !cryptoSalt) {
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
        setStoredNotes(getStoredNotes().map((note) => note.id === noteId ? { ...note, ...patch } : note));
    };

    const filterNotes = (notes: Note[]) => {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
            return notes;
        }

        return notes.filter((note) => note.title.toLowerCase().includes(term));
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
            noteUpdateBtn.textContent = UI_TEXT.common.save;
            return;
        }

        const note = getStoredNotes().find((item) => item.id === currentNoteId);
        if (note) {
            title.textContent = note.title;
            content.textContent = note.encryptedContent;
            creationDate.textContent = new Date(note.createdAt).toLocaleString('ru-RU');
            updatedDate.textContent = new Date(note.updatedAt).toLocaleString('ru-RU');
        }

        noteUpdateBtn.textContent = UI_TEXT.common.edit;
    };

    const openNoteModal = (noteId: number) => {
        const note = getStoredNotes().find((item) => item.id === noteId);
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

    const toggleFavorite = async (noteId: number, nextState: boolean) => {
        if (nextState) {
            await addToFavorites('note', noteId);
        } else {
            await removeFromFavorites('note', noteId);
        }

        updateStoredNote(noteId, { isFavorite: nextState });
    };

    const bindCards = () => {
        notesCards.querySelectorAll<HTMLElement>('.card[data-note-id]').forEach((card) => {
            card.addEventListener('click', () => {
                openNoteModal(Number(card.dataset.noteId));
            });
        });

        notesCards.querySelectorAll<HTMLElement>('.add-new-card').forEach((card) => {
            card.addEventListener('click', openAddNoteModal);
        });

        notesCards.querySelectorAll<HTMLElement>('.card-favorite-toggle').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const noteId = Number(button.dataset.itemId);
                const isCurrentlyFavorite = button.dataset.isFavorite === 'true';
                if (!noteId) {
                    return;
                }

                try {
                    await toggleFavorite(noteId, !isCurrentlyFavorite);
                    await loadNotes();
                } catch (error: any) {
                    alert(`${UI_TEXT.common.errorPrefix}: ${error.message}`);
                }
            });
        });
    };

    const loadNotes = async () => {
        let notes = getStoredNotes();

        if (!sessionStorage.getItem('notes')) {
            const encryptedNotes = await getUserNotes() as Note[];
            notes = await decryptNotes(encryptedNotes, masterPassword, cryptoSalt);
            setStoredNotes(notes);
        }

        const visibleNotes = sortNotes(filterNotes(notes));
        notesCards.innerHTML = visibleNotes.map((note) => `
            <div class="card" data-note-id="${note.id}">
                <button
                    type="button"
                    class="card-favorite-toggle${note.isFavorite ? ' is-active' : ''}"
                    data-item-id="${note.id}"
                    data-is-favorite="${note.isFavorite ? 'true' : 'false'}"
                    aria-label="${favoriteButtonLabel(Boolean(note.isFavorite))}"
                    title="${favoriteButtonLabel(Boolean(note.isFavorite))}"
                >&starf;</button>
                <div class="card-logo"></div>
                <div class="card-details">
                    <h3>${note.title}</h3>
                    <p>${UI_TEXT.common.created}: ${new Date(note.createdAt).toLocaleDateString('ru-RU')}</p>
                </div>
            </div>
        `).join('') + '<button type="button" class="add-new-card" aria-label="Добавить заметку">+</button>';

        bindCards();
    };

    try {
        await loadNotes();
        errorContainer.style.display = 'none';
    } catch {
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
            const encryptedContent = await encryptOpaquePayload(content, masterPassword, cryptoSalt);
            const newNote = await addNote(title, encryptedContent);
            setStoredNotes([...getStoredNotes(), { ...newNote, encryptedContent: content, isFavorite: false }]);
            await loadNotes();
            clearAddForm();
            closeAllModals();
        } catch (error: any) {
            noteError.style.display = 'block';
            noteError.textContent = `${UI_TEXT.common.errorPrefix}: ${error.message}`;
        }
    });

    noteModal.addEventListener('click', (event) => {
        if (event.target === noteModal) {
            noteModal.style.display = 'none';
            toggleNoteEditMode(false);
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach((button) => {
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
            setStoredNotes(getStoredNotes().filter((note) => note.id !== currentNoteId));
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
            const encryptedContent = await encryptOpaquePayload(newContent, masterPassword, cryptoSalt);
            await updateNote(currentNoteId, newTitle, encryptedContent);
            updateStoredNote(currentNoteId, {
                title: newTitle,
                encryptedContent: newContent,
                updatedAt: new Date().toISOString()
            });
            toggleNoteEditMode(false);
            await loadNotes();
        } catch (error: any) {
            alert(`Ошибка при обновлении заметки: ${error.message}`);
        }
    });

    searchInput.addEventListener('input', debounce(async () => await loadNotes(), 300));
    sortDropdown.addEventListener('change', debounce(async () => await loadNotes(), 300));
});
