const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_ACCESS_SECRET = 'test-access-secret';

const pool = require('../src/db');
const { app } = require('../src/app');

function tokenFor(userId, secret = process.env.JWT_ACCESS_SECRET) {
  return jwt.sign({ sub: userId, email: 'a@test.com' }, secret, { expiresIn: '5m' });
}

afterEach(() => {
  mock.restoreAll();
});

describe('GET /health', () => {
  test('répond 200', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });
});

describe('GET /messages/with/:otherUserId', () => {
  test('refuse sans token (401)', async () => {
    const res = await request(app).get('/messages/with/userB');
    assert.equal(res.status, 401);
  });

  test('refuse un token signé avec un autre secret (401)', async () => {
    const res = await request(app)
      .get('/messages/with/userB')
      .set('Authorization', `Bearer ${tokenFor('userA', 'faux-secret')}`);
    assert.equal(res.status, 401);
  });

  test('renvoie une liste vide si aucune conversation n\'existe', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));

    const res = await request(app)
      .get('/messages/with/userB')
      .set('Authorization', `Bearer ${tokenFor('userA')}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { conversationId: null, messages: [] });
    // une seule requête : on ne crée rien et on ne cherche pas de messages
    assert.equal(pool.query.mock.calls.length, 1);
  });

  test('cherche la conversation avec les ids triés, quel que soit l\'ordre', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));

    // userZ demande l'historique avec userA : l'ordre trié est ['userA', 'userZ']
    await request(app)
      .get('/messages/with/userA')
      .set('Authorization', `Bearer ${tokenFor('userZ')}`);

    assert.deepEqual(pool.query.mock.calls[0].arguments[1], ['userA', 'userZ']);
  });

  test('renvoie l\'historique de la conversation', async () => {
    let call = 0;
    mock.method(pool, 'query', async () => {
      call += 1;
      if (call === 1) return { rows: [{ id: 'conv-1' }] };
      return { rows: [{ id: 'm1', sender_id: 'userA', original_text: 'Bonjour' }] };
    });

    const res = await request(app)
      .get('/messages/with/userB')
      .set('Authorization', `Bearer ${tokenFor('userA')}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.conversationId, 'conv-1');
    assert.equal(res.body.messages.length, 1);
    assert.equal(res.body.messages[0].original_text, 'Bonjour');
  });
});