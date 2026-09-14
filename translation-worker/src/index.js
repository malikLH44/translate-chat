require('dotenv').config();
const { start } = require('./kafkaClient');
const { translateText } = require('./translate');
const { getOrCreateConversation } = require('./conversations');
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

async function saveMessage({ conversationId, senderId, text, sourceLang, translatedText, targetLang }) {
  await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, original_text, original_lang, translated_text, translated_lang)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [conversationId, senderId, text, sourceLang, translatedText, targetLang]
  );
}

async function handleMessage(data, producer) {
  console.log('Message reçu depuis chat.messages.raw:', data);

  try {
    const targetLang = await getRecipientLanguage(data.recipientId);
    const translatedText = await translateText(data.text, data.sourceLang, targetLang);

    const conversationId = await getOrCreateConversation(data.senderId, data.recipientId);

    await saveMessage({
      conversationId,
      senderId: data.senderId,
      text: data.text,
      sourceLang: data.sourceLang,
      translatedText,
      targetLang,
    });

    const translatedMessage = {
      ...data,
      conversationId,
      translatedText,
      targetLang,
    };

    await producer.send({
      topic: 'chat.messages.translated',
      messages: [
        {
          key: data.pairKey,
          value: JSON.stringify(translatedMessage),
        },
      ],
    });

    console.log('Message traduit, persisté et publié:', translatedMessage);
  } catch (err) {
    console.error('Erreur lors du traitement du message:', err.message);
  }
}

start(handleMessage).catch((err) => {
  console.error('Erreur fatale du worker:', err);
  process.exit(1);
});