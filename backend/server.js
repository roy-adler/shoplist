const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const recipeRoutes = require('./routes/recipes');
const ingredientRoutes = require('./routes/ingredients');
const shoppingListRoutes = require('./routes/shoppingLists');
const sharedShoppingListRoutes = require('./routes/sharedShoppingLists');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', authenticateToken, recipeRoutes);
app.use('/api/ingredients', authenticateToken, ingredientRoutes);
app.use('/api/shopping-lists', authenticateToken, shoppingListRoutes);
app.use('/api/shared/shopping-lists', sharedShoppingListRoutes);

// Socket.io for real-time updates
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);
  
  // Join user's room for shopping list updates
  socket.join(`user_${socket.userId}`);
  
  // Handle joining a specific list room for real-time updates
  socket.on('join_list', (listId) => {
    socket.join(`list_${listId}`);
    console.log(`User ${socket.userId} joined list room ${listId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});

// Make io available to routes
app.set('io', io);

// Initialize database with retry logic
const initServer = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      await db.init();
      const PORT = process.env.PORT || 5001;
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });
      break;
    } catch (err) {
      retries--;
      console.error(`Database initialization failed. Retries left: ${retries}`, err.message);
      if (retries === 0) {
        console.error('Database initialization failed after retries:', err);
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

initServer();

