const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/db');
const translate = require('../src/translate');
const conversations = require('../src/conversations');
const { handleMessage } = require('../src/messageHandler');

const incoming = {
  pairKey: 'userA_userB',
  senderId: 'userA',
  recipientId: 'userB',
  text: 'Bonjour',
  sourceLang: 'fr',
  timestamp: 1700000000000,
};

let producer;

beforeEach(() => {
  // on coupe les logs pendant les tests pour garder une sortie lisible
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});

  producer = { send: mock.fn(async () => {}) };

  mock.method(conversations, 'getOrCreateConversation', async () => 'conv-1');
});

afterEach(() => {
  mock.restoreAll();
});

// Simule Postgres : langue du destinataire + enregistrement de l'INSERT
function fakeDatabase(recipientRows) {
  mock.method(pool, 'query', async (sql) => {
    if (sql.includes('SELECT preferred_language')) return { rows: recipientRows };
    return { rows: [] };
  });
}

describe('handleMessage', () => {
  test('traduit vers la langue du destinataire lue en base, persiste puis publie', async () => {
    fakeDatabase([{ preferred_language: 'es' }]);
    mock.method(translate, 'translateText', async () => 'Hola');

    await handleMessage(incoming, producer);

    // 1. la langue cible vient de la base (es), pas du message
    assert.deepEqual(translate.translateText.mock.calls[0].arguments, ['Bonjour', 'fr', 'es']);

    // 2. le message est enregistré : le 3e appel SQL est l'INSERT
    const insertCall = pool.query.mock.calls.find((c) => c.arguments[0].includes('INSERT INTO messages'));
    assert.deepEqual(insertCall.arguments[1], ['conv-1', 'userA', 'Bonjour', 'fr', 'Hola', 'es']);

    // 3. la publication est faite sur le bon topic, avec la bonne clé de partition
    assert.equal(producer.send.mock.calls.length, 1);
    const sent = producer.send.mock.calls[0].arguments[0];
    assert.equal(sent.topic, 'chat.messages.translated');
    assert.equal(sent.messages[0].key, 'userA_userB');

    const payload = JSON.parse(sent.messages[0].value);
    assert.equal(payload.conversationId, 'conv-1');
    assert.equal(payload.translatedText, 'Hola');
    assert.equal(payload.targetLang, 'es');
    assert.equal(payload.senderId, 'userA');
  });

  test('ne publie rien et ne plante pas si le destinataire est introuvable', async () => {
    fakeDatabase([]);
    mock.method(translate, 'translateText', async () => 'jamais appelé');

    await assert.doesNotReject(() => handleMessage(incoming, producer));

    assert.equal(translate.translateText.mock.calls.length, 0);
    assert.equal(producer.send.mock.calls.length, 0);
  });

  test('ne persiste ni ne publie rien si la traduction échoue (message perdu, limite connue)', async () => {
    fakeDatabase([{ preferred_language: 'es' }]);
    mock.method(translate, 'translateText', async () => {
      throw new Error('LibreTranslate indisponible');
    });

    await assert.doesNotReject(() => handleMessage(incoming, producer));

    const inserts = pool.query.mock.calls.filter((c) => c.arguments[0].includes('INSERT INTO messages'));
    assert.equal(inserts.length, 0);
    assert.equal(producer.send.mock.calls.length, 0);
  });

  test('envoie la langue cible identique à la source sans la modifier', async () => {
    fakeDatabase([{ preferred_language: 'fr' }]);
    mock.method(translate, 'translateText', async (text) => text);

    await handleMessage(incoming, producer);

    const payload = JSON.parse(producer.send.mock.calls[0].arguments[0].messages[0].value);
    assert.equal(payload.translatedText, 'Bonjour');
    assert.equal(payload.targetLang, 'fr');
  });
});