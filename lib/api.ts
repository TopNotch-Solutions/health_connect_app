// In lib/api.ts

import axios from 'axios';

const API_BASE_URL = 'http://192.168.178.60:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout for all requests (FIX #3 & #7)
});

// FIX #7: Add response interceptor to handle timeout errors gracefully
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      console.error('[TIMEOUT] Request took too long. Please check your internet connection.');
      return Promise.reject({
        ...error,
        message: 'Connection timeout. Please check your internet and try again.',
        isTimeout: true,
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;