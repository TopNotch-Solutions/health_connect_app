// In lib/api.ts

import axios from 'axios';

const API_BASE_URL = 'http://10.11.12.55:4000/api'; 

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Add timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;