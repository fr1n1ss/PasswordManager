import { addEncryptedTotpAccount, getTotpAccounts, importTotpQrText } from '../services/api.ts';
import { decryptStringWithKuznyechik, encryptStringWithKuznyechik } from '../services/kuznyechik.ts';

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
    secret: string;
    digits: number;
    period: number;
    code: string;
    secondsLeft: number;
}

function debounce(func: Function, delay: number) {
    let timeoutId: NodeJS.Timeout;
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
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
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
    const isDataLoaded = sessionStorage.getItem('isDataLoaded');
    if (!isDataLoaded) {
        window.location.href = '/pages/loading-page.html';
        return;
    }

    const token = localStorage.getItem('token');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const cryptoSalt = sessionStorage.getItem('cryptoSalt');
    if (!token || !masterPassword || !cryptoSalt) {
        window.location.href = '/pages/login-page.html';
        return;
    }

    const username = sessionStorage.getItem('username');
    const email = sessionStorage.getItem('email');
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.user-email');

    if (usernameElement && username) usernameElement.textContent = username;
    if (emailElement && email) emailElement.textContent = email;

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
    const dropdown = document.querySelector('.profile-dropdown') as HTMLSpanElement | null;
    const menu = document.getElementById('profileMenu') as HTMLDivElement | null;
    const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement | null;
    const sidebar = document.getElementById('sidebar') as HTMLElement | null;
    const hideBtn = document.getElementById('hideBtn') as HTMLButtonElement | null;

    if (!totpGrid || !errorContainer || !errorMessage || !fabButton || !addModal || !cancelButton || !submitButton || !uriInput || !qrInput || !totpError || !searchInput || !globalSecondsLeft || !globalProgressBar || !dropdown || !menu || !logoutBtn || !sidebar || !hideBtn) {
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
                secret: payload.secret,
                digits: payload.digits,
                period: payload.period || 30,
                code: await generateTotpCode(payload.secret, payload.digits, payload.period || 30),
                secondsLeft: getSecondsLeft(payload.period || 30),
            };
        }));
    };

    const filterItems = (items: TotpViewModel[]) => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) return items;

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
                    <h3>TOTP пока не добавлены</h3>
                    <p>Нажмите на кнопку + и вставьте OTPAuth URI или импортируйте QR-код.</p>
                </div>
            `;
            return;
        }

        totpGrid.innerHTML = items.map((item) => {
            const progress = Math.max(0, Math.min(100, (item.secondsLeft / (item.period || 30)) * 100));
            return `
                <article class="totp-card" data-id="${item.id}">
                    <div class="totp-card-header">
                        <div>
                            <p class="totp-issuer">${item.issuer || 'Authenticator'}</p>
                            <h3>${item.serviceName}</h3>
                        </div>
                        <span class="totp-badge">${item.digits} digits</span>
                    </div>
                    <button class="totp-code-button" data-code="${item.code}">
                        <span class="totp-code">${formatCode(item.code)}</span>
                        <span class="totp-copy-hint">Нажмите, чтобы скопировать</span>
                    </button>
                    <div class="totp-meta">
                        <span>Обновление через ${item.secondsLeft}с</span>
                        <span>Период ${item.period}с</span>
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
                if (!code || code === '------') return;

                try {
                    await navigator.clipboard.writeText(code);
                    const hint = button.querySelector('.totp-copy-hint');
                    if (!hint) return;

                    const previous = hint.textContent;
                    hint.textContent = 'Скопировано';
                    window.setTimeout(() => {
                        hint.textContent = previous || 'Нажмите, чтобы скопировать';
                    }, 1200);
                } catch (error) {
                    console.error('Failed to copy TOTP code', error);
                }
            });
        });
    };

    const renderGlobalTimer = () => {
        const secondsLeft = getSecondsLeft(30);
        globalSecondsLeft.textContent = `${secondsLeft}с`;
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
            errorMessage.textContent = `Ошибка загрузки TOTP: ${error.message}`;
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
            totpError.textContent = 'Добавьте OTPAuth URI или выберите файл QR-кода.';
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
            totpError.textContent = `Ошибка: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });

    const debouncedSearch = debounce(() => {
        void render();
    }, 200);
    searchInput.addEventListener('input', debouncedSearch);

    dropdown.addEventListener('click', () => {
        const isMenuOpen = menu.style.display === 'block';
        menu.style.display = isMenuOpen ? 'none' : 'block';
        dropdown.textContent = isMenuOpen ? '▼' : '▲';
    });

    document.addEventListener('click', (event) => {
        if (!dropdown.contains(event.target as Node) && !menu.contains(event.target as Node)) {
            menu.style.display = 'none';
            dropdown.textContent = '▼';
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        sessionStorage.clear();
        window.location.href = '/pages/login-page.html';
    });

    hideBtn.addEventListener('click', () => {
        const isHidden = sidebar.classList.contains('hidden');
        sidebar.classList.toggle('hidden');
        hideBtn.textContent = isHidden ? '≪' : '≫';
    });

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
