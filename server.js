import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { getRoom, addUser, getUsers, updateRoomState, removeUser } from './rooms.js';

// Create Fastify app
const app = Fastify({ logger: true });

// Register CORS (allows requests from Vercel)
await app.register(cors, { origin: '*' });

// Create HTTP server
const httpServer = createServer(app.server);

// Create Socket.io instance
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Health check (used by Railway to verify server is alive)
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: Date.now() }
});

// Get room state (optional, for debugging)
app.get('/rooms/:code', async (request, reply) => {
  const room = getRoom(request.params.code)
  if (!room) {
    return reply.code(404).send({ error: 'Room not found' })
  }
  return room
});

// Socket.io event handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomCode, username }) => {
    // 1. Join the Socket.io room
    socket.join(roomCode)

    // 2. Add user to room state
    addUser(roomCode, { id: socket.id, username })

    // 3. Get current room state
    const room = getRoom(roomCode)

    // 4. Send state to THIS user only
    socket.emit('room-state', room)

    // 5. Notify others
    socket.to(roomCode).emit('user-joined', { 
      username, 
      users: getUsers(roomCode) 
    })
    
    console.log(`${username} joined room ${roomCode}`)
  })

  socket.on('play', ({ roomCode, time }) => {
    updateRoomState(roomCode, { playing: true, time })
    socket.to(roomCode).emit('play', { time })
  })

  socket.on('pause', ({ roomCode, time }) => {
    updateRoomState(roomCode, { playing: false, time })
    socket.to(roomCode).emit('pause', { time })
  })

  socket.on('seek', ({ roomCode, time }) => {
    updateRoomState(roomCode, { time })
    socket.to(roomCode).emit('seek', { time })
  })

  socket.on('sync-check', ({ roomCode, time }) => {
    const room = getRoom(roomCode)
    if (!room) return

    // Calculate what time should be
    const elapsed = (Date.now() - room.updatedAt) / 1000
    const expectedTime = room.time + (room.playing ? elapsed : 0)
    const drift = Math.abs(time - expectedTime)

    // If drifted more than 0.5 seconds, send correction
    if (drift > 0.5) {
      socket.emit('sync-correction', { time: expectedTime })
    }
  })

  socket.on('video-source', ({ roomCode, url }) => {
    // Update room state: new video, reset time to 0, not playing
    updateRoomState(roomCode, { url, time: 0, playing: false })

    // Tell everyone in room (including sender for confirmation)
    io.to(roomCode).emit('video-source', { url })
  })

  socket.on('chat-message', ({ roomCode, username, text, timestamp }) => {
    // Get current video time for context
    const room = getRoom(roomCode)
    const videoTime = room ? room.time : 0

    // Broadcast to everyone in room
    io.to(roomCode).emit('chat-message', {
      username,
      text,
      timestamp,
      videoTime
    })
  })

  socket.on('reaction', ({ roomCode, emoji }) => {
    // Broadcast to everyone in room
    socket.to(roomCode).emit('reaction', { emoji })
  })

  socket.on('disconnecting', () => {
    // Check all rooms this socket was in
    for (const roomCode of socket.rooms) {
      // Get user info
      const room = getRoom(roomCode)
      if (room) {
        const user = room.users.find(u => u.id === socket.id)
        if (user) {
          // Remove from room
          removeUser(roomCode, socket.id)
          // Tell others
          socket.to(roomCode).emit('user-left', { 
            username: user.username, 
            users: getUsers(roomCode) 
          })
        }
      }
    }
  })
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server running on port ${PORT}`);
});
