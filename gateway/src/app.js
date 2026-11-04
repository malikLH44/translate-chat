const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const producer = require('./kafkaProducer');
const messagesRoutes = require('./messagesRoutes');

const app = express();
app.use(cors());
app.use(express.static('public'));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/messages', messagesRoutes);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Token manquant'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.sub;
    socket.userEmail = decoded.email;
    next();
  } catch (err) {
    next(new Error('Token invalide ou expiré'));
  }
});

io.on('connection', (socket) => {
  console.log(`Utilisateur connecté : ${socket.userEmail} (${socket.userId}), socket ${socket.id}`);

  socket.join(socket.userId);

  socket.on('send_message', async (data) => {
    try {
      const pairKey = [socket.userId, data.recipientId].sort().join('_');

      const message = {
        pairKey,
        senderId: socket.userId,
        recipientId: data.recipientId,
        text: data.text,
        sourceLang: data.sourceLang,
        timestamp: Date.now(),
      };

      await producer.publishMessage('chat.messages.raw', pairKey, message);
      console.log('Message publié sur Kafka :', message);

      socket.emit('message_sent', { status: 'ok', message });
    } catch (err) {
      console.error('Erreur publication Kafka:', err);
      socket.emit('message_sent', { status: 'error', error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Déconnexion : ${socket.userEmail}`);
  });
});

module.exports = { app, httpServer, io };