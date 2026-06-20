import { getAccounts, getUserFavorites, getUserNotes } from '../services/api.ts';
import { decryptOpaquePayload } from '../services/zero-knowledge.ts';

export interface Account {
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

export interface Note {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
    isFavorite?: boolean;
}

export interface FavoriteIdsResponse {
    accounts?: Array<{ id: number }>;
    notes?: Array<{ id: number }>;
}

export interface FavoritesResponse {
    accounts: Account[];
    notes: Note[];
}

export const getStoredAccounts = () => JSON.parse(sessionStorage.getItem('accounts') || '[]') as Account[];
export const getStoredNotes = () => JSON.parse(sessionStorage.getItem('notes') || '[]') as Note[];
export const setStoredAccounts = (accounts: Account[]) => sessionStorage.setItem('accounts', JSON.stringify(accounts));
export const setStoredNotes = (notes: Note[]) => sessionStorage.setItem('notes', JSON.stringify(notes));

export async function loadAccountsFromCacheOrApi(masterPassword: string, cryptoSalt: string): Promise<Account[]> {
    if (sessionStorage.getItem('accounts')) {
        return getStoredAccounts();
    }

    const accounts = await getAccounts() as Account[];
    setStoredAccounts(accounts);
    return accounts;
}

export async function loadNotesFromCacheOrApi(masterPassword: string, cryptoSalt: string): Promise<Note[]> {
    if (sessionStorage.getItem('notes')) {
        return getStoredNotes();
    }

    const notes = await getUserNotes() as Note[];
    setStoredNotes(notes);
    return notes;
}

export async function decryptAccountPassword(account: Account, masterPassword: string, cryptoSalt: string): Promise<string> {
    return decryptOpaquePayload(account.encryptedPassword, masterPassword, cryptoSalt);
}

export async function decryptNoteContent(note: Note, masterPassword: string, cryptoSalt: string): Promise<string> {
    return decryptOpaquePayload(note.encryptedContent, masterPassword, cryptoSalt);
}

export async function syncFavoriteStateForAccounts(accounts: Account[]): Promise<Account[]> {
    const favorites = await getUserFavorites() as FavoriteIdsResponse;
    const favoriteIds = new Set((favorites.accounts || []).map((account) => account.id));
    const syncedAccounts = accounts.map((account) => ({
        ...account,
        isFavorite: favoriteIds.has(account.id),
    }));
    setStoredAccounts(syncedAccounts);
    return syncedAccounts;
}

export async function syncFavoriteStateForNotes(notes: Note[]): Promise<Note[]> {
    const favorites = await getUserFavorites() as FavoriteIdsResponse;
    const favoriteIds = new Set((favorites.notes || []).map((note) => note.id));
    const syncedNotes = notes.map((note) => ({
        ...note,
        isFavorite: favoriteIds.has(note.id),
    }));
    setStoredNotes(syncedNotes);
    return syncedNotes;
}

export async function syncStoredFavoriteStates(accounts: Account[], notes: Note[]): Promise<FavoritesResponse> {
    const favorites = await getUserFavorites() as FavoriteIdsResponse;
    const favoriteAccountIds = new Set((favorites.accounts || []).map((account) => account.id));
    const favoriteNoteIds = new Set((favorites.notes || []).map((note) => note.id));

    const syncedAccounts = accounts.map((account) => ({
        ...account,
        isFavorite: favoriteAccountIds.has(account.id),
    }));
    const syncedNotes = notes.map((note) => ({
        ...note,
        isFavorite: favoriteNoteIds.has(note.id),
    }));

    setStoredAccounts(syncedAccounts);
    setStoredNotes(syncedNotes);

    return { accounts: syncedAccounts, notes: syncedNotes };
}

export async function loadFavoriteItems(masterPassword: string, cryptoSalt: string): Promise<FavoritesResponse> {
    const payload = await getUserFavorites() as FavoritesResponse;
    return {
        accounts: payload.accounts,
        notes: payload.notes,
    };
}
