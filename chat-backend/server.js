// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const db = require('./db');

const authRoutes = require('./routes/auth');
const roomsRoutes = require('./routes/rooms');
const messagesRoutes = require('./routes/messages');

const app = express();
app.use(cors());
app.use(express.json());

// REST routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/messages', messagesRoutes);

// create server + socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = payload; // { id, username }
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log('Socket connected:', socket.id, user.username || user.id);

  // join room
  socket.on('join_room', async ({ roomId }) => {
    try {
      // optional: check if user is a member (if not, auto-join for groups)
      const [roomRows] = await db.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
      if (!roomRows.length) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      const room = roomRows[0];

      const [membership] = await db.query('SELECT id FROM room_users WHERE room_id = ? AND user_id = ?', [roomId, user.id]);
      if (!membership.length) {
        // auto-join only for group rooms; for private, require API to create + add both users
        if (room.type === 'group') {
          await db.query('INSERT INTO room_users (room_id, user_id) VALUES (?, ?)', [roomId, user.id]);
        } else {
          socket.emit('error', { message: 'You are not a member of this private room' });
          return;
        }
      }

      socket.join(String(roomId));
      socket.emit('joined_room', { roomId });
      console.log(`${user.username} joined room ${roomId}`);
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // send message
  socket.on('send_message', async ({ roomId, message }) => {
    if (!message || !roomId) {
      socket.emit('error', { message: 'roomId and message required' });
      return;
    }
    try {
      const [result] = await db.query('INSERT INTO messages (room_id, user_id, message) VALUES (?, ?, ?)', [roomId, user.id, message]);
      const newMessage = {
        id: result.insertId,
        room_id: roomId,
        user_id: user.id,
        username: user.username,
        message,
        created_at: new Date()
      };
      // broadcast to room
      io.to(String(roomId)).emit('receive_message', newMessage);
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
