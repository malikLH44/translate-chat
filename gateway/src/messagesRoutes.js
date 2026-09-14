const express = require('express');
const pool = require('./db');
const requireHttpAuth = require('./httpAuth');

const router = express.Router();

router.get('/with/:otherUserId', requireHttpAuth, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const [sortedA, sortedB] = [req.userId, otherUserId].sort();

    const conversation = await pool.query(
      'SELECT id FROM conversations WHERE user_a_id = $1 AND user_b_id = $2',
      [sortedA, sortedB]
    );

    if (conversation.rows.length === 0) {
      return res.json({ conversationId: null, messages: [] });
    }

    const conversationId = conversation.rows[0].id;

    const messages = await pool.query(
      `SELECT id, sender_id, original_text, original_lang, translated_text, translated_lang, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return res.json({ conversationId, messages: messages.rows });
  } catch (err) {
    console.error('Erreur historique messages:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;