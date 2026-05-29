import {
    changePassword,
    confirmEmailChange,
    disable2FA,
    getAccounts,
    getActiveSessions,
    getAuditLogs,
    getTotpAccounts,
    getUserInfo,
    getUserNotes,
    requestEmailChange,
    revokeOtherSessions,
    revokeSession,
    rotateMasterPassword,
    sendEmailConfirmation,
    setup2FA,
    verify2FA,
    verifyEmailConfirmation
} from '../services/api.ts';
import { navigateTo } from './routes.ts';
import {
    analyzePassword,
    findVulnerablePasswords,
    generatePassword
} from '../services/password-security.ts';
import { clearAuthToken, clearSensitiveSession, getMasterPassword, setMasterPassword } from '../services/security-session.ts';
import { enhancePasswordField } from './password-visibility.ts';
import { initializeSharedPageShell } from './shared-page.ts';
import {
    buildRotatedAccountPayloads,
    buildRotatedNotePayloads,
    buildRotatedTotpPayloads,
    canDecryptAnyPayload,
    createMasterPasswordVerifier,
    decryptAccounts,
    decryptNotes
} from '../services/zero-knowledge.ts';

interface UserInfo {
    username: string;
    email: string;
    emailConfirmed: boolean;
    salt: string;
    is2FaEnabled?: boolean;
}

interface SessionItem {
    id: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    isCurrent: boolean;
}

interface AuditLogItem {
    id: number;
    action: string;
    details?: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
}

interface AccountItem {
    id: number;
    userID: number;
    serviceName: string;
    login: string;
    encryptedPassword: string;
    description: string;
    url: string;
    creationDate: string;
}

interface NoteItem {
    id: number;
    userID: number;
    title: string;
    encryptedContent: string;
    createdAt: string;
    updatedAt: string;
}

interface TotpItem {
    id: number;
    userId: number;
    serviceName: string;
    issuer: string;
    secret: string;
    digits: number;
    period: number;
}

document.addEventListener('DOMContentLoaded', async () => {
    initializeSharedPageShell();

    const tabTriggers = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-trigger]'));
    const tabPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-panel]'));
    const currentEmailValue = document.getElementById('currentEmailValue') as HTMLParagraphElement | null;
    const emailStatusBadge = document.getElementById('emailStatusBadge') as HTMLSpanElement | null;
    const emailStatusText = document.getElementById('emailStatusText') as HTMLParagraphElement | null;
    const emailVerificationActions = document.getElementById('emailVerificationActions') as HTMLDivElement | null;
    const emailVerificationPanel = document.getElementById('emailVerificationPanel') as HTMLDivElement | null;
    const sendEmailCodeBtn = document.getElementById('sendEmailCodeBtn') as HTMLButtonElement | null;
    const verifyEmailBtn = document.getElementById('verifyEmailBtn') as HTMLButtonElement | null;
    const emailCodeInput = document.getElementById('emailCodeInput') as HTMLInputElement | null;
    const requestEmailChangeBtn = document.getElementById('requestEmailChangeBtn') as HTMLButtonElement | null;
    const confirmEmailChangeBtn = document.getElementById('confirmEmailChangeBtn') as HTMLButtonElement | null;
    const emailChangePanel = document.getElementById('emailChangePanel') as HTMLDivElement | null;
    const newEmailInput = document.getElementById('newEmail') as HTMLInputElement | null;
    const emailCurrentPasswordInput = document.getElementById('emailCurrentPassword') as HTMLInputElement | null;
    const emailChangeCodeInput = document.getElementById('emailChangeCode') as HTMLInputElement | null;
    const changePasswordBtn = document.getElementById('changePasswordBtn') as HTMLButtonElement | null;
    const currentPasswordInput = document.getElementById('currentPassword') as HTMLInputElement | null;
    const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement | null;
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword') as HTMLInputElement | null;
    const loginPasswordFeedback = document.getElementById('loginPasswordFeedback') as HTMLDivElement | null;
    const changeMasterPasswordBtn = document.getElementById('changeMasterPasswordBtn') as HTMLButtonElement | null;
    const currentAccountPasswordForMasterInput = document.getElementById('currentAccountPasswordForMaster') as HTMLInputElement | null;
    const currentMasterPasswordInput = document.getElementById('currentMasterPassword') as HTMLInputElement | null;
    const newMasterPasswordInput = document.getElementById('newMasterPassword') as HTMLInputElement | null;
    const confirmNewMasterPasswordInput = document.getElementById('confirmNewMasterPassword') as HTMLInputElement | null;
    const masterPasswordFeedback = document.getElementById('masterPasswordFeedback') as HTMLDivElement | null;
    const generatorLengthInput = document.getElementById('generatorLength') as HTMLInputElement | null;
    const generatorIncludeLowercaseInput = document.getElementById('generatorIncludeLowercase') as HTMLInputElement | null;
    const generatorIncludeUppercaseInput = document.getElementById('generatorIncludeUppercase') as HTMLInputElement | null;
    const generatorIncludeDigitsInput = document.getElementById('generatorIncludeDigits') as HTMLInputElement | null;
    const generatorIncludeSymbolsInput = document.getElementById('generatorIncludeSymbols') as HTMLInputElement | null;
    const generatorCustomSymbolsInput = document.getElementById('generatorCustomSymbols') as HTMLInputElement | null;
    const generatePasswordBtn = document.getElementById('generatePasswordBtn') as HTMLButtonElement | null;
    const copyGeneratedPasswordBtn = document.getElementById('copyGeneratedPasswordBtn') as HTMLButtonElement | null;
    const applyGeneratedToLoginPasswordBtn = document.getElementById('applyGeneratedToLoginPasswordBtn') as HTMLButtonElement | null;
    const applyGeneratedToMasterPasswordBtn = document.getElementById('applyGeneratedToMasterPasswordBtn') as HTMLButtonElement | null;
    const generatedPasswordOutput = document.getElementById('generatedPasswordOutput') as HTMLTextAreaElement | null;
    const passwordAnalyzerInput = document.getElementById('passwordAnalyzerInput') as HTMLInputElement | null;
    const analyzePasswordBtn = document.getElementById('analyzePasswordBtn') as HTMLButtonElement | null;
    const passwordAnalyzerResult = document.getElementById('passwordAnalyzerResult') as HTMLDivElement | null;
    const scanStoredPasswordsBtn = document.getElementById('scanStoredPasswordsBtn') as HTMLButtonElement | null;
    const storedPasswordScanResults = document.getElementById('storedPasswordScanResults') as HTMLDivElement | null;
    const sessionsList = document.getElementById('sessionsList') as HTMLDivElement | null;
    const refreshSessionsBtn = document.getElementById('refreshSessionsBtn') as HTMLButtonElement | null;
    const revokeOtherSessionsBtn = document.getElementById('revokeOtherSessionsBtn') as HTMLButtonElement | null;
    const auditLogList = document.getElementById('auditLogList') as HTMLDivElement | null;
    const start2faSetupBtn = document.getElementById('start2faSetupBtn') as HTMLButtonElement | null;
    const disable2faBtn = document.getElementById('disable2faBtn') as HTMLButtonElement | null;
    const verify2faBtn = document.getElementById('verify2faBtn') as HTMLButtonElement | null;
    const twofaStatusText = document.getElementById('twofaStatusText') as HTMLParagraphElement | null;
    const twofaStatusBadge = document.getElementById('twofaStatusBadge') as HTMLSpanElement | null;
    const twofaSetupPanel = document.getElementById('twofaSetupPanel') as HTMLDivElement | null;
    const twofaUri = document.getElementById('twofaUri') as HTMLTextAreaElement | null;
    const twofaCode = document.getElementById('twofaCode') as HTMLInputElement | null;
    const twofaQrImage = document.getElementById('twofaQrImage') as HTMLImageElement | null;
    const settingsNotice = document.getElementById('settingsNotice') as HTMLDivElement | null;

    if (
        !currentEmailValue || !emailStatusBadge || !emailStatusText || !emailVerificationActions || !emailVerificationPanel ||
        !sendEmailCodeBtn || !verifyEmailBtn || !emailCodeInput || !requestEmailChangeBtn || !confirmEmailChangeBtn ||
        !emailChangePanel || !newEmailInput || !emailCurrentPasswordInput || !emailChangeCodeInput || !changePasswordBtn ||
        !currentPasswordInput || !newPasswordInput || !confirmNewPasswordInput || !loginPasswordFeedback || !changeMasterPasswordBtn ||
        !currentAccountPasswordForMasterInput || !currentMasterPasswordInput || !newMasterPasswordInput || !confirmNewMasterPasswordInput || !masterPasswordFeedback ||
        !passwordAnalyzerInput || !analyzePasswordBtn || !passwordAnalyzerResult || !scanStoredPasswordsBtn || !storedPasswordScanResults || !sessionsList || !refreshSessionsBtn || !revokeOtherSessionsBtn ||
        !auditLogList || !start2faSetupBtn || !disable2faBtn || !verify2faBtn || !twofaStatusText || !twofaStatusBadge ||
        !twofaSetupPanel || !twofaUri || !twofaCode || !twofaQrImage || !settingsNotice
    ) {
        return;
    }

    let currentSalt = sessionStorage.getItem('cryptoSalt') || '';

    [
        emailCurrentPasswordInput,
        currentPasswordInput,
        newPasswordInput,
        confirmNewPasswordInput,
        currentAccountPasswordForMasterInput,
        currentMasterPasswordInput,
        newMasterPasswordInput,
        confirmNewMasterPasswordInput,
        passwordAnalyzerInput
    ].forEach((input) => {
        enhancePasswordField(input);
    });

    const showNotice = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        settingsNotice.className = `settings-notice settings-notice-${type}`;
        settingsNotice.textContent = message;
        settingsNotice.style.display = 'block';
    };

    const hideNotice = () => {
        settingsNotice.style.display = 'none';
        settingsNotice.textContent = '';
        settingsNotice.className = 'settings-notice';
    };

    const renderPasswordFeedback = (
        container: HTMLDivElement,
        password: string,
        personalValues: string[],
        emptyMessage: string
    ) => {
        if (!password) {
            container.innerHTML = `<p class="settings-password-empty">${escapeHtml(emptyMessage)}</p>`;
            return;
        }

        const analysis = analyzePassword(password, { personalValues });
        const issues = analysis.vulnerabilities.length > 0
            ? analysis.vulnerabilities.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')
            : '<li>Явных локальных признаков уязвимости не найдено.</li>';

        container.innerHTML = `
            <div class="settings-password-summary">
                <strong>${escapeHtml(analysis.strengthLabel)}</strong>
                <span class="settings-password-score">Оценка: ${analysis.score}/100</span>
            </div>
            <div class="settings-password-grid">
                ${analysis.checks.map((check) => `
                    <div class="settings-password-check ${check.passed ? 'is-passed' : 'is-failed'}">
                        <span class="settings-password-check-icon">${check.passed ? '✓' : '•'}</span>
                        <span>${escapeHtml(check.label)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="settings-password-vulnerabilities">
                <div class="settings-password-vulnerabilities-title">Потенциальные риски</div>
                <ul>${issues}</ul>
            </div>
        `;
    };

    const escapeHtml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const parseServerDate = (value: string) => {
        const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
        return new Date(hasTimeZone ? value : `${value}Z`);
    };

    const formatDate = (value: string) => parseServerDate(value).toLocaleString('ru-RU');

    const getBrowserName = (userAgent: string) => {
        const edge = userAgent.match(/Edg\/([\d.]+)/);
        if (edge) return `Edge ${edge[1]}`;

        const opera = userAgent.match(/(?:OPR|Opera)\/([\d.]+)/);
        if (opera) return `Opera ${opera[1]}`;

        const firefox = userAgent.match(/Firefox\/([\d.]+)/);
        if (firefox) return `Firefox ${firefox[1]}`;

        const chrome = userAgent.match(/Chrome\/([\d.]+)/);
        if (chrome && !/Chromium/.test(userAgent)) return `Chrome ${chrome[1]}`;

        const safari = userAgent.match(/Version\/([\d.]+).*Safari\//);
        if (safari) return `Safari ${safari[1]}`;

        return 'Браузер';
    };

    const getDeviceName = (userAgent: string) => {
        const ios = userAgent.match(/CPU (?:iPhone )?OS ([\d_]+)/i);
        if (/iPhone/i.test(userAgent)) return ios ? `iPhone · iOS ${ios[1].replace(/_/g, '.')}` : 'iPhone';
        if (/iPad/i.test(userAgent)) return ios ? `iPad · iPadOS ${ios[1].replace(/_/g, '.')}` : 'iPad';

        const android = userAgent.match(/Android ([\d.]+)/i);
        if (android) return `Android ${android[1]}`;

        const windows = userAgent.match(/Windows NT ([\d.]+)/i);
        if (windows) return `Windows ${windows[1]}`;

        const mac = userAgent.match(/Mac OS X ([\d_]+)/i);
        if (mac) return `Mac · macOS ${mac[1].replace(/_/g, '.')}`;

        if (/Linux/i.test(userAgent)) return 'Linux';
        return 'Устройство';
    };

    const formatUserAgent = (userAgent?: string | null) => {
        if (!userAgent) {
            return 'Устройство не определено';
        }

        return `${getDeviceName(userAgent)} · ${getBrowserName(userAgent)}`;
    };

    const refreshLoginPasswordFeedback = () => {
        renderPasswordFeedback(
            loginPasswordFeedback,
            newPasswordInput.value,
            [sessionStorage.getItem('username') || '', sessionStorage.getItem('email') || ''],
            'Введите новый пароль для проверки сложности.'
        );
    };

    const refreshMasterPasswordFeedback = () => {
        renderPasswordFeedback(
            masterPasswordFeedback,
            newMasterPasswordInput.value,
            [sessionStorage.getItem('username') || '', sessionStorage.getItem('email') || ''],
            'Введите новый мастер-пароль. Его анализ выполняется локально в zero-knowledge режиме.'
        );
    };

    const renderAnalyzerFeedback = () => {
        renderPasswordFeedback(
            passwordAnalyzerResult,
            passwordAnalyzerInput.value,
            [sessionStorage.getItem('username') || '', sessionStorage.getItem('email') || ''],
            'Введите пароль, чтобы проверить его на локальные признаки уязвимости.'
        );
    };

    newPasswordInput.addEventListener('input', refreshLoginPasswordFeedback);
    newMasterPasswordInput.addEventListener('input', refreshMasterPasswordFeedback);
    passwordAnalyzerInput.addEventListener('input', renderAnalyzerFeedback);
    refreshLoginPasswordFeedback();
    refreshMasterPasswordFeedback();
    renderAnalyzerFeedback();
    const renderStoredPasswordScan = async () => {
        const sessionMasterPassword = getMasterPassword() || '';
        const cryptoSalt = currentSalt || sessionStorage.getItem('cryptoSalt') || '';

        if (!sessionMasterPassword || !cryptoSalt) {
            storedPasswordScanResults.innerHTML = '<div class="settings-empty">Для локальной проверки нужен активный сеанс и мастер-пароль в памяти клиента.</div>';
            return;
        }

        let accounts = JSON.parse(sessionStorage.getItem('accounts') || 'null') as AccountItem[] | null;
        if (!accounts) {
            const encryptedAccounts = await getAccounts() as AccountItem[];
            accounts = await decryptAccounts(encryptedAccounts, sessionMasterPassword, cryptoSalt);
        }

        const vulnerablePasswords = findVulnerablePasswords(accounts);
        if (vulnerablePasswords.length === 0) {
            storedPasswordScanResults.innerHTML = '<div class="settings-empty">Слабых или повторно используемых паролей среди сохранённых аккаунтов не найдено.</div>';
            return;
        }

        storedPasswordScanResults.innerHTML = vulnerablePasswords.map((entry) => `
            <article class="settings-list-item">
                <div class="settings-list-item-main">
                    <div class="settings-list-title-row">
                        <strong>${escapeHtml(entry.serviceName || 'Без названия')}</strong>
                        <span class="settings-inline-badge">${escapeHtml(entry.login || 'Без логина')}</span>
                    </div>
                    <p>${escapeHtml(entry.issues.join(' '))}</p>
                </div>
            </article>
        `).join('');
    };

    const switchTab = (tabName: string) => {
        tabTriggers.forEach((trigger) => {
            trigger.classList.toggle('is-active', trigger.dataset.tabTrigger === tabName);
        });
        tabPanels.forEach((panel) => {
            panel.classList.toggle('is-active', panel.dataset.tabPanel === tabName);
        });
    };

    tabTriggers.forEach((trigger) => {
        trigger.addEventListener('click', () => {
            if (trigger.dataset.tabTrigger) {
                switchTab(trigger.dataset.tabTrigger);
            }
        });
    });

    const renderEmailState = (user: UserInfo) => {
        currentEmailValue.textContent = user.email;
        emailStatusBadge.textContent = user.emailConfirmed ? 'Подтвержден' : 'Не подтвержден';
        emailStatusBadge.classList.toggle('settings-badge-active', user.emailConfirmed);
        emailStatusText.textContent = user.emailConfirmed
            ? 'Email подтвержден. Дополнительное подтверждение для текущего адреса больше не требуется.'
            : 'Подтвердите текущий email, чтобы защитить аккаунт и упростить восстановление доступа.';

        emailVerificationActions.style.display = user.emailConfirmed ? 'none' : 'flex';
        emailVerificationPanel.style.display = user.emailConfirmed ? 'none' : 'none';
        emailCodeInput.value = '';
    };

    const render2faStatus = (enabled: boolean) => {
        twofaStatusText.textContent = enabled
            ? 'Двухфакторная аутентификация включена. После пароля потребуется код из приложения-аутентификатора.'
            : 'Двухфакторная аутентификация выключена. Вход выполняется только по паролю и мастер-паролю.';
        twofaStatusBadge.textContent = enabled ? 'Включена' : 'Выключена';
        twofaStatusBadge.classList.toggle('settings-badge-active', enabled);
        start2faSetupBtn.style.display = enabled ? 'none' : 'block';
        disable2faBtn.style.display = enabled ? 'block' : 'none';
        if (enabled) {
            twofaSetupPanel.style.display = 'none';
            twofaCode.value = '';
        }
    };

    const renderQr = (uri: string) => {
        twofaQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(uri)}`;
    };

    const renderSessions = (sessions: SessionItem[]) => {
        if (sessions.length === 0) {
            sessionsList.innerHTML = '<div class="settings-empty">Активных сессий не найдено.</div>';
            return;
        }

        sessionsList.innerHTML = sessions.map((session) => `
            <article class="settings-list-item">
                <div class="settings-list-item-main">
                    <div class="settings-list-title-row">
                        <strong>${session.isCurrent ? 'Текущее устройство' : 'Активная сессия'}</strong>
                        ${session.isCurrent ? '<span class="settings-inline-badge">Сейчас</span>' : ''}
                    </div>
                    <p title="${escapeHtml(session.userAgent || '')}">${escapeHtml(formatUserAgent(session.userAgent))}</p>
                    <p>IP: ${escapeHtml(session.ipAddress || 'неизвестно')}</p>
                    <p>Создана: ${formatDate(session.createdAt)}</p>
                    <p>Последняя активность: ${formatDate(session.lastSeenAt)}</p>
                </div>
                <button class="settings-inline-action" data-session-id="${session.id}">
                    ${session.isCurrent ? 'Выйти' : 'Завершить'}
                </button>
            </article>
        `).join('');

        sessionsList.querySelectorAll<HTMLButtonElement>('[data-session-id]').forEach((button) => {
            button.addEventListener('click', async () => {
                const sessionId = button.dataset.sessionId;
                if (!sessionId) {
                    return;
                }

                try {
                    button.disabled = true;
                    await revokeSession(sessionId);
                    if (button.textContent === 'Выйти') {
                        clearAuthToken();
                        clearSensitiveSession();
                        navigateTo('login');
                        return;
                    }

                    await loadSessions();
                    await loadAuditLogs();
                    showNotice('Сессия завершена.', 'success');
                } catch (error: any) {
                    showNotice(`Не удалось завершить сессию: ${error.response?.data?.message || error.message}`, 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });
    };

    const actionLabel = (action: string) => {
        const labels: Record<string, string> = {
            login_failed: 'Неудачная попытка входа',
            login_password_verified: 'Пароль подтвержден, ожидание 2FA',
            login_2fa_failed: 'Ошибка проверки 2FA при входе',
            login_success: 'Успешный вход',
            logout: 'Выход из аккаунта',
            register_success: 'Регистрация аккаунта',
            change_password_failed: 'Ошибка смены пароля',
            change_password_success: 'Пароль изменен',
            email_confirmation_requested: 'Запрошено подтверждение email',
            email_confirmation_failed: 'Ошибка подтверждения email',
            email_confirmed: 'Email подтвержден',
            email_change_request_failed: 'Ошибка запроса смены email',
            email_change_requested: 'Запрошена смена email',
            email_change_failed: 'Ошибка подтверждения нового email',
            email_changed: 'Email изменен',
            session_revoked: 'Сессия завершена',
            other_sessions_revoked: 'Остальные сессии завершены',
            master_password_verifier_updated: 'Обновлен verifier мастер-пароля',
            master_password_verifier_cleared: 'Server verifier мастер-пароля очищен',
            master_password_rotated: 'Мастер-пароль и зашифрованные данные обновлены',
            '2fa_setup_started': 'Начата настройка 2FA',
            '2fa_enable_failed': 'Ошибка включения 2FA',
            '2fa_enabled': '2FA включена',
            '2fa_disabled': '2FA выключена'
        };

        return labels[action] || action;
    };

    const renderAuditLogs = (logs: AuditLogItem[]) => {
        if (logs.length === 0) {
            auditLogList.innerHTML = '<div class="settings-empty">Журнал действий пока пуст.</div>';
            return;
        }

        auditLogList.innerHTML = logs.map((log) => `
            <article class="settings-list-item">
                <div class="settings-list-item-main">
                    <div class="settings-list-title-row">
                        <strong>${escapeHtml(actionLabel(log.action))}</strong>
                        <span class="settings-log-time">${formatDate(log.createdAt)}</span>
                    </div>
                    ${log.details ? `<p>${escapeHtml(log.details)}</p>` : ''}
                    <p>IP: ${escapeHtml(log.ipAddress || 'неизвестно')}</p>
                    <p>${escapeHtml(log.userAgent || 'Источник не определен')}</p>
                </div>
            </article>
        `).join('');
    };

    const loadUserState = async () => {
        const user = await getUserInfo() as UserInfo;
        sessionStorage.setItem('username', user.username || '');
        sessionStorage.setItem('email', user.email || '');
        sessionStorage.setItem('cryptoSalt', user.salt || '');
        currentSalt = user.salt || '';

        const usernameNode = document.querySelector('.username');
        const emailNode = document.querySelector('.user-email');
        if (usernameNode) {
            usernameNode.textContent = user.username;
        }
        if (emailNode) {
            emailNode.textContent = user.email;
        }

        renderEmailState(user);
        render2faStatus(Boolean(user.is2FaEnabled));
        refreshLoginPasswordFeedback();
        refreshMasterPasswordFeedback();
        renderAnalyzerFeedback();
    };

    const loadSessions = async () => {
        renderSessions(await getActiveSessions());
    };

    const loadAuditLogs = async () => {
        renderAuditLogs(await getAuditLogs(30));
    };

    sendEmailCodeBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const result = await sendEmailConfirmation();
            emailVerificationPanel.style.display = 'block';
            const preview = result.previewCode ? ` Тестовый код: ${result.previewCode}` : '';
            showNotice(`Код подтверждения отправлен на текущий email.${preview}`, 'success');
        } catch (error: any) {
            showNotice(`Не удалось отправить код подтверждения: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    verifyEmailBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const code = emailCodeInput.value.trim();
            if (!code) {
                showNotice('Введите код подтверждения email.', 'error');
                return;
            }

            await verifyEmailConfirmation(code);
            await loadUserState();
            await loadAuditLogs();
            showNotice('Email успешно подтвержден.', 'success');
        } catch (error: any) {
            showNotice(`Не удалось подтвердить email: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    requestEmailChangeBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const newEmail = newEmailInput.value.trim();
            const currentPassword = emailCurrentPasswordInput.value.trim();

            if (!newEmail || !currentPassword) {
                showNotice('Укажите новый email и текущий пароль.', 'error');
                return;
            }

            const result = await requestEmailChange(newEmail, currentPassword);
            emailChangePanel.style.display = 'block';
            const preview = result.previewCode ? ` Тестовый код: ${result.previewCode}` : '';
            showNotice(`Код подтверждения отправлен на новый email.${preview}`, 'success');
        } catch (error: any) {
            showNotice(`Не удалось запросить смену email: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    confirmEmailChangeBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const code = emailChangeCodeInput.value.trim();
            if (!code) {
                showNotice('Введите код подтверждения для нового email.', 'error');
                return;
            }

            const result = await confirmEmailChange(code);
            sessionStorage.setItem('email', result.email);
            emailChangeCodeInput.value = '';
            newEmailInput.value = '';
            emailCurrentPasswordInput.value = '';
            emailChangePanel.style.display = 'none';
            await loadUserState();
            await loadAuditLogs();
            showNotice('Email успешно изменен и подтвержден.', 'success');
        } catch (error: any) {
            showNotice(`Не удалось подтвердить новый email: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    changePasswordBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const currentPassword = currentPasswordInput.value.trim();
            const newPassword = newPasswordInput.value.trim();
            const confirmPassword = confirmNewPasswordInput.value.trim();
            const currentMasterPassword = getMasterPassword() || '';
            const passwordAnalysis = analyzePassword(newPassword, {
                personalValues: [sessionStorage.getItem('username') || '', sessionStorage.getItem('email') || '']
            });

            if (!currentPassword || !newPassword || !confirmPassword) {
                showNotice('Заполните все поля для смены пароля.', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                showNotice('Подтверждение нового пароля не совпадает.', 'error');
                return;
            }

            if (!passwordAnalysis.isPolicyCompliant) {
                showNotice(passwordAnalysis.vulnerabilities[0] || 'Новый пароль не соответствует требованиям сложности.', 'error');
                return;
            }

            if (currentMasterPassword && newPassword === currentMasterPassword) {
                showNotice('Пароль входа и мастер-пароль должны оставаться разными.', 'error');
                return;
            }

            await changePassword(currentPassword, newPassword);
            currentPasswordInput.value = '';
            newPasswordInput.value = '';
            confirmNewPasswordInput.value = '';
            refreshLoginPasswordFeedback();
            await loadAuditLogs();
            showNotice('Пароль для входа успешно изменен.', 'success');
        } catch (error: any) {
            showNotice(`Не удалось сменить пароль: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    changeMasterPasswordBtn.addEventListener('click', async () => {
        try {
            hideNotice();

            const currentAccountPassword = currentAccountPasswordForMasterInput.value.trim();
            const currentMasterPassword = currentMasterPasswordInput.value.trim();
            const nextMasterPassword = newMasterPasswordInput.value.trim();
            const confirmMasterPassword = confirmNewMasterPasswordInput.value.trim();
            const sessionMasterPassword = getMasterPassword() || '';
            const cryptoSalt = currentSalt || sessionStorage.getItem('cryptoSalt') || '';
            const masterPasswordAnalysis = analyzePassword(nextMasterPassword, {
                personalValues: [sessionStorage.getItem('username') || '', sessionStorage.getItem('email') || '']
            });

            if (!currentAccountPassword || !currentMasterPassword || !nextMasterPassword || !confirmMasterPassword) {
                showNotice('Заполните все поля для смены мастер-пароля.', 'error');
                return;
            }

            if (!cryptoSalt) {
                showNotice('Не удалось определить соль шифрования. Перезайдите в аккаунт и попробуйте снова.', 'error');
                return;
            }

            if (nextMasterPassword !== confirmMasterPassword) {
                showNotice('Подтверждение нового мастер-пароля не совпадает.', 'error');
                return;
            }

            if (!masterPasswordAnalysis.isPolicyCompliant) {
                showNotice(masterPasswordAnalysis.vulnerabilities[0] || 'Новый мастер-пароль не соответствует требованиям сложности.', 'error');
                return;
            }

            if (currentMasterPassword === nextMasterPassword) {
                showNotice('Новый мастер-пароль должен отличаться от текущего.', 'error');
                return;
            }

            if (currentAccountPassword === nextMasterPassword) {
                showNotice('Мастер-пароль и пароль входа должны оставаться разными.', 'error');
                return;
            }

            changeMasterPasswordBtn.disabled = true;

            const [accountPayloads, notePayloads, totpPayloads] = await Promise.all([
                getAccounts() as Promise<AccountItem[]>,
                getUserNotes() as Promise<NoteItem[]>,
                getTotpAccounts() as Promise<TotpItem[]>
            ]);

            const canDecryptWithCurrentPassword =
                currentMasterPassword === sessionMasterPassword ||
                await canDecryptAnyPayload(accountPayloads, notePayloads, totpPayloads, currentMasterPassword, cryptoSalt);

            if (!canDecryptWithCurrentPassword) {
                showNotice('Текущий мастер-пароль указан неверно.', 'error');
                return;
            }

            const [rotatedAccounts, rotatedNotes, rotatedTotpAccounts, decryptedAccounts, decryptedNotes] = await Promise.all([
                buildRotatedAccountPayloads(accountPayloads, currentMasterPassword, nextMasterPassword, cryptoSalt),
                buildRotatedNotePayloads(notePayloads, currentMasterPassword, nextMasterPassword, cryptoSalt),
                buildRotatedTotpPayloads(totpPayloads, currentMasterPassword, nextMasterPassword, cryptoSalt),
                decryptAccounts(accountPayloads, currentMasterPassword, cryptoSalt),
                decryptNotes(notePayloads, currentMasterPassword, cryptoSalt)
            ]);

            const nextVerifier = await createMasterPasswordVerifier(nextMasterPassword, cryptoSalt);

            await rotateMasterPassword({
                accounts: rotatedAccounts,
                notes: rotatedNotes,
                totpAccounts: rotatedTotpAccounts,
                masterPasswordVerifier: nextVerifier,
                clearServerVerifier: false
            });

            setMasterPassword(nextMasterPassword);
            sessionStorage.setItem('accounts', JSON.stringify(decryptedAccounts));
            sessionStorage.setItem('notes', JSON.stringify(decryptedNotes));

            currentAccountPasswordForMasterInput.value = '';
            currentMasterPasswordInput.value = '';
            newMasterPasswordInput.value = '';
            confirmNewMasterPasswordInput.value = '';
            refreshMasterPasswordFeedback();

            await loadAuditLogs();
            showNotice('Мастер-пароль изменён, а данные успешно перешифрованы новым ключом.', 'success');
        } catch (error: any) {
            showNotice(`Не удалось сменить мастер-пароль: ${error.response?.data?.message || error.message}`, 'error');
        } finally {
            changeMasterPasswordBtn.disabled = false;
        }
    });

    if (
        generatorLengthInput &&
        generatorIncludeLowercaseInput &&
        generatorIncludeUppercaseInput &&
        generatorIncludeDigitsInput &&
        generatorIncludeSymbolsInput &&
        generatorCustomSymbolsInput &&
        generatePasswordBtn &&
        copyGeneratedPasswordBtn &&
        applyGeneratedToLoginPasswordBtn &&
        applyGeneratedToMasterPasswordBtn &&
        generatedPasswordOutput
    ) {
        generatePasswordBtn.addEventListener('click', () => {
            try {
                hideNotice();
                const generatedPassword = generatePassword({
                    length: Math.max(4, Number(generatorLengthInput.value || '20')),
                    includeLowercase: generatorIncludeLowercaseInput.checked,
                    includeUppercase: generatorIncludeUppercaseInput.checked,
                    includeDigits: generatorIncludeDigitsInput.checked,
                    includeSymbols: generatorIncludeSymbolsInput.checked,
                    customSymbols: generatorCustomSymbolsInput.value
                });

                generatedPasswordOutput.value = generatedPassword;
                passwordAnalyzerInput.value = generatedPassword;
                renderAnalyzerFeedback();
                showNotice('Пароль сгенерирован локально.', 'success');
            } catch (error: any) {
                showNotice(error.message || 'Не удалось сгенерировать пароль.', 'error');
            }
        });

        copyGeneratedPasswordBtn.addEventListener('click', async () => {
            try {
                hideNotice();
                if (!generatedPasswordOutput.value) {
                    showNotice('Сначала сгенерируйте пароль.', 'error');
                    return;
                }

                await navigator.clipboard.writeText(generatedPasswordOutput.value);
                showNotice('Сгенерированный пароль скопирован.', 'success');
            } catch (error: any) {
                showNotice(`Не удалось скопировать пароль: ${error.message}`, 'error');
            }
        });

        applyGeneratedToLoginPasswordBtn.addEventListener('click', () => {
            if (!generatedPasswordOutput.value) {
                showNotice('Сначала сгенерируйте пароль.', 'error');
                return;
            }

            newPasswordInput.value = generatedPasswordOutput.value;
            confirmNewPasswordInput.value = generatedPasswordOutput.value;
            refreshLoginPasswordFeedback();
            showNotice('Сгенерированный пароль подставлен в поля смены пароля входа.', 'info');
        });

        applyGeneratedToMasterPasswordBtn.addEventListener('click', () => {
            if (!generatedPasswordOutput.value) {
                showNotice('Сначала сгенерируйте пароль.', 'error');
                return;
            }

            newMasterPasswordInput.value = generatedPasswordOutput.value;
            confirmNewMasterPasswordInput.value = generatedPasswordOutput.value;
            refreshMasterPasswordFeedback();
            showNotice('Сгенерированный пароль подставлен в поля смены мастер-пароля.', 'info');
        });
    }

    analyzePasswordBtn.addEventListener('click', () => {
        hideNotice();
        renderAnalyzerFeedback();
        showNotice('Локальный анализ пароля выполнен.', 'info');
    });

    scanStoredPasswordsBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            storedPasswordScanResults.innerHTML = '<div class="settings-empty">Проверяем сохранённые аккаунты локально...</div>';
            await renderStoredPasswordScan();
            showNotice('Локальный аудит сохранённых паролей завершен.', 'info');
        } catch (error: any) {
            storedPasswordScanResults.innerHTML = '<div class="settings-empty">Не удалось выполнить локальный аудит.</div>';
            showNotice(`Не удалось проверить сохранённые пароли: ${error.message}`, 'error');
        }
    });

    revokeOtherSessionsBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const result = await revokeOtherSessions();
            await loadSessions();
            await loadAuditLogs();
            showNotice(`Завершено сессий: ${result.revokedCount}.`, 'success');
        } catch (error: any) {
            showNotice(`Не удалось завершить остальные сессии: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    refreshSessionsBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            refreshSessionsBtn.disabled = true;
            refreshSessionsBtn.classList.add('is-loading');
            await loadSessions();
            showNotice('Список активных сессий обновлен.', 'success');
        } catch (error: any) {
            showNotice(`Не удалось обновить список сессий: ${error.response?.data?.message || error.message}`, 'error');
        } finally {
            refreshSessionsBtn.disabled = false;
            refreshSessionsBtn.classList.remove('is-loading');
        }
    });

    start2faSetupBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const result = await setup2FA();
            twofaUri.value = result.uri;
            renderQr(result.uri);
            twofaSetupPanel.style.display = 'block';
            twofaCode.focus();
        } catch (error: any) {
            showNotice(`Не удалось начать настройку 2FA: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    verify2faBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            const code = twofaCode.value.trim();
            if (!code) {
                showNotice('Введите код из приложения-аутентификатора.', 'error');
                return;
            }

            await verify2FA(code);
            await loadUserState();
            await loadAuditLogs();
            showNotice('2FA успешно включена.', 'success');
        } catch (error: any) {
            showNotice(`Не удалось включить 2FA: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    disable2faBtn.addEventListener('click', async () => {
        try {
            hideNotice();
            await disable2FA();
            twofaSetupPanel.style.display = 'none';
            twofaUri.value = '';
            twofaCode.value = '';
            twofaQrImage.removeAttribute('src');
            await loadUserState();
            await loadAuditLogs();
            showNotice('2FA отключена.', 'success');
        } catch (error: any) {
            showNotice(`Не удалось отключить 2FA: ${error.response?.data?.message || error.message}`, 'error');
        }
    });

    try {
        hideNotice();
        await Promise.all([loadUserState(), loadSessions(), loadAuditLogs()]);
    } catch (error: any) {
        showNotice(`Не удалось загрузить настройки: ${error.response?.data?.message || error.message}`, 'error');
    }
});
