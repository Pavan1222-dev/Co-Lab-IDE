require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');

// 1. Initialize App & Server
const app = express();
const server = http.createServer(app);

// 2. Initialize Socket.io (The Switchboard)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make `io` accessible globally via the app object (Useful for controllers later)
app.set('io', io);

// 3. Connect to Database
connectDB();

// 4. Global Middlewares
app.use(express.json()); // Parses incoming JSON payloads
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// 5. Base Routes (Health Check)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Online', message: 'Co-Lab Signaling Server is running.' });
});

// 6. Socket.io Connection Listener (Placeholder for now)
io.on('connection', (socket) => {
  console.log(`[NET] Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[NET] Client disconnected: ${socket.id}`);
  });
});

// 7. Global Error Handler (Prevents server crashes)
app.use((err, req, res, next) => {
  console.error(`[ERR] ${err.stack}`);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
}); 

// 8. Start the Engine
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[SYS] Co-Lab Engine firing on port ${PORT}...`);
});