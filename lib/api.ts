// In lib/api.ts

import axios from 'axios';

// Replace 'YOUR_COMPUTER_IP_ADDRESS' with your actual local IP
const API_BASE_URL = 'http://192.168.11.95:4000/api/app';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export default apiClient;