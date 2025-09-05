// routes/messages.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware.auth') || require('../middleware/auth'); // in case of different path

// Get messages for a room (public)
router.get('/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.room_id, m.user_id, u.username, m.message, m.created_at
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.room_id = ?
       ORDER BY m.created_at ASC`,
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
