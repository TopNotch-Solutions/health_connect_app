// In lib/api.ts

import axios from 'axios';

// Replace with your actual local IP
const API_BASE_URL = 'http://10.11.12.55:4000/api';  // Remove '/app'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Add timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;