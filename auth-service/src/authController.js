const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const pool = require('./db');

function generateTokens(user) {
  const payload = { sub: user.id, email: user.email };

  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  return { accessToken, refreshToken };
}

async function signup(req, res) {
  try {
    const { email, password, preferred_language } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email et password sont requis' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }

    const passwordHash = await argon2.hash(password);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, preferred_language)
       VALUES ($1, $2, $3)
       RETURNING id, email, preferred_language, created_at`,
      [email, passwordHash, preferred_language || 'en']
    );

    const user = result.rows[0];
    return res.status(201).json({ user });
  } catch (err) {
    console.error('Erreur signup:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email et password sont requis' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const user = result.rows[0];
    const passwordValid = await argon2.verify(user.password_hash, password);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        preferred_language: user.preferred_language,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Erreur login:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

async function me(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, preferred_language, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Erreur me:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

async function listUsers(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, preferred_language FROM users WHERE id != $1 ORDER BY email',
      [req.userId]
    );
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('Erreur listUsers:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

module.exports = { signup, login, me, listUsers };