require('dotenv').config();
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { httpServer, io } = require('./app');
const { connectProducer } = require('./kafkaProducer');
const { startConsumer } = require('./kafkaConsumer');

const PORT = process.env.PORT || 4001;

async function start() {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Adapter Redis branché sur Socket.IO');

  await connectProducer();
  await startConsumer(io);

  httpServer.listen(PORT, () => {
    console.log(`Gateway WebSocket démarré sur le port ${PORT}`);
  });
}

start();