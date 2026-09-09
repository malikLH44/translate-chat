require('dotenv').config();
const { start } = require('./kafkaClient');
const { translateText } = require('./translate');
const pool = require('./db');

async function getRecipientLanguage(recipientId) {
  const result = await pool.query(
    'SELECT preferred_language FROM users WHERE id = $1',
    [recipientId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Destinataire introuvable: ${recipientId}`);
  }

  return result.rows[0].preferred_language;
}

async function handleMessage(data, producer) {
  console.log('Message reçu depuis chat.messages.raw:', data);

  try {
    const targetLang = await getRecipientLanguage(data.recipientId);
    const translatedText = await translateText(data.text, data.sourceLang, targetLang);

    const translatedMessage = {
      ...data,
      translatedText,
      targetLang,
    };

    await producer.send({
      topic: 'chat.messages.translated',
      messages: [
        {
          key: data.conversationId,
          value: JSON.stringify(translatedMessage),
        },
      ],
    });

    console.log('Message traduit publié sur chat.messages.translated:', translatedMessage);
  } catch (err) {
    console.error('Erreur lors du traitement du message:', err.message);
  }
}

start(handleMessage).catch((err) => {
  console.error('Erreur fatale du worker:', err);
  process.exit(1);
});