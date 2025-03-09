const socket = io();
let username = '';

// Emoji button functionality
document.getElementById('emoji-btn').addEventListener('click', () => {
  const emojis = ['😊','👍','❤️','🎉','🔥','👋','😂','🤔','👀','✨'];
  const msgInput = document.getElementById('message');
  msgInput.value += emojis[Math.floor(Math.random() * emojis.length)];
  msgInput.focus();
});

function getCurrentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' +
         now.getMinutes().toString().padStart(2, '0');
}

function addMessageToChat(message, isSent, isSystem = false) {
  const chatBox = document.getElementById('chat-box');
  const msgDiv = document.createElement('div');
  if (isSystem) {
    msgDiv.className = 'message-row system';
    msgDiv.innerHTML = `<div class="system-message">${message}</div>`;
  } else {
    msgDiv.className = isSent ? 'message-row sent' : 'message-row received';
    const time = getCurrentTime();
    msgDiv.innerHTML = `
      <div class="message-bubble">
        <div class="message-text">${message}</div>
        <div class="message-info">
          <div class="message-time">${time}</div>
          ${isSent ? '<div class="message-status"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>' : ''}
        </div>
      </div>
    `;
  }
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
  setTimeout(() => { msgDiv.classList.add('visible'); }, 10);
}

// Socket event listeners
socket.on('connect', () => {
  addMessageToChat('Connected to the secure chat server.', false, true);
});

socket.on('username', (user) => {
  username = user;
  addMessageToChat(`Welcome, ${username}! Your messages are now encrypted.`, false, true);
});

socket.on('roomFull', () => {
  alert('Chat is full. Try again later.');
});

socket.on('receiveMessage', (encryptedMsg) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMsg, 'secret_key');
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  const [sender, ...rest] = decrypted.split(':');
  const msgContent = rest.join(':').trim();
  const isSent = sender === username;
  if (isSent) {
    addMessageToChat(msgContent, true);
  } else {
    addMessageToChat(`<strong>${sender}</strong>: ${msgContent}`, false);
  }
});

socket.on('clearChat', () => {
  document.getElementById('chat-box').innerHTML = '';
  addMessageToChat('Chat has been cleared.', false, true);
});

socket.on('systemMessage', (msg) => {
  addMessageToChat(msg, false, true);
});

socket.on('kicked', () => {
  addMessageToChat('You have been kicked from the chat.', false, true);
  setTimeout(() => { window.location.reload(); }, 2000);
});

// Typing indicator events (from other users)
socket.on('typing', ({ user }) => {
  showTypingIndicator(user);
});
socket.on('stopTyping', () => {
  hideTypingIndicator();
});

// Send message on click or Enter key
document.getElementById('send').addEventListener('click', sendMessage);
document.getElementById('message').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

function sendMessage() {
  const input = document.getElementById('message');
  let text = input.value.trim();
  if (!text) return;

  // Process commands
  if (text.startsWith('/')) {
    const parts = text.split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    switch (command) {
      case '/purge':
        socket.emit('purgeChat');
        input.value = '';
        socket.emit('stopTyping');
        return;
      case '/refresh':
        window.location.reload();
        return;
      case '/shrug':
        text = '¯\\(ツ)/¯';
        break;
      case '/nick':
        if (args.length > 0) {
          const oldName = username;
          username = args.join(' ');
          addMessageToChat(`Nickname changed from ${oldName} to ${username}`, true, true);
          socket.emit('updateNick', username);
        } else {
          addMessageToChat('Usage: /nick [newNickname]', true, true);
          input.value = '';
          return;
        }
        break;
      case '/kick':
        if (args.length > 0) {
          const targetNick = args.join(' ');
          socket.emit('kickUser', targetNick);
          addMessageToChat(`Kick command issued for ${targetNick}`, true, true);
        } else {
          addMessageToChat('Usage: /kick [username]', true, true);
        }
        input.value = '';
        socket.emit('stopTyping');
        return;
      case '/help':
        const helpText = `Available commands:<br>
• /purge - Clear all messages in the chat.<br>
• /refresh - Refresh your session to get a new random username.<br>
• /shrug - Insert a shrug emoticon (¯\\(ツ)/¯).<br>
• /nick [new name] - Change your display name.<br>
• /kick [username] - Kick a user from the chat.<br>
• /help - Show this help message.`;
        addMessageToChat(helpText, true, true);
        input.value = '';
        socket.emit('stopTyping');
        return;
      default:
        addMessageToChat('Unknown command. Type /help for a list of commands.', true, true);
        input.value = '';
        socket.emit('stopTyping');
        return;
    }
  }

  // Encrypt and send normal message
  const encrypted = CryptoJS.AES.encrypt(`${username}: ${text}`, 'secret_key').toString();
  socket.emit('sendMessage', encrypted);
  input.value = '';
  socket.emit('stopTyping');

  const sendBtn = document.getElementById('send');
  sendBtn.classList.add('sending');
  setTimeout(() => { sendBtn.classList.remove('sending'); }, 500);
}

// Typing indicator: use keyup with a timer so that "stopTyping" is sent after 1 second of inactivity
const msgInput = document.getElementById('message');
let typingTimer;
const doneTypingInterval = 1000; // 1 second

msgInput.addEventListener('keyup', () => {
  if (msgInput.value.length > 0) {
    socket.emit('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('stopTyping');
    }, doneTypingInterval);
  } else {
    socket.emit('stopTyping');
  }
});

function showTypingIndicator(user) {
  // Only show if not already present
  if (document.querySelector('.typing-indicator')) return;
  const chatBox = document.getElementById('chat-box');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message-row received typing-indicator';
  typingDiv.innerHTML = `
    <div class="message-bubble typing">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="typing-text">${user} is typing...</div>
    </div>
  `;
  chatBox.appendChild(typingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTypingIndicator() {
  const typingIndicator = document.querySelector('.typing-indicator');
  if (typingIndicator) { typingIndicator.remove(); }
}