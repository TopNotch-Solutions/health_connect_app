// In lib/api.ts

import axios from 'axios';

// Replace 'YOUR_COMPUTER_IP_ADDRESS' with your actual local IP
const API_BASE_URL = 'http://10.11.12.55:4000/api/app';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export default apiClient;