// In lib/api.ts

import axios from 'axios';

// const API_BASE_URL = 'http://13.61.152.64:4000/api';
const API_BASE_URL = 'http://13.61.152.64:4000/api'; // Local testing URL

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 second timeout for large file uploads
});

// Add request interceptor to increase timeout for multipart/form-data (file uploads)
apiClient.interceptors.request.use(
  config => {
    if (config.headers['Content-Type'] === 'multipart/form-data') {
      config.timeout = 180000; // 180 seconds (3 minutes) for file uploads
    }
    return config;
  },
  error => Promise.reject(error)
);

// FIX #7: Add response interceptor to handle timeout errors gracefully
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      console.error('[TIMEOUT] Request took too long. Please check your internet connection.');
      return Promise.reject({
        ...error,
        message: 'Connection timeout. The upload took too long. Please try again with a better connection.',
        isTimeout: true,
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;