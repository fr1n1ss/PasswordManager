import type { Account, Note } from './shared-data.ts';
import { favoriteButtonLabel, UI_TEXT } from './ui-text.ts';

type FavoriteMode = 'toggle' | 'remove';

interface CardOptions {
    favoriteMode?: FavoriteMode;
}

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] || char));
}

function getAccountInitial(serviceName: string): string {
    const trimmedName = serviceName.trim();
    return trimmedName ? trimmedName[0].toUpperCase() : '?';
}

function renderFavoriteButton(type: 'account' | 'note', id: number, isFavorite: boolean, mode: FavoriteMode): string {
    if (mode === 'remove') {
        return `
            <button
                type="button"
                class="card-favorite-toggle is-active"
                data-unfavorite-${type}-id="${id}"
                aria-label="${favoriteButtonLabel(true)}"
                title="${favoriteButtonLabel(true)}"
            >&starf;</button>
        `;
    }

    return `
        <button
            type="button"
            class="card-favorite-toggle${isFavorite ? ' is-active' : ''}"
            data-favorite-type="${type}"
            data-item-id="${id}"
            data-is-favorite="${isFavorite ? 'true' : 'false'}"
            aria-label="${favoriteButtonLabel(isFavorite)}"
            title="${favoriteButtonLabel(isFavorite)}"
        >&starf;</button>
    `;
}

export function renderAccountCard(account: Account, options: CardOptions = {}): string {
    const mode = options.favoriteMode || 'toggle';
    const serviceName = escapeHtml(account.serviceName);
    const login = escapeHtml(account.login);
    const logoInitial = escapeHtml(getAccountInitial(account.serviceName));
    const logoUrl = account.url
        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(account.url)}&sz=64`
        : '';

    return `
        <div class="card" data-account-id="${account.id}">
            ${renderFavoriteButton('account', account.id, Boolean(account.isFavorite), mode)}
            <div class="card-logo">
                ${logoUrl
                    ? `<img src="${logoUrl}" alt="${serviceName} logo" loading="lazy" onload="if (this.naturalWidth <= 16 && this.naturalHeight <= 16) { this.style.display='none'; this.nextElementSibling.style.display='inline-flex'; }" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />`
                    : ''}
                <span class="card-logo-initial" aria-hidden="true"${logoUrl ? ' style="display: none;"' : ''}>${logoInitial}</span>
            </div>
            <div class="card-details">
                <h3>${serviceName}</h3>
                <p>${login}</p>
            </div>
        </div>
    `;
}

export function renderNoteCard(note: Note, options: CardOptions = {}): string {
    const mode = options.favoriteMode || 'toggle';
    const title = escapeHtml(note.title);

    return `
        <div class="card" data-note-id="${note.id}">
            ${renderFavoriteButton('note', note.id, Boolean(note.isFavorite), mode)}
            <div class="card-logo"></div>
            <div class="card-details">
                <h3>${title}</h3>
                <p>${UI_TEXT.common.created}: ${new Date(note.createdAt).toLocaleDateString('ru-RU')}</p>
            </div>
        </div>
    `;
}

export const renderAddAccountCard = () =>
    '<button type="button" class="add-new-card" data-add-type="account" aria-label="Добавить аккаунт">+</button>';

export const renderAddNoteCard = () =>
    '<button type="button" class="add-new-card" data-add-type="note" aria-label="Добавить заметку">+</button>';
