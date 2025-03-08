// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const CHAT_FILE = path.join(__dirname, 'chat.json');

let users = [];
let chatData = [];

if (fs.existsSync(CHAT_FILE)) {
    fs.unlinkSync(CHAT_FILE);
}

// Generate temporary usernames
const generateUsername = () => 'User' + Math.floor(Math.random() * 10000);

io.on('connection', (socket) => {
    if (users.length >= 2) {
        socket.emit('roomFull');
        socket.disconnect();
        return;
    }
    
    const username = generateUsername();
    users.push({ id: socket.id, username });
    socket.emit('username', username);

    socket.on('sendMessage', (encryptedMessage) => {
        chatData.push({ message: encryptedMessage, timestamp: Date.now() });
        fs.writeFileSync(CHAT_FILE, JSON.stringify(chatData, null, 2));
        io.emit('receiveMessage', encryptedMessage);
    });

    socket.on('disconnect', () => {
        users = users.filter(user => user.id !== socket.id);
    });
});

// Delete chat every 10 minutes
setInterval(() => {
    chatData = [];
    if (fs.existsSync(CHAT_FILE)) {
        fs.unlinkSync(CHAT_FILE);
    }
    io.emit('clearChat');
}, 10 * 60 * 1000);

app.use(express.static('public'));

// Serve UI files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(3000, () => console.log('Server running on port 3000'));
