const { test, describe, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { io: connect } = require('socket.io-client');

process.env.JWT_ACCESS_SECRET = 'test-access-secret';

const producer = require('../src/kafkaProducer');
const { handleTranslated } = require('../src/kafkaConsumer');
const { httpServer, io } = require('../src/app');

let baseUrl;
const openSockets = [];

function tokenFor(userId, secret = process.env.JWT_ACCESS_SECRET) {
  return jwt.sign({ sub: userId, email: `${userId}@test.com` }, secret, { expiresIn: '5m' });
}

// Ouvre un client et attend la connexion (ou l'erreur de handshake)
function open(token) {
  return new Promise((resolve, reject) => {
    const socket = connect(baseUrl, { auth: token ? { token } : {}, reconnection: false });
    openSockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

function waitFor(socket, eventName) {
  return new Promise((resolve) => socket.once(eventName, resolve));
}

before(async () => {
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});

  await new Promise((resolve) => httpServer.listen(0, resolve)); // port aléatoire
  baseUrl = `http://localhost:${httpServer.address().port}`;
});

afterEach(() => {
  openSockets.splice(0).forEach((s) => s.disconnect());
});

after(async () => {
  mock.restoreAll();
  await io.close(); // ferme aussi le serveur HTTP
});

describe('Handshake WebSocket', () => {
  test('refuse une connexion sans token', async () => {
    await assert.rejects(() => open(null), /Token manquant/);
  });

  test('refuse un token signé avec un autre secret', async () => {
    await assert.rejects(() => open(tokenFor('userA', 'faux-secret')), /Token invalide ou expiré/);
  });

  test('accepte un token valide', async () => {
    const socket = await open(tokenFor('userA'));
    assert.equal(socket.connected, true);
  });
});

describe('send_message', () => {
  test('publie sur chat.messages.raw avec l\'expéditeur issu du token et la pairKey triée', async () => {
    const publish = mock.method(producer, 'publishMessage', async () => {});

    const socket = await open(tokenFor('userZ'));
    const ack = waitFor(socket, 'message_sent');

    // le client essaie de se faire passer pour quelqu'un d'autre
    socket.emit('send_message', {
      senderId: 'pirate',
      recipientId: 'userA',
      text: 'Bonjour',
      sourceLang: 'fr',
    });

    const reply = await ack;

    assert.equal(reply.status, 'ok');
    assert.equal(publish.mock.calls.length, 1);

    const [topic, key, message] = publish.mock.calls[0].arguments;
    assert.equal(topic, 'chat.messages.raw');
    assert.equal(key, 'userA_userZ'); // ids triés
    assert.equal(message.senderId, 'userZ'); // vient du token, pas du client
    assert.equal(message.recipientId, 'userA');
    assert.equal(message.text, 'Bonjour');

    publish.mock.restore();
  });

  test('renvoie status error si Kafka est indisponible', async () => {
    const publish = mock.method(producer, 'publishMessage', async () => {
      throw new Error('Kafka down');
    });

    const socket = await open(tokenFor('userA'));
    const ack = waitFor(socket, 'message_sent');

    socket.emit('send_message', { recipientId: 'userB', text: 'Salut', sourceLang: 'fr' });
    const reply = await ack;

    assert.equal(reply.status, 'error');
    assert.match(reply.error, /Kafka down/);

    publish.mock.restore();
  });
});

describe('Livraison d\'un message traduit (consumer Kafka)', () => {
  test('le destinataire reçoit le message dans sa room, pas les autres', async () => {
    const recipient = await open(tokenFor('userB'));
    const bystander = await open(tokenFor('userC'));

    let bystanderReceived = false;
    bystander.on('receive_message', () => {
      bystanderReceived = true;
    });

    const received = waitFor(recipient, 'receive_message');

    const kafkaValue = Buffer.from(
      JSON.stringify({
        senderId: 'userA',
        recipientId: 'userB',
        text: 'Bonjour',
        translatedText: 'Hola',
        targetLang: 'es',
      })
    );
    handleTranslated(io, kafkaValue);

    const data = await received;
    assert.equal(data.translatedText, 'Hola');

    // petite pause pour laisser le temps à un envoi erroné d'arriver
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(bystanderReceived, false);
  });
});