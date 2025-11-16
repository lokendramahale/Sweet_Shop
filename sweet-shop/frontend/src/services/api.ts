// frontend/src/services/api.ts
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/api/auth/register', {
      username,
      email,
      password,
    });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', {
      email,
      password,
    });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  isAdmin: () => {
    const user = authAPI.getCurrentUser();
    return user?.isAdmin || false;
  },
};

// Sweets API
export const sweetsAPI = {
  getAll: async () => {
    const response = await api.get('/api/sweets');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/api/sweets/${id}`);
    return response.data;
  },

  search: async (params: {
    name?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  }) => {
    const response = await api.get('/api/sweets/search', { params });
    return response.data;
  },

  create: async (sweetData: {
    name: string;
    category: string;
    price: number;
    quantity: number;
    description?: string;
    image_url?: string;
  }) => {
    const response = await api.post('/api/sweets', sweetData);
    return response.data;
  },

  update: async (
    id: number,
    sweetData: {
      name?: string;
      category?: string;
      price?: number;
      quantity?: number;
      description?: string;
      image_url?: string;
    }
  ) => {
    const response = await api.put(`/api/sweets/${id}`, sweetData);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/sweets/${id}`);
    return response.data;
  },

  purchase: async (id: number, quantity: number) => {
    const response = await api.post(`/api/sweets/${id}/purchase`, {
      quantity,
    });
    return response.data;
  },

  restock: async (id: number, quantity: number) => {
    const response = await api.post(`/api/sweets/${id}/restock`, {
      quantity,
    });
    return response.data;
  },
};

export default api;