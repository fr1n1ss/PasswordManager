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

export const deleteAccount = async (accountId: number, masterPassword: string) => {
  await api.delete(`/accounts/DeleteAccount?accountId=${accountId}`);
};