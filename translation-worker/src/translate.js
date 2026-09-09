const axios = require('axios');

async function translateText(text, source, target) {
  if (source === target) {
    return text;
  }

  const response = await axios.post(`${process.env.LIBRETRANSLATE_URL}/translate`, {
    q: text,
    source,
    target,
    format: 'text',
  });

  return response.data.translatedText;
}

module.exports = { translateText };