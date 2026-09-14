import { io } from 'socket.io-client';

let socket = null;

export function getSocket(token) {
  if (!socket) {
    socket = io('http://localhost:4001', {
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