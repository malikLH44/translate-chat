const { test, describe, before, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');

// Les secrets doivent exister AVANT d'importer l'application
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const pool = require('../src/db');
const app = require('../src/app');

function tokenFor(userId, secret = process.env.JWT_ACCESS_SECRET) {
  return jwt.sign({ sub: userId, email: 'a@test.com' }, secret, { expiresIn: '5m' });
}

// Remet les vraies fonctions après chaque test
afterEach(() => {
  mock.restoreAll();
});

describe('GET /health', () => {
  test('répond 200 avec status ok', async () => {
    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });
});

describe('POST /auth/signup', () => {
  test('refuse une inscription sans mot de passe (400)', async () => {
    const res = await request(app).post('/auth/signup').send({ email: 'a@test.com' });

    assert.equal(res.status, 400);
  });

  test('refuse un email déjà utilisé (409) et ne crée rien', async () => {
    mock.method(pool, 'query', async () => ({ rows: [{ id: 'existing' }] }));

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'a@test.com', password: 'motdepasse123' });

    assert.equal(res.status, 409);
    // une seule requête SQL (le SELECT), donc aucun INSERT
    assert.equal(pool.query.mock.calls.length, 1);
  });

  test('crée le compte, hache le mot de passe et ne renvoie jamais le hash', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (sql.startsWith('SELECT id FROM users')) return { rows: [] };
      return {
        rows: [{ id: 'u1', email: 'new@test.com', preferred_language: 'es', created_at: '2026-01-01' }],
      };
    });

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'new@test.com', password: 'motdepasse123', preferred_language: 'es' });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'new@test.com');
    assert.equal(res.body.user.password_hash, undefined);

    // Le 2e appel SQL est l'INSERT : son 2e paramètre est le hash stocké
    const storedHash = pool.query.mock.calls[1].arguments[1][1];
    assert.ok(storedHash.startsWith('$argon2'));
    assert.notEqual(storedHash, 'motdepasse123');
  });
});

describe('POST /auth/login', () => {
  let goodHash;

  before(async () => {
    goodHash = await argon2.hash('bon-mot-de-passe');
  });

  test('refuse un email inconnu (401)', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'inconnu@test.com', password: 'bon-mot-de-passe' });

    assert.equal(res.status, 401);
  });

  test('refuse un mauvais mot de passe (401)', async () => {
    mock.method(pool, 'query', async () => ({
      rows: [{ id: 'u1', email: 'a@test.com', password_hash: goodHash, preferred_language: 'fr' }],
    }));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@test.com', password: 'mauvais-mot-de-passe' });

    assert.equal(res.status, 401);
    assert.equal(res.body.accessToken, undefined);
  });

  test('connecte l\'utilisateur et renvoie un JWT valide contenant son id', async () => {
    mock.method(pool, 'query', async () => ({
      rows: [{ id: 'u1', email: 'a@test.com', password_hash: goodHash, preferred_language: 'fr' }],
    }));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@test.com', password: 'bon-mot-de-passe' });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.password_hash, undefined);

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_ACCESS_SECRET);
    assert.equal(decoded.sub, 'u1');
    assert.ok(res.body.refreshToken);
  });
});

describe('Routes protégées par JWT', () => {
  test('GET /auth/me sans token renvoie 401', async () => {
    const res = await request(app).get('/auth/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Token manquant');
  });

  test('GET /auth/me avec un token signé avec un autre secret renvoie 401', async () => {
    const forged = tokenFor('u1', 'un-autre-secret');

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${forged}`);

    assert.equal(res.status, 401);
  });

  test('GET /auth/me avec un token valide renvoie l\'utilisateur', async () => {
    mock.method(pool, 'query', async () => ({
      rows: [{ id: 'u1', email: 'a@test.com', preferred_language: 'fr', created_at: '2026-01-01' }],
    }));

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenFor('u1')}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, 'u1');
  });

  test('GET /auth/users exclut l\'utilisateur connecté (id pris dans le token)', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));

    await request(app).get('/auth/users').set('Authorization', `Bearer ${tokenFor('u42')}`);

    // le paramètre SQL $1 doit être l'id contenu dans le token
    assert.deepEqual(pool.query.mock.calls[0].arguments[1], ['u42']);
  });
});