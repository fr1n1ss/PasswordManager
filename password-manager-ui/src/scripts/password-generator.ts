import { analyzePassword, generatePassword } from '../services/password-security.ts';
import { enhancePasswordField } from './password-visibility.ts';
import { applyFieldInputRules, initializeSharedPageShell } from './shared-page.ts';

document.addEventListener('DOMContentLoaded', () => {
    initializeSharedPageShell();

    const generatorLengthInput = document.getElementById('generatorLength') as HTMLInputElement | null;
    const generatorIncludeLowercaseInput = document.getElementById('generatorIncludeLowercase') as HTMLInputElement | null;
    const generatorIncludeUppercaseInput = document.getElementById('generatorIncludeUppercase') as HTMLInputElement | null;
    const generatorIncludeDigitsInput = document.getElementById('generatorIncludeDigits') as HTMLInputElement | null;
    const generatorIncludeSymbolsInput = document.getElementById('generatorIncludeSymbols') as HTMLInputElement | null;
    const generatorCustomSymbolsInput = document.getElementById('generatorCustomSymbols') as HTMLInputElement | null;
    const generatePasswordBtn = document.getElementById('generatePasswordBtn') as HTMLButtonElement | null;
    const copyGeneratedPasswordBtn = document.getElementById('copyGeneratedPasswordBtn') as HTMLButtonElement | null;
    const generatedPasswordOutput = document.getElementById('generatedPasswordOutput') as HTMLTextAreaElement | null;
    const passwordAnalyzerInput = document.getElementById('passwordAnalyzerInput') as HTMLInputElement | null;
    const analyzePasswordBtn = document.getElementById('analyzePasswordBtn') as HTMLButtonElement | null;
    const passwordAnalyzerResult = document.getElementById('passwordAnalyzerResult') as HTMLDivElement | null;

    if (
        !generatorLengthInput || !generatorIncludeLowercaseInput || !generatorIncludeUppercaseInput ||
        !generatorIncludeDigitsInput || !generatorIncludeSymbolsInput || !generatorCustomSymbolsInput ||
        !generatePasswordBtn || !copyGeneratedPasswordBtn || !generatedPasswordOutput ||
        !passwordAnalyzerInput || !analyzePasswordBtn || !passwordAnalyzerResult
    ) {
        return;
    }

    enhancePasswordField(passwordAnalyzerInput);
    applyFieldInputRules();

    const escapeHtml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderPasswordFeedback = (password: string) => {
        if (!password) {
            passwordAnalyzerResult.innerHTML = '<p class="settings-password-empty">Введите пароль, чтобы увидеть подробную проверку.</p>';
            return;
        }

        const analysis = analyzePassword(password, {
            personalValues: [sessionStorage.getItem('username') || '', sessionStorage.getItem('email') || '']
        });

        const vulnerabilities = analysis.vulnerabilities.length > 0
            ? analysis.vulnerabilities.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')
            : '<li>Явных локальных признаков уязвимости не найдено.</li>';

        passwordAnalyzerResult.innerHTML = `
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
                <ul>${vulnerabilities}</ul>
            </div>
        `;
    };

    generatePasswordBtn.addEventListener('click', () => {
        const requestedLength = Number(generatorLengthInput.value || '20');
        const length = Math.min(256, Math.max(4, Number.isFinite(requestedLength) ? requestedLength : 20));
        generatorLengthInput.value = String(length);

        const generatedPassword = generatePassword({
            length,
            includeLowercase: generatorIncludeLowercaseInput.checked,
            includeUppercase: generatorIncludeUppercaseInput.checked,
            includeDigits: generatorIncludeDigitsInput.checked,
            includeSymbols: generatorIncludeSymbolsInput.checked,
            customSymbols: generatorCustomSymbolsInput.value
        });

        generatedPasswordOutput.value = generatedPassword;
        passwordAnalyzerInput.value = generatedPassword;
        renderPasswordFeedback(generatedPassword);
    });

    copyGeneratedPasswordBtn.addEventListener('click', async () => {
        if (!generatedPasswordOutput.value) {
            return;
        }

        await navigator.clipboard.writeText(generatedPasswordOutput.value);
    });

    analyzePasswordBtn.addEventListener('click', () => {
        renderPasswordFeedback(passwordAnalyzerInput.value);
    });

    passwordAnalyzerInput.addEventListener('input', () => {
        renderPasswordFeedback(passwordAnalyzerInput.value);
    });

    renderPasswordFeedback(passwordAnalyzerInput.value);
});
