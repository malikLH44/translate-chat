import axios from 'axios';
import { loadSession } from './auth';

const AUTH_URL = 'http://localhost:4000';
const GATEWAY_URL = 'http://localhost:4001';

export const authApi = axios.create({ baseURL: AUTH_URL });
export const gatewayApi = axios.create({ baseURL: GATEWAY_URL });

export function setAuthToken(token) {
  authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  gatewayApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Réapplique le token au démarrage de l'appli si une session existe déjà
const existingSession = loadSession();
if (existingSession?.accessToken) {
  setAuthToken(existingSession.accessToken);
}