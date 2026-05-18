import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { addUser, getRoom, removeUser, updateRoomState } from './rooms.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: '*'
});

fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: Date.now() };
});

fastify.get('/rooms/:code', async (request, reply) => {
  const room = getRoom(request.params.code);
  if (!room) {
    return reply.code(404).send({ error: 'Room not found' });
  }
  return room;
});

// Attach Socket.io to the Fastify HTTP server
const io = new Server(fastify.server, {
  cors: {
    origin: '*'
  }
});

// Wraps a socket handler in try-catch so a single bad event never crashes the server
const safeHandler = (handler) => (data) => {
  try {
    handler(data);
  } catch (err) {
    console.error(`Socket handler error: ${err.message || err}`);
  }
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', safeHandler(({ roomCode, username }) => {
    if (!roomCode || !username) return;

    socket.join(roomCode);
    const room = addUser(roomCode, { id: socket.id, username });

    socket.emit('room-state', room);
    socket.to(roomCode).emit('user-joined', { username, users: room.users });

    console.log(`${username} joined room ${roomCode}`);
  }));

  socket.on('play', safeHandler(({ roomCode, time }) => {
    if (!roomCode || time == null) return;
    const room = getRoom(roomCode);
    if (!room) return;

    updateRoomState(roomCode, { playing: true, time });
    socket.to(roomCode).emit('play', { time });
  }));

  socket.on('pause', safeHandler(({ roomCode, time }) => {
    if (!roomCode || time == null) return;
    const room = getRoom(roomCode);
    if (!room) return;

    updateRoomState(roomCode, { playing: false, time });
    socket.to(roomCode).emit('pause', { time });
  }));

  socket.on('seek', safeHandler(({ roomCode, time }) => {
    if (!roomCode || time == null) return;
    const room = getRoom(roomCode);
    if (!room) return;

    updateRoomState(roomCode, { time });
    socket.to(roomCode).emit('seek', { time });
  }));

  socket.on('sync-check', safeHandler(({ roomCode, time: userTime }) => {
    if (!roomCode || userTime == null) return;
    const room = getRoom(roomCode);
    if (!room) return;

    const elapsed = (Date.now() - room.updatedAt) / 1000;
    const expectedTime = room.time + (room.playing ? elapsed : 0);
    const drift = Math.abs(userTime - expectedTime);

    if (drift > 0.5) {
      socket.emit('sync-correction', { time: expectedTime, playing: room.playing });
    }
  }));

  socket.on('video-source', safeHandler(({ roomCode, url }) => {
    if (!roomCode || !url) return;
    const room = getRoom(roomCode);
    if (!room) return;

    updateRoomState(roomCode, { url, time: 0, playing: false });
    socket.to(roomCode).emit('video-source', { url });
  }));

  socket.on('chat-message', safeHandler(({ roomCode, username, text, timestamp }) => {
    if (!roomCode || !username) return;
    if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 500) return;

    const room = getRoom(roomCode);
    socket.to(roomCode).emit('chat-message', {
      username,
      text: text.trim(),
      timestamp,
      videoTime: room ? room.time : 0
    });
  }));

  socket.on('reaction', safeHandler(({ roomCode, emoji }) => {
    if (!roomCode || !emoji) return;
    socket.to(roomCode).emit('reaction', { emoji });
  }));

  socket.on('disconnecting', () => {
    try {
      for (const roomCode of socket.rooms) {
        if (roomCode === socket.id) continue; // skip the default room

        const room = getRoom(roomCode);
        const user = room?.users.find((u) => u.id === socket.id);
        const username = user?.username || 'Unknown';

        const updatedRoom = removeUser(roomCode, socket.id);

        socket.to(roomCode).emit('user-left', {
          username,
          users: updatedRoom ? updatedRoom.users : []
        });

        console.log(`${username} left room ${roomCode}`);
      }
    } catch (err) {
      console.error(`Disconnecting handler error: ${err.message || err}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    console.error(`Server error: ${err.message || err}`);
    process.exit(1);
  }
};

start();
