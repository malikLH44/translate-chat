import { io } from 'socket.io-client';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4001';

let socket = null;

export function getSocket(token) {
  if (!socket) {
    socket = io(GATEWAY_URL, {
      auth: { token },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}