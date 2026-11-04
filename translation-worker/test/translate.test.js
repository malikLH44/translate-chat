const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

process.env.LIBRETRANSLATE_URL = 'http://fake-libretranslate:5000';

const { translateText } = require('../src/translate');

afterEach(() => {
  mock.restoreAll();
});

describe('translateText', () => {
  test('ne fait aucun appel réseau si la langue source est la langue cible', async () => {
    mock.method(axios, 'post', async () => ({ data: { translatedText: 'ne doit pas arriver' } }));

    const result = await translateText('Bonjour', 'fr', 'fr');

    assert.equal(result, 'Bonjour');
    assert.equal(axios.post.mock.calls.length, 0);
  });

  test('appelle LibreTranslate avec les bons paramètres et renvoie la traduction', async () => {
    mock.method(axios, 'post', async () => ({ data: { translatedText: 'Hola' } }));

    const result = await translateText('Bonjour', 'fr', 'es');

    assert.equal(result, 'Hola');

    const [url, body] = axios.post.mock.calls[0].arguments;
    assert.equal(url, 'http://fake-libretranslate:5000/translate');
    assert.deepEqual(body, { q: 'Bonjour', source: 'fr', target: 'es', format: 'text' });
  });

  test('propage l\'erreur si LibreTranslate est indisponible', async () => {
    mock.method(axios, 'post', async () => {
      throw new Error('connect ECONNREFUSED');
    });

    await assert.rejects(() => translateText('Bonjour', 'fr', 'es'), /ECONNREFUSED/);
  });
});