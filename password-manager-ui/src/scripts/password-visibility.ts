export function initializePasswordVisibilityToggles(root: ParentNode = document): void {
    const toggles = root.querySelectorAll<HTMLElement>('[data-password-toggle]');

    toggles.forEach((toggle) => {
        if (toggle.dataset.passwordToggleBound === 'true') {
            return;
        }

        const targetId = toggle.getAttribute('data-target');
        if (!targetId) {
            return;
        }

        const input = root.querySelector<HTMLInputElement>(`#${targetId}`);
        if (!input) {
            return;
        }

        const updateState = () => {
            const isVisible = input.type === 'text';
            toggle.classList.toggle('is-visible', isVisible);
            toggle.setAttribute('aria-label', isVisible ? 'Скрыть пароль' : 'Показать пароль');
            toggle.setAttribute('title', isVisible ? 'Скрыть пароль' : 'Показать пароль');
        };

        toggle.addEventListener('click', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
            updateState();
        });

        toggle.dataset.passwordToggleBound = 'true';
        updateState();
    });
}

export function enhancePasswordField(input: HTMLInputElement, options?: { groupClass?: string; toggleClass?: string }): void {
    if (input.dataset.passwordEnhanced === 'true') {
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = options?.groupClass || 'password-input-group';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = options?.toggleClass || 'password-toggle';
    toggle.setAttribute('data-password-toggle', '');
    toggle.setAttribute('data-target', input.id);

    const label = document.createElement('span');
    label.className = 'visually-hidden';
    label.textContent = 'Показать пароль';
    toggle.appendChild(label);

    const parent = input.parentNode;
    if (!parent) {
        return;
    }

    parent.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.appendChild(toggle);

    input.dataset.passwordEnhanced = 'true';
    initializePasswordVisibilityToggles(wrapper);
}
