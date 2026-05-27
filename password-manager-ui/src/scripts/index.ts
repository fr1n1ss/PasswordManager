import {
    addAccount,
    addNote,
    addToFavorites,
    deleteAccount,
    deleteNote,
    getAccounts,
    getUserFavorites,
    getUserNotes,
    hashAll,
    removeFromFavorites,
    updateAccount,
    updateNote
} from '../services/api.ts';
import { getAuthToken, getMasterPassword } from '../services/security-session.ts';
import { decryptAccounts, decryptNotes, encryptOpaquePayload } from '../services/zero-knowledge.ts';
import { enhancePasswordField } from './password-visibility.ts';
import { navigateTo } from './routes.ts';
import { initializeSharedPageShell } from './shared-page.ts';
import { favoriteButtonLabel, UI_TEXT } from './ui-text.ts';

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

interface FavoritesResponse {
    accounts?: Array<{ id: number }>;
    notes?: Array<{ id: number }>;
}

const PASSWORD_MASK = '********';

function debounce(func: Function, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!sessionStorage.getItem('isDataLoaded')) {
        navigateTo('loading');
        return;
    }

    initializeSharedPageShell();

    const passwordCards = document.getElementById('passwordCards') as HTMLDivElement | null;
    const notesCards = document.getElementById('notesCards') as HTMLDivElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const fabButton = document.getElementById('fabButton') as HTMLDivElement | null;
    const addChoiceModal = document.getElementById('add-choice-modal') as HTMLDivElement | null;
    const addAccountModal = document.getElementById('add-account-modal') as HTMLDivElement | null;
    const addNoteModal = document.getElementById('add-note-modal') as HTMLDivElement | null;
    const chooseAccountBtn = document.getElementById('chooseAccount') as HTMLButtonElement | null;
    const chooseNoteBtn = document.getElementById('chooseNote') as HTMLButtonElement | null;
    const cancelAccountBtn = document.getElementById('cancel-account') as HTMLButtonElement | null;
    const cancelNoteBtn = document.getElementById('cancel-note') as HTMLButtonElement | null;
    const submitAccountBtn = document.getElementById('submit-account') as HTMLButtonElement | null;
    const submitNoteBtn = document.getElementById('submit-note') as HTMLButtonElement | null;
    const accountError = document.getElementById('account-error') as HTMLDivElement | null;
    const noteError = document.getElementById('note-error') as HTMLDivElement | null;
    const accountModal = document.getElementById('account-modal') as HTMLDivElement | null;
    const noteModal = document.getElementById('note-modal') as HTMLDivElement | null;
    const searchInput = document.querySelector('.search-bar') as HTMLInputElement | null;
    const sortDropdown = document.querySelector('.sort-dropdown') as HTMLSelectElement | null;

    if (!passwordCards || !notesCards || !errorContainer || !fabButton || !addChoiceModal || !addAccountModal || !addNoteModal || !chooseAccountBtn || !chooseNoteBtn || !cancelAccountBtn || !cancelNoteBtn || !submitAccountBtn || !submitNoteBtn || !accountError || !noteError || !accountModal || !noteModal || !searchInput || !sortDropdown) {
        return;
    }

    const token = getAuthToken();
    const masterPassword = getMasterPassword();
    const cryptoSalt = sessionStorage.getItem('cryptoSalt');
    if (!token) {
        navigateTo('login');
        return;
    }

    if (!masterPassword || !cryptoSalt) {
        navigateTo('loading');
        return;
    }

    let currentAccountId: number | null = null;
    let currentNoteId: number | null = null;
    let isAccountEditMode = false;
    let isNoteEditMode = false;
    let passwordRevealTimer: number | undefined;
    const accountPasswordInput = document.getElementById('account-password') as HTMLInputElement | null;
    const copyAccountPasswordBtn = document.getElementById('copy-account-password') as HTMLButtonElement | null;
    const copyNoteContentBtn = document.getElementById('copy-note-content') as HTMLButtonElement | null;

    if (accountPasswordInput) {
        enhancePasswordField(accountPasswordInput);
    }

    const markCopyButtonCopied = (button: HTMLButtonElement, defaultLabel: string) => {
        button.classList.add('is-copied');
        button.setAttribute('aria-label', 'Скопировано');
        button.setAttribute('title', 'Скопировано');
        window.setTimeout(() => {
            button.classList.remove('is-copied');
            button.setAttribute('aria-label', defaultLabel);
            button.setAttribute('title', defaultLabel);
        }, 1200);
    };

    const getCurrentAccount = () => getStoredAccounts().find((item) => item.id === currentAccountId);

    const maskModalPassword = () => {
        const passwordNode = document.getElementById('modal-encrypted-password') as HTMLElement | null;
        if (!passwordNode) {
            return;
        }

        const account = getCurrentAccount();
        passwordNode.textContent = account?.encryptedPassword ? PASSWORD_MASK : UI_TEXT.common.notSpecified;
        passwordNode.classList.toggle('is-masked', Boolean(account?.encryptedPassword));
    };

    const revealModalPasswordTemporarily = (password: string) => {
        const passwordNode = document.getElementById('modal-encrypted-password') as HTMLElement | null;
        if (!passwordNode) {
            return;
        }

        if (passwordRevealTimer) {
            window.clearTimeout(passwordRevealTimer);
        }

        passwordNode.textContent = password;
        passwordNode.classList.remove('is-masked');
        passwordRevealTimer = window.setTimeout(maskModalPassword, 2200);
    };

    const getStoredAccounts = () => JSON.parse(sessionStorage.getItem('accounts') || '[]') as Account[];
    const getStoredNotes = () => JSON.parse(sessionStorage.getItem('notes') || '[]') as Note[];
    const setStoredAccounts = (accounts: Account[]) => sessionStorage.setItem('accounts', JSON.stringify(accounts));
    const setStoredNotes = (notes: Note[]) => sessionStorage.setItem('notes', JSON.stringify(notes));
    const getStoredAccountsServerHash = () => sessionStorage.getItem('accountsServerHash');
    const getStoredNotesServerHash = () => sessionStorage.getItem('notesServerHash');
    const setStoredServerHashes = (accountsHash: string, notesHash: string) => {
        sessionStorage.setItem('accountsServerHash', accountsHash);
        sessionStorage.setItem('notesServerHash', notesHash);
    };
    const syncStoredFavoriteStates = async (accounts: Account[], notes: Note[]) => {
        const favorites = await getUserFavorites() as FavoritesResponse;
        const favoriteAccountIds = new Set((favorites.accounts || []).map((account) => account.id));
        const favoriteNoteIds = new Set((favorites.notes || []).map((note) => note.id));

        const syncedAccounts = accounts.map((account) => ({
            ...account,
            isFavorite: favoriteAccountIds.has(account.id)
        }));
        const syncedNotes = notes.map((note) => ({
            ...note,
            isFavorite: favoriteNoteIds.has(note.id)
        }));

        setStoredAccounts(syncedAccounts);
        setStoredNotes(syncedNotes);

        return { accounts: syncedAccounts, notes: syncedNotes };
    };

    const closeAllModals = () => {
        [addChoiceModal, addAccountModal, addNoteModal, accountModal, noteModal].forEach((modal) => {
            modal.style.display = 'none';
        });
        accountError.style.display = 'none';
        noteError.style.display = 'none';
    };

    const clearAccountForm = () => {
        (document.getElementById('account-service-name') as HTMLInputElement).value = '';
        (document.getElementById('account-login') as HTMLInputElement).value = '';
        (document.getElementById('account-password') as HTMLInputElement).value = '';
        (document.getElementById('account-description') as HTMLTextAreaElement).value = '';
        (document.getElementById('account-url') as HTMLInputElement).value = '';
    };

    const clearNoteForm = () => {
        (document.getElementById('note-title') as HTMLInputElement).value = '';
        (document.getElementById('note-content') as HTMLTextAreaElement).value = '';
    };

    const openAddAccountModal = () => {
        closeAllModals();
        addAccountModal.style.display = 'flex';
    };

    const openAddNoteModal = () => {
        closeAllModals();
        addNoteModal.style.display = 'flex';
    };

    const filterCards = <T extends Account | Note>(items: T[], type: 'account' | 'note') => {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
            return items;
        }

        return items.filter((item) =>
            type === 'account'
                ? (item as Account).serviceName.toLowerCase().includes(term)
                : (item as Note).title.toLowerCase().includes(term)
        );
    };

    const sortAccounts = (accounts: Account[]) => {
        const sorted = [...accounts];
        switch (sortDropdown.value) {
            case 'az':
                sorted.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
                break;
            case 'za':
                sorted.sort((a, b) => b.serviceName.localeCompare(a.serviceName));
                break;
            case 'oldest':
                sorted.sort((a, b) => new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime());
                break;
            case 'newest':
                sorted.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                break;
        }
        return sorted;
    };

    const sortNotes = (notes: Note[]) => {
        const sorted = [...notes];
        switch (sortDropdown.value) {
            case 'az':
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'za':
                sorted.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'oldest':
                sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'newest':
                sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }
        return sorted;
    };

    const updateStoredAccount = (accountId: number, patch: Partial<Account>) => {
        setStoredAccounts(getStoredAccounts().map((account) => account.id === accountId ? { ...account, ...patch } : account));
    };

    const updateStoredNote = (noteId: number, patch: Partial<Note>) => {
        setStoredNotes(getStoredNotes().map((note) => note.id === noteId ? { ...note, ...patch } : note));
    };

    const toggleFavorite = async (type: 'account' | 'note', itemId: number, nextState: boolean) => {
        if (nextState) {
            await addToFavorites(type, itemId);
        } else {
            await removeFromFavorites(type, itemId);
        }

        if (type === 'account') {
            updateStoredAccount(itemId, { isFavorite: nextState });
        } else {
            updateStoredNote(itemId, { isFavorite: nextState });
        }
    };

    const loadAccounts = async () => {
        // TEMP PERF MEASURE: remove this block after performance research.
        const measureStarted = performance.now();
        let storageReadFinished = measureStarted;
        let serverLoadFinished = measureStarted;
        let decryptFinished = measureStarted;
        let favoritesSyncFinished = measureStarted;
        let filterSortFinished = measureStarted;
        let renderFinished = measureStarted;

        let accounts = getStoredAccounts();
        storageReadFinished = performance.now();

        if (!sessionStorage.getItem('accounts')) {
            const encryptedAccounts = await getAccounts() as Account[];
            serverLoadFinished = performance.now();
            accounts = await decryptAccounts(encryptedAccounts, masterPassword, cryptoSalt);
            decryptFinished = performance.now();
        } else {
            serverLoadFinished = storageReadFinished;
            decryptFinished = storageReadFinished;
        }

        const synced = await syncStoredFavoriteStates(accounts, getStoredNotes());
        accounts = synced.accounts;
        favoritesSyncFinished = performance.now();

        const filtered = sortAccounts(filterCards(accounts, 'account'));
        filterSortFinished = performance.now();

        passwordCards.innerHTML = filtered.map((account) => `
            <div class="card" data-account-id="${account.id}">
                <button
                    type="button"
                    class="card-favorite-toggle${account.isFavorite ? ' is-active' : ''}"
                    data-favorite-type="account"
                    data-item-id="${account.id}"
                    data-is-favorite="${account.isFavorite ? 'true' : 'false'}"
                    aria-label="${favoriteButtonLabel(Boolean(account.isFavorite))}"
                    title="${favoriteButtonLabel(Boolean(account.isFavorite))}"
                >&starf;</button>
                <div class="card-logo">
                    <img src="${account.url ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}&sz=64` : 'https://via.placeholder.com/32'}" alt="${account.serviceName} logo" loading="lazy" onload="if (this.naturalWidth <= 16 && this.naturalHeight <= 16) { const fallback=document.createElement('span'); fallback.className='card-logo-initial'; fallback.textContent=(this.alt || '?').trim()[0].toUpperCase(); this.replaceWith(fallback); }" onerror="const fallback=document.createElement('span'); fallback.className='card-logo-initial'; fallback.textContent=(this.alt || '?').trim()[0].toUpperCase(); this.replaceWith(fallback);" />
                </div>
                <div class="card-details">
                    <h3>${account.serviceName}</h3>
                    <p>${account.login}</p>
                </div>
            </div>
        `).join('') + '<button type="button" class="add-new-card" data-add-type="account" aria-label="Добавить аккаунт">+</button>';
        renderFinished = performance.now();
        console.info(`[PERF index accounts] done: ${Number((renderFinished - measureStarted).toFixed(2))} ms, accounts: ${accounts.length}, visible: ${filtered.length}`);
        console.table({
            '1 sessionStorage read, ms': Number((storageReadFinished - measureStarted).toFixed(2)),
            '2 server GetAccounts, ms': Number((serverLoadFinished - storageReadFinished).toFixed(2)),
            '3 decrypt accounts, ms': Number((decryptFinished - serverLoadFinished).toFixed(2)),
            '4 favorites sync, ms': Number((favoritesSyncFinished - decryptFinished).toFixed(2)),
            '5 filter and sort, ms': Number((filterSortFinished - favoritesSyncFinished).toFixed(2)),
            '6 render accounts html, ms': Number((renderFinished - filterSortFinished).toFixed(2)),
            'total, ms': Number((renderFinished - measureStarted).toFixed(2)),
            'all accounts': accounts.length,
            'visible accounts': filtered.length,
        });
    };

    const loadNotes = async () => {
        // TEMP PERF MEASURE: remove this block after performance research.
        const measureStarted = performance.now();
        let storageReadFinished = measureStarted;
        let serverLoadFinished = measureStarted;
        let decryptFinished = measureStarted;
        let favoritesSyncFinished = measureStarted;
        let filterSortFinished = measureStarted;
        let renderFinished = measureStarted;

        let notes = getStoredNotes();
        storageReadFinished = performance.now();

        if (!sessionStorage.getItem('notes')) {
            const encryptedNotes = await getUserNotes() as Note[];
            serverLoadFinished = performance.now();
            notes = await decryptNotes(encryptedNotes, masterPassword, cryptoSalt);
            decryptFinished = performance.now();
        } else {
            serverLoadFinished = storageReadFinished;
            decryptFinished = storageReadFinished;
        }

        const synced = await syncStoredFavoriteStates(getStoredAccounts(), notes);
        notes = synced.notes;
        favoritesSyncFinished = performance.now();

        const filtered = sortNotes(filterCards(notes, 'note'));
        filterSortFinished = performance.now();

        notesCards.innerHTML = filtered.map((note) => `
            <div class="card" data-note-id="${note.id}">
                <button
                    type="button"
                    class="card-favorite-toggle${note.isFavorite ? ' is-active' : ''}"
                    data-favorite-type="note"
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
        `).join('') + '<button type="button" class="add-new-card" data-add-type="note" aria-label="Добавить заметку">+</button>';
        renderFinished = performance.now();
        console.info(`[PERF index notes] done: ${Number((renderFinished - measureStarted).toFixed(2))} ms, notes: ${notes.length}, visible: ${filtered.length}`);
        console.table({
            '1 sessionStorage read, ms': Number((storageReadFinished - measureStarted).toFixed(2)),
            '2 server GetNotes, ms': Number((serverLoadFinished - storageReadFinished).toFixed(2)),
            '3 decrypt notes, ms': Number((decryptFinished - serverLoadFinished).toFixed(2)),
            '4 favorites sync, ms': Number((favoritesSyncFinished - decryptFinished).toFixed(2)),
            '5 filter and sort, ms': Number((filterSortFinished - favoritesSyncFinished).toFixed(2)),
            '6 render notes html, ms': Number((renderFinished - filterSortFinished).toFixed(2)),
            'total, ms': Number((renderFinished - measureStarted).toFixed(2)),
            'all notes': notes.length,
            'visible notes': filtered.length,
        });
    };

    const bindCards = () => {
        passwordCards.querySelectorAll<HTMLElement>('.card[data-account-id]').forEach((card) => {
            card.addEventListener('click', () => openAccountModal(Number(card.dataset.accountId)));
        });

        notesCards.querySelectorAll<HTMLElement>('.card[data-note-id]').forEach((card) => {
            card.addEventListener('click', () => openNoteModal(Number(card.dataset.noteId)));
        });

        passwordCards.querySelectorAll<HTMLElement>('.add-new-card').forEach((card) => {
            card.addEventListener('click', openAddAccountModal);
        });

        notesCards.querySelectorAll<HTMLElement>('.add-new-card').forEach((card) => {
            card.addEventListener('click', openAddNoteModal);
        });

        document.querySelectorAll<HTMLElement>('.card-favorite-toggle').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const type = button.dataset.favoriteType as 'account' | 'note' | undefined;
                const itemId = Number(button.dataset.itemId);
                const isCurrentlyFavorite = button.dataset.isFavorite === 'true';

                if (!type || !itemId) {
                    return;
                }

                try {
                    await toggleFavorite(type, itemId, !isCurrentlyFavorite);
                    await reloadVisibleCards();
                } catch (error: any) {
                    alert(`${UI_TEXT.common.errorPrefix}: ${error.message}`);
                }
            });
        });
    };

    const reloadVisibleCards = async () => {
        // TEMP PERF MEASURE: remove this block after performance research.
        const measureStarted = performance.now();
        await Promise.all([loadAccounts(), loadNotes()]);
        const loadFinished = performance.now();
        bindCards();
        const bindFinished = performance.now();
        errorContainer.style.display = 'none';
        console.info(`[PERF index reloadVisibleCards] done: ${Number((bindFinished - measureStarted).toFixed(2))} ms`);
        console.table({
            '1 load accounts and notes, ms': Number((loadFinished - measureStarted).toFixed(2)),
            '2 bind all cards, ms': Number((bindFinished - loadFinished).toFixed(2)),
            'total, ms': Number((bindFinished - measureStarted).toFixed(2)),
            'accounts in storage': getStoredAccounts().length,
            'notes in storage': getStoredNotes().length,
        });
    };

    const syncData = async () => {
        // TEMP PERF MEASURE: remove this block after performance research.
        const measureStarted = performance.now();
        let hashFinished = measureStarted;
        let accountsRefreshFinished = measureStarted;
        let notesRefreshFinished = measureStarted;
        let reloadFinished = measureStarted;
        let accountsChanged = false;
        let notesChanged = false;

        try {
            const { accountsHash, notesHash } = await hashAll();
            hashFinished = performance.now();
            const previousAccountsHash = getStoredAccountsServerHash();
            const previousNotesHash = getStoredNotesServerHash();

            if (!previousAccountsHash || !previousNotesHash) {
                setStoredServerHashes(accountsHash, notesHash);
                console.info(`[PERF index syncData] hashes initialized: ${Number((hashFinished - measureStarted).toFixed(2))} ms`);
                return;
            }

            if (previousAccountsHash !== accountsHash) {
                accountsChanged = true;
                setStoredAccounts(await decryptAccounts(await getAccounts() as Account[], masterPassword, cryptoSalt));
            }
            accountsRefreshFinished = performance.now();

            if (previousNotesHash !== notesHash) {
                notesChanged = true;
                setStoredNotes(await decryptNotes(await getUserNotes() as Note[], masterPassword, cryptoSalt));
            }
            notesRefreshFinished = performance.now();

            if (previousAccountsHash !== accountsHash || previousNotesHash !== notesHash) {
                setStoredServerHashes(accountsHash, notesHash);
                await reloadVisibleCards();
            }
            reloadFinished = performance.now();

            console.info(`[PERF index syncData] done: ${Number((reloadFinished - measureStarted).toFixed(2))} ms, accountsChanged: ${accountsChanged}, notesChanged: ${notesChanged}`);
            console.table({
                '1 server hashAll, ms': Number((hashFinished - measureStarted).toFixed(2)),
                '2 accounts refresh if changed, ms': Number((accountsRefreshFinished - hashFinished).toFixed(2)),
                '3 notes refresh if changed, ms': Number((notesRefreshFinished - accountsRefreshFinished).toFixed(2)),
                '4 reload visible cards if changed, ms': Number((reloadFinished - notesRefreshFinished).toFixed(2)),
                'total, ms': Number((reloadFinished - measureStarted).toFixed(2)),
                accountsChanged,
                notesChanged,
            });
        } catch (error) {
            console.error('[syncData] Ошибка синхронизации:', error);
        }
    };

    const toggleAccountEditMode = (enable: boolean) => {
        isAccountEditMode = enable;
        const serviceName = document.getElementById('modal-service-name') as HTMLElement;
        const login = document.getElementById('modal-login') as HTMLElement;
        const encryptedPassword = document.getElementById('modal-encrypted-password') as HTMLElement;
        const description = document.getElementById('modal-description') as HTMLElement;
        const url = document.getElementById('modal-url') as HTMLElement;
        const creationDate = document.getElementById('modal-creation-date') as HTMLElement;
        const accountUpdateBtn = document.getElementById('account-update-btn') as HTMLButtonElement;
        const account = getCurrentAccount();

        if (enable) {
            if (passwordRevealTimer) {
                window.clearTimeout(passwordRevealTimer);
            }
            serviceName.innerHTML = `<input type="text" id="edit-service-name" value="${serviceName.textContent || ''}" />`;
            login.innerHTML = `<input type="text" id="edit-login" value="${login.textContent || ''}" />`;
            encryptedPassword.innerHTML = `<input type="text" id="edit-encrypted-password" value="${account?.encryptedPassword || ''}" />`;
            encryptedPassword.classList.remove('is-masked');
            description.innerHTML = `<textarea id="edit-description">${description.textContent || ''}</textarea>`;
            url.innerHTML = `<input type="text" id="edit-url" value="${url.textContent || ''}" />`;
            accountUpdateBtn.textContent = UI_TEXT.common.save;
            return;
        }

        if (account) {
            serviceName.textContent = account.serviceName;
            login.textContent = account.login;
            description.textContent = account.description || UI_TEXT.common.notSpecifiedNeuter;
            url.textContent = account.url || UI_TEXT.common.notSpecified;
            creationDate.textContent = new Date(account.creationDate).toLocaleString('ru-RU');
            maskModalPassword();
        }

        accountUpdateBtn.textContent = UI_TEXT.common.edit;
    };

    const toggleNoteEditMode = (enable: boolean) => {
        isNoteEditMode = enable;
        const title = document.getElementById('modal-note-title') as HTMLElement;
        const content = document.getElementById('modal-note-content') as HTMLElement;
        const creationDate = document.getElementById('modal-note-creation-date') as HTMLElement;
        const updatedDate = document.getElementById('modal-note-updated-date') as HTMLElement;
        const noteUpdateBtn = document.getElementById('note-update-btn') as HTMLButtonElement;

        if (enable) {
            title.innerHTML = `<input type="text" id="edit-note-title" class="modal-inline-input" value="${title.textContent || ''}" />`;
            content.innerHTML = `<textarea id="edit-note-content" class="modal-inline-textarea">${content.textContent || ''}</textarea>`;
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

    const openAccountModal = (accountId: number) => {
        const account = getStoredAccounts().find((item) => item.id === accountId);
        if (!account) {
            return;
        }

        currentAccountId = accountId;
        (document.getElementById('modal-service-name') as HTMLElement).textContent = account.serviceName;
        (document.getElementById('modal-login') as HTMLElement).textContent = account.login;
        (document.getElementById('modal-description') as HTMLElement).textContent = account.description || UI_TEXT.common.notSpecifiedNeuter;
        (document.getElementById('modal-url') as HTMLElement).textContent = account.url || UI_TEXT.common.notSpecified;
        (document.getElementById('modal-creation-date') as HTMLElement).textContent = new Date(account.creationDate).toLocaleString('ru-RU');
        maskModalPassword();
        accountModal.style.display = 'flex';
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

    try {
        await reloadVisibleCards();
    } catch {
        errorContainer.style.display = 'block';
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Ошибка при загрузке данных';
        }
        return;
    }

    fabButton.addEventListener('click', () => {
        closeAllModals();
        addChoiceModal.style.display = 'flex';
    });

    chooseAccountBtn.addEventListener('click', openAddAccountModal);
    chooseNoteBtn.addEventListener('click', openAddNoteModal);

    [addChoiceModal, addAccountModal, addNoteModal, accountModal, noteModal].forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeAllModals();
                toggleAccountEditMode(false);
                toggleNoteEditMode(false);
            }
        });
    });

    cancelAccountBtn.addEventListener('click', () => {
        closeAllModals();
        clearAccountForm();
    });

    cancelNoteBtn.addEventListener('click', () => {
        closeAllModals();
        clearNoteForm();
    });

    submitAccountBtn.addEventListener('click', async () => {
        const serviceName = (document.getElementById('account-service-name') as HTMLInputElement).value.trim();
        const login = (document.getElementById('account-login') as HTMLInputElement).value.trim();
        const password = (document.getElementById('account-password') as HTMLInputElement).value.trim();
        const description = (document.getElementById('account-description') as HTMLTextAreaElement).value.trim();
        const url = (document.getElementById('account-url') as HTMLInputElement).value.trim();

        if (!serviceName || !login || !password) {
            accountError.style.display = 'block';
            accountError.textContent = 'Заполните все обязательные поля';
            return;
        }

        try {
            const encryptedPassword = await encryptOpaquePayload(password, masterPassword, cryptoSalt);
            const newAccount = await addAccount({ serviceName, login, password: encryptedPassword, description, url });
            setStoredAccounts([...getStoredAccounts(), { ...newAccount, encryptedPassword: password, isFavorite: false }]);
            clearAccountForm();
            closeAllModals();
            await reloadVisibleCards();
        } catch (error: any) {
            accountError.style.display = 'block';
            accountError.textContent = `${UI_TEXT.common.errorPrefix}: ${error.message}`;
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
            const encryptedContent = await encryptOpaquePayload(content, masterPassword, cryptoSalt);
            const newNote = await addNote(title, encryptedContent);
            setStoredNotes([...getStoredNotes(), { ...newNote, encryptedContent: content, isFavorite: false }]);
            clearNoteForm();
            closeAllModals();
            await reloadVisibleCards();
        } catch (error: any) {
            noteError.style.display = 'block';
            noteError.textContent = `${UI_TEXT.common.errorPrefix}: ${error.message}`;
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach((button) => {
        button.addEventListener('click', () => {
            closeAllModals();
            toggleAccountEditMode(false);
            toggleNoteEditMode(false);
        });
    });

    (document.getElementById('account-delete-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!currentAccountId) {
            return;
        }

        try {
            await deleteAccount(currentAccountId);
            setStoredAccounts(getStoredAccounts().filter((account) => account.id !== currentAccountId));
            closeAllModals();
            await reloadVisibleCards();
        } catch (error: any) {
            alert(`${UI_TEXT.common.errorPrefix}: ${error.message}`);
        }
    });

    copyAccountPasswordBtn?.addEventListener('click', async () => {
        const password = getCurrentAccount()?.encryptedPassword || '';
        if (!password || password === UI_TEXT.common.notSpecified) {
            return;
        }

        await navigator.clipboard.writeText(password);
        revealModalPasswordTemporarily(password);
        markCopyButtonCopied(copyAccountPasswordBtn, 'Скопировать пароль');
    });

    copyNoteContentBtn?.addEventListener('click', async () => {
        const content = (document.getElementById('modal-note-content') as HTMLElement | null)?.textContent || '';
        if (!content) {
            return;
        }

        await navigator.clipboard.writeText(content);
        markCopyButtonCopied(copyNoteContentBtn, 'Скопировать содержимое');
    });

    (document.getElementById('note-delete-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!currentNoteId) {
            return;
        }

        try {
            await deleteNote(currentNoteId);
            setStoredNotes(getStoredNotes().filter((note) => note.id !== currentNoteId));
            closeAllModals();
            await reloadVisibleCards();
        } catch (error: any) {
            alert(`${UI_TEXT.common.errorPrefix}: ${error.message}`);
        }
    });

    (document.getElementById('account-update-btn') as HTMLButtonElement).addEventListener('click', async () => {
        if (!isAccountEditMode) {
            toggleAccountEditMode(true);
            return;
        }

        if (!currentAccountId) {
            return;
        }

        const login = (document.getElementById('edit-login') as HTMLInputElement).value;
        const password = (document.getElementById('edit-encrypted-password') as HTMLInputElement).value;
        const serviceName = (document.getElementById('edit-service-name') as HTMLInputElement).value;
        const url = (document.getElementById('edit-url') as HTMLInputElement).value;
        const description = (document.getElementById('edit-description') as HTMLTextAreaElement).value;

        try {
            const encryptedPassword = await encryptOpaquePayload(password, masterPassword, cryptoSalt);
            await updateAccount({
                id: currentAccountId,
                newLogin: login,
                newPassword: encryptedPassword,
                newURL: url,
                newDescription: description,
                newServiceName: serviceName,
            });

            updateStoredAccount(currentAccountId, {
                login,
                encryptedPassword: password,
                serviceName,
                url,
                description
            });

            toggleAccountEditMode(false);
            await reloadVisibleCards();
        } catch (error: any) {
            alert(`${UI_TEXT.common.errorPrefix}: ${error.message}`);
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
            await reloadVisibleCards();
        } catch (error: any) {
            alert(`${UI_TEXT.common.errorPrefix}: ${error.message}`);
        }
    });

    searchInput.addEventListener('input', debounce(async () => {
        await reloadVisibleCards();
    }, 300));

    sortDropdown.addEventListener('change', debounce(async () => {
        await reloadVisibleCards();
    }, 300));

    setInterval(syncData, 10000);
});
