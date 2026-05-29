import axios from 'axios';
import { clearAuthToken, clearSensitiveSession, getAuthToken } from './security-session.ts';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => response, (error) => {
  const status = error?.response?.status;
  const hasToken = Boolean(getAuthToken());
  const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register' || window.location.pathname === '/confirm-email';

  if (status === 401 && hasToken && !isAuthPage) {
    clearAuthToken();
    clearSensitiveSession();
    window.location.href = '/login?sessionExpired=1';
  }

  return Promise.reject(error);
});

export const login = async (username: string, password: string) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data as { token?: string; requires2FA?: boolean; tempToken?: string };
};

export const loginWith2FA = async (tempToken: string, code: string) => {
  const response = await api.post('/auth/2fa/login', { tempToken, code });
  return response.data as { token: string };
};

export const register = async (username: string, email: string, password: string, salt: string, masterPasswordVerifier?: string | null) => {
  const response = await api.post('/auth/register', { username, email, password, salt, masterPasswordVerifier });
  return response.data as { registered: boolean; emailConfirmationRequired: boolean; email: string; delivered: boolean; previewCode?: string; message: string };
};

export const confirmRegistrationEmail = async (email: string, code: string) => {
  const response = await api.post('/auth/confirm-registration-email', { email, code });
  return response.data as { confirmed: boolean };
};

export const resendRegistrationEmail = async (email: string) => {
  const response = await api.post('/auth/resend-registration-email', { email });
  return response.data as { delivered?: boolean; previewCode?: string; confirmed?: boolean };
};

export const requestPasswordReset = async (email: string) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data as { delivered: boolean; previewCode?: string };
};

export const resetPassword = async (email: string, code: string, newPassword: string) => {
  const response = await api.post('/auth/reset-password', { email, code, newPassword });
  return response.data as { reset: boolean };
};

export const getAccounts = async () => {
  const response = await api.get('/accounts/GetAccounts');
  return response.data;
};

export  const getAccountById = async (accountId: number) =>{
  const response = await api.get(`/accounts/GetAccountById?accountId=${accountId}`)
  return response.data;
}

export const addAccount = async (account: { serviceName: string, login: string, password: string, url:string, description?: string }) => {
  const response = await api.post('/accounts/AddAccount', account);
  return response.data;
};

export const updateAccount = async(newAccount:{id: number, newLogin: string, newServiceName: string, newPassword: string, newURL: string, newDescription: string}) => {
  const response = await api.post('/accounts/UpdateAccount', newAccount);
  return response.data
}

export const deleteAccount = async (accountId: number) => {
  await api.delete(`/accounts/DeleteAccount?accountId=${accountId}`);
};

export const addNote = async (title: string, content: string) => {
  const response = await api.post(`/notes/AddNote`,{ title, content });
  return response.data;
};

export const getUserNotes = async () => {
  const response = await api.get(`/notes/GetNotesAsync`);
  return response.data;
};

export const getNoteById = async (noteId: number) => {
  const response = await api.get(`notes/GetNoteByIdAsync?noteId=${noteId}`);
  return response.data;
};

export const updateNote = async (id: number, newTitle: string, newContent: string) => {
  const response = await api.post(`/notes/UpdateNoteAsync`,{ id, newTitle, newContent });
  return response.data;
};

export const deleteNote = async (noteId: number) => {
  await api.delete(`/notes/DeleteNoteAsync`, {params: { noteId }});
};


export const addToFavorites = async (entityType: string, entityId: number) => {
  const response = await api.post(`/favorite/AddToFavoritesAsync?entityType=${entityType}&entityId=${entityId}`);
  return response.data;
};

export const removeFromFavorites = async (entityType: string, entityId: number) => {
  await api.delete(`/favorite/RemoveFromFavoritesAsync?entityType=${entityType}&entityId=${entityId}`);
};

export const getUserFavorites = async () => {
  const response = await api.get(`/favorite/GetUserFavoritesAsync`);
  return response.data;
};

export const isFavorite = async (entityType: string, entityId: number) => {
  const response = await api.put(`/favorite/IsFavoriteAsync?entityType=${entityType}&entityId=${entityId}`);
  return response.data;
};

export const getUserInfo = async  () => {
  const response = await api.get(`/User/GetUserInfo`);
  return response.data;
}

export const sendEmailConfirmation = async () => {
  const response = await api.post('/User/SendEmailConfirmation');
  return response.data as { delivered: boolean; previewCode?: string };
}

export const verifyEmailConfirmation = async (code: string) => {
  const response = await api.post('/User/VerifyEmailConfirmation', { code });
  return response.data as { confirmed: boolean };
}

export const requestEmailChange = async (newEmail: string, currentPassword: string) => {
  const response = await api.post('/User/RequestEmailChange', { newEmail, currentPassword });
  return response.data as { delivered: boolean; previewCode?: string };
}

export const confirmEmailChange = async (code: string) => {
  const response = await api.post('/User/ConfirmEmailChange', { code });
  return response.data as { changed: boolean; email: string; emailConfirmed: boolean };
}

export const getAuditLogs = async (take = 50) => {
  const response = await api.get(`/User/GetAuditLogs?take=${take}`);
  return response.data as Array<{
    id: number;
    action: string;
    details?: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
  }>;
}

export const rotateMasterPassword = async (payload: {
  accounts: Array<{ id: number; encryptedPassword: string }>;
  notes: Array<{ id: number; encryptedContent: string }>;
  totpAccounts: Array<{ id: number; encryptedPayload: string; nonce: string; version: number }>;
  masterPasswordVerifier?: string | null;
  clearServerVerifier?: boolean;
}) => {
  const response = await api.post('/User/RotateMasterPassword', payload);
  return response.data as { rotated: boolean; clearedServerVerifier: boolean };
}

export const validateMasterPassword = async (masterPassword: string) => {
  const response = await api.post('/auth/validate-master-password', { masterPassword });
  return response.data;
}

export const updateMasterPasswordVerifier = async (masterPasswordVerifier: string) => {
  const response = await api.post('/auth/master-password-verifier', { masterPasswordVerifier });
  return response.data;
}

export const setup2FA = async () => {
  const response = await api.post('/auth/2fa/setup');
  return response.data as { uri: string };
}

export const verify2FA = async (code: string) => {
  const response = await api.post('/auth/2fa/verify', JSON.stringify(code));
  return response.data;
}

export const disable2FA = async () => {
  const response = await api.post('/auth/2fa/disable');
  return response.data;
}

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await api.post('/auth/change-password', { currentPassword, newPassword });
  return response.data as { changed: boolean };
}

export const getActiveSessions = async () => {
  const response = await api.get('/auth/sessions');
  return response.data as Array<{
    id: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }>;
}

export const revokeSession = async (sessionId: string) => {
  const response = await api.delete(`/auth/sessions/${sessionId}`);
  return response.data as { revoked: boolean };
}

export const revokeOtherSessions = async () => {
  const response = await api.post('/auth/sessions/revoke-others');
  return response.data as { revokedCount: number };
}

export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data as { loggedOut: boolean };
}

export const ping = async () => {
  const response = await  api.get(`/auth/ping`);
  return response.data;
}

export const hashAll = async () => {
  const response = await api.get(`/auth/hashes`);
  return response.data;
}

export const hashNotes = async () => {
  const response = await api.get(`/notes/hashNotes`);
  return response.data;
}
export const hashAccounts = async () => {
  const response = await api.get(`/accounts/hashAccounts`);
  return response.data;
}
export const hashFavorites = async () => {
  const response = await api.get(`/favorite/hashFavorites`);
  return response.data;
}

export const getTotpAccounts = async () => {
  const response = await api.get('/totpAccount/getAccounts');
  return response.data;
};

export const getTotpCodes = async () => {
  const response = await api.get('/totpAccount/codes');
  return response.data;
};

export const addTotpAccount = async (uri: string) => {
  const response = await api.post('/totpAccount/addAccount', uri);
  return response.data;
};

export const addEncryptedTotpAccount = async (payload: { encryptedPayload: string, nonce: string, version: number }) => {
  const response = await api.post('/totpAccount/addEncrypted', payload);
  return response.data;
};

export const deleteTotpAccount = async (accountId: number) => {
  await api.delete('/totpAccount/deleteAccount', { params: { accountId } });
};

export const importTotpQr = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/totpAccount/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const importTotpQrText = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/totpAccount/importQrText', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
