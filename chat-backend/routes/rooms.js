// routes/rooms.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Create a room (protected)
router.post('/', auth, async (req, res) => {
  const { name, type } = req.body;
  const roomType = (type === 'private') ? 'private' : 'group';
  try {
    const [r] = await db.query('INSERT INTO rooms (name, type) VALUES (?, ?)', [name || 'Room', roomType]);
    const roomId = r.insertId;

    // Add creator to room_users
    await db.query('INSERT INTO room_users (room_id, user_id) VALUES (?, ?)', [roomId, req.user.id]);

    res.json({ message: 'Room created', roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a room (protected) — adds mapping to room_users
router.post('/:roomId/join', auth, async (req, res) => {
  const { roomId } = req.params;
  try {
    const [exists] = await db.query('SELECT id FROM room_users WHERE room_id = ? AND user_id = ?', [roomId, req.user.id]);
    if (exists.length) return res.json({ message: 'Already a member' });

    await db.query('INSERT INTO room_users (room_id, user_id) VALUES (?, ?)', [roomId, req.user.id]);
    res.json({ message: 'Joined room' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all rooms (public)
router.get('/', async (req, res) => {
  try {
    const [rooms] = await db.query('SELECT * FROM rooms ORDER BY created_at DESC');
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get rooms for logged-in user
router.get('/my', auth, async (req, res) => {
  try {
    const [rooms] = await db.query(
      `SELECT r.* FROM rooms r
       JOIN room_users ru ON ru.room_id = r.id
       WHERE ru.user_id = ?
       ORDER BY r.created_at DESC`, [req.user.id]
    );
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
