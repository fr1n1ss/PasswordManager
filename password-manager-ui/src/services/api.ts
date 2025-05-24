import axios from 'axios';

const api = axios.create({
  baseURL: 'https://192.168.0.101:7163/api',
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

export const register = async (username: string, email: string, password: string, masterPassword: string) => {
  const response = await api.post('/auth/register', { username, email, password, masterPassword });
  return response.data;
};

export const getAccounts = async (masterPassword: string) => {
  const response = await api.get('/accounts/GetAccounts', {params: {masterPassword}});
  return response.data;
};

export  const getAccountById = async (accountId: number, masterPassword: string) =>{
  const response = await api.get(`/accounts/GetAccountById?accountId=${accountId}&masterPassword=${masterPassword}`)
  return response.data;
}

export const addAccount = async (account: { serviceName: string, login: string, password: string, url:string, description?: string, masterPassword: string }) => {
  const response = await api.post('/accounts/AddAccount', account);
  return response.data;
};

export const updateAccount = async(newAccount:{id: number, newLogin: string, newServiceName: string, newPassword: string, newURL: string, newDescription: string, masterPassword: string}) => {
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
  const response = await api.get(`notes/GetNoteByIdAsync?noteId=${noteId}&masterPassword=${masterPassword}`);
  return response.data;
};

export const updateNote = async (id: number, newTitle: string, newContent: string, masterPassword: string) => {
  const response = await api.post(`/notes/UpdateNoteAsync`,{ id, newTitle, newContent, masterPassword });
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

export const getUserFavorites = async (masterPassword: string) => {
  const response = await api.get(`/favorite/GetUserFavoritesAsync`, {params: {masterPassword}});
  return response.data;
};

export const isFavorite = async (entityType: string, entityId: number) => {
  const response = await api.put(`/favorite/IsFavoriteAsync?entityType=${entityType}&entityId=${entityId}`);
  return response.data;
};

export  const getUserInfo = async  () => {
  const response = await api.get(`/User/GetUserInfo`);
  return response.data;
}

export  const ping = async () => {
  const response = await  api.get(`/auth/ping`);
  return response.data;
}