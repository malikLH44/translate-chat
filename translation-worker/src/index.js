require('dotenv').config();
const { start } = require('./kafkaClient');
const { handleMessage } = require('./messageHandler');

start(handleMessage).catch((err) => {
  console.error('Erreur fatale du worker:', err);
  process.exit(1);
});