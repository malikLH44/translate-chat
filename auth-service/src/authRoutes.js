const express = require('express');
const { signup, login, me, listUsers } = require('./authController');
const requireAuth = require('./authMiddleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.get('/users', requireAuth, listUsers);

module.exports = router;