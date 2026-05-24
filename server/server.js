const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Simple in-memory stores (replace with DB in production)
const users = []; // { user, pass, avatar }
const messages = []; // { id, from, to, content, timestamp, songPath }

// File uploads using multer
const uploadDir = path.join(__dirname, 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// API: simple user registration (demo)
app.post('/api/register', (req, res) => {
  const { user, pass } = req.body;
  if (!user || !pass) return res.status(400).json({ error: 'Missing user or pass' });
  if (users.find(u => u.user === user)) return res.status(409).json({ error: 'User exists' });
  users.push({ user, pass, avatar: null });
  return res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  const found = users.find(u => u.user === user && u.pass === pass);
  if (!found) return res.status(401).json({ error: 'Invalid creds' });
  return res.json({ ok: true, user: found.user });
});

// Upload song endpoint for private message
app.post('/api/upload/song', upload.single('song'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  return res.json({ ok: true, path: url, name: req.file.originalname });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// Socket.IO: basic messaging
io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('join', username => {
    socket.data.user = username;
    socket.join(username);
  });

  socket.on('private_message', msg => {
    // msg: { to, content, songPath }
    msg.id = Date.now() + '-' + Math.random().toString(16).slice(2);
    msg.timestamp = new Date().toISOString();
    messages.push(msg);
    io.to(msg.to).emit('private_message', msg);
    io.to(msg.from).emit('private_message', msg);
  });

  socket.on('public_message', msg => {
    msg.id = Date.now() + '-' + Math.random().toString(16).slice(2);
    msg.timestamp = new Date().toISOString();
    messages.push(msg);
    io.emit('public_message', msg);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
