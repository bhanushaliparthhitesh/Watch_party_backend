const rooms = new Map();

export function getOrCreateRoom(roomCode) {
  if (rooms.has(roomCode)) {
    return rooms.get(roomCode);
  }
  
  const defaultState = {
    users: [],
    playing: false,
    time: 0,
    url: null,
    updatedAt: Date.now()
  };
  
  rooms.set(roomCode, defaultState);
  return defaultState;
}

export function addUser(roomCode, user) {
  const room = getOrCreateRoom(roomCode);
  room.users.push(user);
  return room;
}

export function removeUser(roomCode, userId) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.users = room.users.filter(u => u.id !== userId);

  if (room.users.length === 0) {
    rooms.delete(roomCode);
  }
}

export function getRoom(roomCode) {
  return rooms.get(roomCode);
}

export function getUsers(roomCode) {
  const room = rooms.get(roomCode);
  return room ? room.users : [];
}

export function updateRoomState(roomCode, updates) {
  const room = rooms.get(roomCode);
  if (!room) return;

  Object.assign(room, updates);
  room.updatedAt = Date.now();
  return room;
}
