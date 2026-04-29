export const PASSWORD_POLICY = {
    minLength: 12
};

const DEFAULT_SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~';

const COMMON_PASSWORDS = new Set([
    '123456',
    '12345678',
    '123456789',
    'qwerty',
    'password',
    'password123',
    'admin',
    'admin123',
    'welcome',
    'welcome123',
    'letmein',
    '111111',
    '000000',
    'abc123',
    'iloveyou',
    'monkey',
    'dragon',
    'sunshine',
    'football',
    'master'
]);

const SEQUENTIAL_PATTERNS = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', 'abcd', 'bcde', 'cdef', 'qwer', 'asdf', 'zxcv'];

export interface PasswordCheck {
    key: string;
    label: string;
    passed: boolean;
}

export interface PasswordAnalysis {
    score: number;
    strengthLabel: string;
    checks: PasswordCheck[];
    vulnerabilities: string[];
    isPolicyCompliant: boolean;
}

export interface PasswordGenerationOptions {
    length: number;
    includeLowercase: boolean;
    includeUppercase: boolean;
    includeDigits: boolean;
    includeSymbols: boolean;
    customSymbols?: string;
}

export interface PasswordContext {
    personalValues?: string[];
}

export interface VulnerablePasswordEntry {
    accountId: number;
    serviceName: string;
    login: string;
    issues: string[];
}

export interface AccountPasswordCandidate {
    id: number;
    serviceName: string;
    login: string;
    encryptedPassword: string;
}

const hasLowercase = (value: string) => /[a-z]/.test(value);
const hasUppercase = (value: string) => /[A-Z]/.test(value);
const hasDigit = (value: string) => /\d/.test(value);
const hasSpecial = (value: string) => /[^a-zA-Z0-9\s]/.test(value);
const normalize = (value: string) => value.trim().toLowerCase();

export function analyzePassword(password: string, context?: PasswordContext): PasswordAnalysis {
    const normalized = normalize(password);
    const checks: PasswordCheck[] = [
        { key: 'length', label: `Не менее ${PASSWORD_POLICY.minLength} символов`, passed: password.length >= PASSWORD_POLICY.minLength },
        { key: 'lowercase', label: 'Есть строчные буквы', passed: hasLowercase(password) },
        { key: 'uppercase', label: 'Есть заглавные буквы', passed: hasUppercase(password) },
        { key: 'digit', label: 'Есть цифры', passed: hasDigit(password) },
        { key: 'special', label: 'Есть спецсимволы', passed: hasSpecial(password) },
        { key: 'whitespace', label: 'Нет пробелов', passed: !/\s/.test(password) }
    ];

    const vulnerabilities: string[] = [];

    if (!normalized) {
        vulnerabilities.push('Введите пароль для анализа.');
    }

    if (COMMON_PASSWORDS.has(normalized)) {
        vulnerabilities.push('Этот пароль слишком распространён и легко угадывается.');
    }

    if (/(.)\1{2,}/.test(password)) {
        vulnerabilities.push('В пароле есть повторяющиеся последовательности символов, из-за которых он становится предсказуемее.');
    }

    if (SEQUENTIAL_PATTERNS.some((pattern) => normalized.includes(pattern))) {
        vulnerabilities.push('Пароль содержит очевидные последовательности вроде 1234, abcd или qwer.');
    }

    const personalValues = (context?.personalValues || [])
        .map((value) => normalize(value))
        .filter((value) => value.length >= 3);

    if (personalValues.some((value) => normalized.includes(value))) {
        vulnerabilities.push('Пароль содержит личные данные или фрагменты, связанные с сервисом.');
    }

    let score = checks.filter((check) => check.passed).length * 15;

    if (password.length >= 16) {
        score += 10;
    }

    if (password.length >= 24) {
        score += 5;
    }

    score -= vulnerabilities.length * 12;
    score = Math.max(0, Math.min(100, score));

    let strengthLabel = 'Слабый';
    if (score >= 85) {
        strengthLabel = 'Очень сильный';
    } else if (score >= 70) {
        strengthLabel = 'Сильный';
    } else if (score >= 50) {
        strengthLabel = 'Средний';
    }

    return {
        score,
        strengthLabel,
        checks,
        vulnerabilities,
        isPolicyCompliant: checks.every((check) => check.passed) && !COMMON_PASSWORDS.has(normalized)
    };
}

function getCryptoSource(): Crypto {
    if (typeof window !== 'undefined' && window.crypto) {
        return window.crypto;
    }

    throw new Error('Безопасная генерация пароля недоступна в текущем окружении.');
}

function randomIndex(maxExclusive: number): number {
    const values = new Uint32Array(1);
    getCryptoSource().getRandomValues(values);
    return values[0] % maxExclusive;
}

function pickRandomCharacter(characters: string): string {
    return characters[randomIndex(characters.length)];
}

function shuffleCharacters(value: string): string {
    const items = value.split('');

    for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = randomIndex(index + 1);
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }

    return items.join('');
}

export function generatePassword(options: PasswordGenerationOptions): string {
    const pools: string[] = [];
    const guaranteedCharacters: string[] = [];

    if (options.includeLowercase) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        pools.push(lowercase);
        guaranteedCharacters.push(pickRandomCharacter(lowercase));
    }

    if (options.includeUppercase) {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        pools.push(uppercase);
        guaranteedCharacters.push(pickRandomCharacter(uppercase));
    }

    if (options.includeDigits) {
        const digits = '0123456789';
        pools.push(digits);
        guaranteedCharacters.push(pickRandomCharacter(digits));
    }

    if (options.includeSymbols) {
        const symbols = options.customSymbols && options.customSymbols.length > 0
            ? Array.from(new Set(options.customSymbols.split(''))).join('')
            : DEFAULT_SYMBOLS;

        if (symbols.length > 0) {
            pools.push(symbols);
            guaranteedCharacters.push(pickRandomCharacter(symbols));
        }
    }

    if (pools.length === 0) {
        throw new Error('Выберите хотя бы одну группу символов для генерации.');
    }

    if (options.length < guaranteedCharacters.length) {
        throw new Error('Выбранная длина слишком мала для заданных требований.');
    }

    const allCharacters = pools.join('');
    let generated = guaranteedCharacters.join('');

    while (generated.length < options.length) {
        generated += pickRandomCharacter(allCharacters);
    }

    return shuffleCharacters(generated);
}

export function findVulnerablePasswords(accounts: AccountPasswordCandidate[]): VulnerablePasswordEntry[] {
    const normalizedPasswords = new Map<string, number[]>();

    accounts.forEach((account) => {
        const normalizedPassword = normalize(account.encryptedPassword);
        if (!normalizedPassword) {
            return;
        }

        const ids = normalizedPasswords.get(normalizedPassword) || [];
        ids.push(account.id);
        normalizedPasswords.set(normalizedPassword, ids);
    });

    return accounts
        .map((account) => {
            const issues = [...analyzePassword(account.encryptedPassword, {
                personalValues: [account.serviceName, account.login]
            }).vulnerabilities];

            if (account.encryptedPassword.length < PASSWORD_POLICY.minLength) {
                issues.push(`Пароль короче ${PASSWORD_POLICY.minLength} символов.`);
            }

            const duplicateIds = normalizedPasswords.get(normalize(account.encryptedPassword)) || [];
            if (duplicateIds.length > 1) {
                issues.push('Этот пароль повторно используется в нескольких аккаунтах.');
            }

            return {
                accountId: account.id,
                serviceName: account.serviceName,
                login: account.login,
                issues: Array.from(new Set(issues))
            };
        })
        .filter((entry) => entry.issues.length > 0);
}
