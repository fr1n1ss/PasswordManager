import { addEncryptedTotpAccount, deleteTotpAccount, getTotpAccounts, importTotpQrText } from '../services/api.ts';
import { getAuthToken, getMasterPassword } from '../services/security-session.ts';
import { decryptStringWithKuznyechik, encryptStringWithKuznyechik } from '../services/kuznyechik.ts';
import { navigateTo } from './routes.ts';
import { initializeSharedPageShell } from './shared-page.ts';
import { UI_TEXT } from './ui-text.ts';

interface TotpAccount {
    id: number;
    userId: number;
    serviceName: string;
    issuer: string;
    secret: string;
    digits: number;
    period: number;
}

interface TotpPayload {
    serviceName: string;
    issuer: string;
    secret: string;
    digits: number;
    period: number;
}

interface TotpViewModel {
    id: number;
    serviceName: string;
    issuer: string;
    digits: number;
    period: number;
    code: string;
    secondsLeft: number;
}

function debounce(func: Function, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

function decodeBase32(input: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const normalized = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
    let bits = '';

    for (const char of normalized) {
        const index = alphabet.indexOf(char);
        if (index === -1) {
            throw new Error('Invalid Base32 secret');
        }

        bits += index.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
        bytes.push(parseInt(bits.slice(index, index + 8), 2));
    }

    return new Uint8Array(bytes);
}

async function generateTotpCode(secret: string, digits = 6, period = 30): Promise<string> {
    const keyData = decodeBase32(secret);
    const currentUnixSeconds = Math.floor(Date.now() / 1000);
    const counter = Math.floor(currentUnixSeconds / period);

    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(0, Math.floor(counter / 0x100000000), false);
    counterView.setUint32(4, counter >>> 0, false);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
    const hash = new Uint8Array(signature);
    const offset = hash[hash.length - 1] & 0x0f;

    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    const otp = binary % (10 ** digits);
    return otp.toString().padStart(digits, '0');
}

function parseOtpAuthUri(uri: string): TotpPayload {
    const parsed = new URL(uri);
    const label = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    const labelParts = label.split(':');
    const accountName = labelParts.length > 1 ? labelParts.slice(1).join(':') : label;
    const issuerFromLabel = labelParts.length > 1 ? labelParts[0] : '';
    const secret = parsed.searchParams.get('secret');

    if (!secret) {
        throw new Error('OTPAuth URI does not contain secret');
    }

    return {
        serviceName: accountName || issuerFromLabel || parsed.searchParams.get('issuer') || 'TOTP',
        issuer: parsed.searchParams.get('issuer') || issuerFromLabel || '',
        secret,
        digits: Number(parsed.searchParams.get('digits') || '6'),
        period: Number(parsed.searchParams.get('period') || '30'),
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!sessionStorage.getItem('isDataLoaded')) {
        navigateTo('loading');
        return;
    }

    initializeSharedPageShell();

    const token = getAuthToken();
    const masterPassword = getMasterPassword();
    const cryptoSalt = sessionStorage.getItem('cryptoSalt');
    if (!token) {
        navigateTo('login');
        return;
    }

    if (!cryptoSalt) {
        navigateTo('login');
        return;
    }

    if (!masterPassword) {
        navigateTo('loading');
        return;
    }

    const totpGrid = document.getElementById('totpGrid') as HTMLDivElement | null;
    const errorContainer = document.getElementById('errorContainer') as HTMLDivElement | null;
    const errorMessage = document.getElementById('errorMessage') as HTMLSpanElement | null;
    const fabButton = document.getElementById('fabButton') as HTMLDivElement | null;
    const addModal = document.getElementById('add-totp-modal') as HTMLDivElement | null;
    const cancelButton = document.getElementById('cancel-totp') as HTMLButtonElement | null;
    const submitButton = document.getElementById('submit-totp') as HTMLButtonElement | null;
    const uriInput = document.getElementById('totp-uri') as HTMLTextAreaElement | null;
    const qrInput = document.getElementById('totp-qr-file') as HTMLInputElement | null;
    const totpError = document.getElementById('totp-error') as HTMLDivElement | null;
    const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
    const globalSecondsLeft = document.getElementById('globalSecondsLeft') as HTMLSpanElement | null;
    const globalProgressBar = document.getElementById('globalProgressBar') as HTMLDivElement | null;

    if (!totpGrid || !errorContainer || !errorMessage || !fabButton || !addModal || !cancelButton || !submitButton || !uriInput || !qrInput || !totpError || !searchInput || !globalSecondsLeft || !globalProgressBar) {
        return;
    }

    let accounts: TotpAccount[] = [];
    let refreshTimer: number | undefined;
    let renderToken = 0;

    const getSecondsLeft = (period = 30) => {
        const currentUnixSeconds = Math.floor(Date.now() / 1000);
        const elapsed = currentUnixSeconds % period;
        return period - elapsed || period;
    };

    const formatCode = (code: string) => {
        if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
        if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
        return code;
    };

    const buildViewModels = async (): Promise<TotpViewModel[]> => {
        return Promise.all(accounts.map(async (account) => {
            let payload: TotpPayload;

            if (account.secret.startsWith('zk1:')) {
                const decrypted = await decryptStringWithKuznyechik(account.secret.slice(4), account.issuer, masterPassword, cryptoSalt);
                payload = JSON.parse(decrypted) as TotpPayload;
            } else {
                payload = {
                    serviceName: account.serviceName,
                    issuer: account.issuer,
                    secret: account.secret,
                    digits: account.digits || 6,
                    period: account.period || 30,
                };
            }

            return {
                id: account.id,
                serviceName: payload.serviceName,
                issuer: payload.issuer,
                digits: payload.digits,
                period: payload.period || 30,
                code: await generateTotpCode(payload.secret, payload.digits, payload.period || 30),
                secondsLeft: getSecondsLeft(payload.period || 30),
            };
        }));
    };

    const filterItems = (items: TotpViewModel[]) => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            return items;
        }

        return items.filter((item) =>
            item.serviceName.toLowerCase().includes(searchTerm) ||
            (item.issuer || '').toLowerCase().includes(searchTerm)
        );
    };

    const render = async () => {
        const currentRenderToken = ++renderToken;
        const items = filterItems(await buildViewModels());

        if (currentRenderToken !== renderToken) {
            return;
        }

        if (items.length === 0) {
            totpGrid.innerHTML = `
                <div class="totp-empty-state">
                    <h3>${UI_TEXT.totp.emptyTitle}</h3>
                    <p>${UI_TEXT.totp.emptyDescription}</p>
                </div>
            `;
            return;
        }

        totpGrid.innerHTML = items.map((item) => {
            const progress = Math.max(0, Math.min(100, (item.secondsLeft / item.period) * 100));
            return `
                <article class="totp-card" data-id="${item.id}">
                    <button
                        type="button"
                        class="totp-delete-button"
                        data-id="${item.id}"
                    >${UI_TEXT.common.delete}</button>
                    <div class="totp-card-header">
                        <div>
                            <p class="totp-issuer">${item.issuer || UI_TEXT.totp.authenticator}</p>
                            <h3>${item.serviceName}</h3>
                            <span class="totp-badge">${item.digits} ${UI_TEXT.totp.digitsSuffix}</span>
                        </div>
                    </div>
                    <button class="totp-code-button" data-code="${item.code}">
                        <span class="totp-code">${formatCode(item.code)}</span>
                        <span class="totp-copy-hint">${UI_TEXT.totp.copyHint}</span>
                    </button>
                    <div class="totp-meta">
                        <span>${UI_TEXT.totp.refreshIn} ${item.secondsLeft}${UI_TEXT.totp.secondsSuffix}</span>
                        <span>${UI_TEXT.totp.period} ${item.period}${UI_TEXT.totp.secondsSuffix}</span>
                    </div>
                    <div class="totp-progress">
                        <div class="totp-progress-bar" style="width: ${progress}%"></div>
                    </div>
                </article>
            `;
        }).join('');

        totpGrid.querySelectorAll<HTMLButtonElement>('.totp-code-button').forEach((button) => {
            button.addEventListener('click', async () => {
                const code = button.dataset.code;
                if (!code || code === '------') {
                    return;
                }

                try {
                    await navigator.clipboard.writeText(code);
                    const hint = button.querySelector('.totp-copy-hint');
                    if (!hint) {
                        return;
                    }

                    const previous = hint.textContent;
                    hint.textContent = UI_TEXT.totp.copied;
                    window.setTimeout(() => {
                        hint.textContent = previous || UI_TEXT.totp.copyHint;
                    }, 1200);
                } catch (error) {
                    console.error('Failed to copy TOTP code', error);
                }
            });
        });

        totpGrid.querySelectorAll<HTMLButtonElement>('.totp-delete-button').forEach((button) => {
            button.addEventListener('click', async () => {
                const accountId = Number(button.dataset.id);
                const item = items.find((totpItem) => totpItem.id === accountId);
                if (!accountId || !item) {
                    return;
                }

                if (!window.confirm(`${UI_TEXT.totp.deleteConfirm} "${item.serviceName}"?`)) {
                    return;
                }

                try {
                    button.disabled = true;
                    await deleteTotpAccount(accountId);
                    accounts = accounts.filter((account) => account.id !== accountId);
                    await render();
                } catch (error: any) {
                    alert(`${UI_TEXT.totp.deleteError}: ${error.message}`);
                    button.disabled = false;
                }
            });
        });
    };

    const renderGlobalTimer = () => {
        const secondsLeft = getSecondsLeft(30);
        globalSecondsLeft.textContent = `${secondsLeft}${UI_TEXT.totp.secondsSuffix}`;
        globalProgressBar.style.width = `${(secondsLeft / 30) * 100}%`;
    };

    const loadAccounts = async () => {
        accounts = await getTotpAccounts() as TotpAccount[];
    };

    const loadData = async () => {
        try {
            await loadAccounts();
            await render();
            renderGlobalTimer();
            errorContainer.style.display = 'none';
        } catch (error: any) {
            errorContainer.style.display = 'block';
            errorMessage.textContent = `${UI_TEXT.totp.loadError}: ${error.message}`;
        }
    };

    const closeModal = () => {
        addModal.style.display = 'none';
        totpError.style.display = 'none';
        uriInput.value = '';
        qrInput.value = '';
    };

    fabButton.addEventListener('click', () => {
        closeModal();
        addModal.style.display = 'flex';
    });

    cancelButton.addEventListener('click', closeModal);

    addModal.addEventListener('click', (event) => {
        if (event.target === addModal) {
            closeModal();
        }
    });

    submitButton.addEventListener('click', async () => {
        const uri = uriInput.value.trim();
        const file = qrInput.files?.[0];

        if (!uri && !file) {
            totpError.style.display = 'block';
            totpError.textContent = UI_TEXT.totp.addValidation;
            return;
        }

        try {
            submitButton.disabled = true;

            const otpUri = uri || (await importTotpQrText(file as File)).qrText;
            const payload = parseOtpAuthUri(otpUri);
            const encrypted = await encryptStringWithKuznyechik(JSON.stringify(payload), masterPassword, cryptoSalt);

            await addEncryptedTotpAccount({
                encryptedPayload: encrypted.ciphertext,
                nonce: encrypted.nonce,
                version: 1,
            });

            await loadData();
            closeModal();
        } catch (error: any) {
            totpError.style.display = 'block';
            totpError.textContent = `${UI_TEXT.common.errorPrefix}: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });

    searchInput.addEventListener('input', debounce(() => {
        void render();
    }, 200));

    await loadData();

    refreshTimer = window.setInterval(() => {
        renderGlobalTimer();
        void render();
    }, 1000);

    window.addEventListener('beforeunload', () => {
        if (refreshTimer) {
            window.clearInterval(refreshTimer);
        }
    });
});
