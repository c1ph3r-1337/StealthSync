// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const CHAT_FILE = path.join(__dirname, 'chat.json');
let chatData = [];
let users = [];

// Remove chat.json if it exists on startup (optional)
if (fs.existsSync(CHAT_FILE)) {
  fs.unlinkSync(CHAT_FILE);
}

function generateUsername() {
  return 'User' + Math.floor(Math.random() * 10000);
}

io.on('connection', (socket) => {
  // Limit room to 2 users
  if (users.length >= 2) {
    socket.emit('roomFull');
    socket.disconnect();
    return;
  }

  const username = generateUsername();
  users.push({ id: socket.id, username });
  console.log(`User connected: ${username} (socket: ${socket.id})`);
  socket.emit('username', username);

  socket.on('sendMessage', (encryptedMessage) => {
    chatData.push({ message: encryptedMessage, timestamp: Date.now() });
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chatData, null, 2));
    io.emit('receiveMessage', encryptedMessage);
  });

  // PURGE: Clear chat data and delete chat.json
  socket.on('purgeChat', () => {
    chatData = [];
    if (fs.existsSync(CHAT_FILE)) {
      fs.unlinkSync(CHAT_FILE);
    }
    io.emit('clearChat');
    io.emit('systemMessage', 'Chat has been purged.');
  });

  // KICK: Disconnect a user by nickname
  socket.on('kickUser', (targetNick) => {
    const target = users.find(u => u.username === targetNick);
    if (target) {
      io.to(target.id).emit('kicked');
      const targetSocket = io.sockets.sockets.get(target.id);
      if (targetSocket) {
        targetSocket.disconnect(true);
      }
    } else {
      socket.emit('systemMessage', `User ${targetNick} not found.`);
    }
  });

  // Update nickname so that server uses the new name
  socket.on('updateNick', (newNick) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      console.log(`User ${user.username} changed nickname to ${newNick}`);
      user.username = newNick;
    }
  });

  // Typing events: Broadcast to other clients only
  socket.on('typing', () => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      socket.broadcast.emit('typing', { user: user.username });
    }
  });
  socket.on('stopTyping', () => {
    socket.broadcast.emit('stopTyping');
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    users = users.filter(u => u.id !== socket.id);
  });
});

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
