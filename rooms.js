const rooms = new Map();

/**
 * Returns a room by code, creates it if it doesn't exist
 */
export const getOrCreateRoom = (roomCode) => {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      code: roomCode,
      playing: false,
      time: 0,
      url: null,
      updatedAt: Date.now(),
      users: []
    });
  }
  return rooms.get(roomCode);
};

/**
 * Returns a room by code, or null if it doesn't exist
 */
export const getRoom = (roomCode) => {
  return rooms.get(roomCode) || null;
};

/**
 * Adds a user to the specified room
 */
export const addUser = (roomCode, user) => {
  const room = getOrCreateRoom(roomCode);
  room.users.push(user);
  room.updatedAt = Date.now();
  return room;
};

/**
 * Removes a user from a room by userId. 
 * If the room becomes empty, it is deleted.
 */
export const removeUser = (roomCode, userId) => {
  const room = rooms.get(roomCode);
  if (!room) return null;

  room.users = room.users.filter((u) => u.id !== userId);
  room.updatedAt = Date.now();

  if (room.users.length === 0) {
    rooms.delete(roomCode);
    return null; // Room was deleted
  }

  return room;
};

/**
 * Updates the state (playing, time, url, etc.) of a room
 */
export const updateRoomState = (roomCode, updates) => {
  const room = rooms.get(roomCode);
  if (!room) return null;

  Object.assign(room, updates);
  room.updatedAt = Date.now();
  return room;
};
