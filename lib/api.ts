// In lib/api.ts

import axios from 'axios';

const API_BASE_URL = 'http://13.61.152.64:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export default apiClient;