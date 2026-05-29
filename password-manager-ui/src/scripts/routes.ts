export const ROUTES = {
    home: '/',
    favorites: '/favorites',
    accounts: '/accounts',
    notes: '/notes',
    totp: '/totp',
    passwordGenerator: '/password-generator',
    settings: '/settings',
    login: '/login',
    register: '/register',
    confirmEmail: '/confirm-email',
    loading: '/loading'
} as const;

export type RouteKey = keyof typeof ROUTES;

export function navigateTo(route: RouteKey): void {
    window.location.href = ROUTES[route];
}

export function routeHref(route: RouteKey): string {
    return ROUTES[route];
}
