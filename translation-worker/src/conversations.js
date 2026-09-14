const pool = require('./db');

async function getOrCreateConversation(userIdA, userIdB) {
  const [sortedA, sortedB] = [userIdA, userIdB].sort();

  const existing = await pool.query(
    'SELECT id FROM conversations WHERE user_a_id = $1 AND user_b_id = $2',
    [sortedA, sortedB]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await pool.query(
    'INSERT INTO conversations (user_a_id, user_b_id) VALUES ($1, $2) RETURNING id',
    [sortedA, sortedB]
  );

  return created.rows[0].id;
}

module.exports = { getOrCreateConversation };