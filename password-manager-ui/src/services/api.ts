import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5163/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const login = async (username: string, password: string) => {
  const response = await api.post('/auth/login', { username, password });
  const { token } = response.data;
  localStorage.setItem('token', token);
  return token;
};

export const register = async (username: string, password: string, email: string, masterPassword: string) => {
  const response = await api.post('/auth/register', { username, password, email, masterPassword });
  return response.data;
};

export const getAccounts = async (masterPassword: string) => {
  const response = await api.get('/accounts/GetAccounts', {params: {masterPassword}});
  return response.data;
};

export const addAccount = async (account: { serviceName: string, login: string, password: string, description?: string, masterPassword: string }) => {
  const response = await api.post('/accounts/AddAccount', account);
  return response.data;
};

export const updateAccount = async(newAccount:{serviceName?: string, login?: string, password?: string, description?: string, masterPassword: string}) => {
  const response = await api.post('/accounts/UpdateAccount', newAccount);
  return response.data
}

export const deleteAccount = async (accountId: number) => {
  await api.delete(`/accounts/DeleteAccount?accountId=${accountId}`);
};

export const addNote = async (title: string, content: string, masterPassword: string) => {
  const response = await api.post(`/notes/AddNote`,{ title, content, masterPassword });
  return response.data;
};

export const getUserNotes = async (masterPassword: string) => {
  const response = await api.get(`/notes/GetNotesAsync`, { params: { masterPassword }});
  return response.data;
};

export const getNoteById = async (noteId: number, masterPassword: string) => {
  const response = await api.get(`/notes/GetNoteByIdAsync`, {params: { noteId, masterPassword }});
  return response.data;
};

export const updateNote = async (noteId: number, newTitle: string | null, newContent: string | null, masterPassword: string) => {
  const response = await api.put(`/notes/UpdateNoteAsync`,{ noteId, newTitle, newContent, masterPassword });
  return response.data;
};

export const deleteNote = async (noteId: number) => {
  await api.delete(`/notes/DeleteNoteAsync`, {params: { noteId }});
};


export const addToFavorites = async (entityType: string, entityId: number) => {
  const response = await api.post(`/favorite/AddToFavoritesAsync`,{ entityType, entityId });
  return response.data;
};

export const removeFromFavorites = async (entityType: string, entityId: number) => {
  await api.delete(`/favorite/RemoveFromFavoritesAsync`, {params: { entityType, entityId }});
};

export const getUserFavorites = async (masterPassword: string) => {
  const response = await api.get(`/favorite/GetUserFavoritesAsync`, {params: {masterPassword}});
  return response.data;
};

export const isFavorite = async (entityType: string, entityId: number) => {
  const response = await api.get(`/favorite/IsFavoriteAsync`, { params: { entityType, entityId } });
  return response.data;
};