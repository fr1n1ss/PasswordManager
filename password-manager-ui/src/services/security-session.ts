const AUTH_TOKEN_KEY = 'authToken';
const MASTER_PASSWORD_KEY = 'masterPassword';
const LAST_ACTIVITY_KEY = 'sensitiveSessionLastActivity';
const SENSITIVE_SESSION_TTL_MS = 15 * 60 * 1000;

function now(): string {
    return Date.now().toString();
}

function getLastActivity(): number | null {
    const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) {
        return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

export function getAuthToken(): string | null {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function touchSensitiveSession(): void {
    if (sessionStorage.getItem(MASTER_PASSWORD_KEY)) {
        sessionStorage.setItem(LAST_ACTIVITY_KEY, now());
    }
}

export function setMasterPassword(masterPassword: string): void {
    sessionStorage.setItem(MASTER_PASSWORD_KEY, masterPassword);
    sessionStorage.setItem(LAST_ACTIVITY_KEY, now());
}

export function clearSensitiveSession(preserveIdentity = false): void {
    sessionStorage.removeItem(MASTER_PASSWORD_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem('accounts');
    sessionStorage.removeItem('notes');
    sessionStorage.removeItem('isDataLoaded');
    sessionStorage.removeItem('notesLoadError');

    if (!preserveIdentity) {
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('cryptoSalt');
    }
}

export function getMasterPassword(): string | null {
    const masterPassword = sessionStorage.getItem(MASTER_PASSWORD_KEY);
    if (!masterPassword) {
        return null;
    }

    const lastActivity = getLastActivity();
    if (!lastActivity || Date.now() - lastActivity > SENSITIVE_SESSION_TTL_MS) {
        clearSensitiveSession();
        return null;
    }

    sessionStorage.setItem(LAST_ACTIVITY_KEY, now());
    return masterPassword;
}
