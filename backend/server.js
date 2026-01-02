const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/database');
const { pool } = require('./config/database');
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
    origin: process.env.NODE_ENV === 'production' ? true : (process.env.FRONTEND_URL || "http://localhost:3000"),
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
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
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const shareToken = socket.handshake.auth.shareToken;
    
    // Allow connections with either JWT token (authenticated) or share token (shared lists)
    if (token) {
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.isAuthenticated = true;
        return next();
      } catch (err) {
        console.error('JWT verification failed:', err.message);
        // If JWT fails and no shareToken, reject
        if (!shareToken) {
          return next(new Error('Invalid token'));
        }
        // Otherwise, try share token below
      }
    }
    
    if (shareToken) {
      // Verify share token exists and get list ID
      try {
        const result = await pool.query(
          'SELECT id FROM shopping_lists WHERE share_token = $1',
          [shareToken]
        );
        if (result.rows.length > 0) {
          socket.shareToken = shareToken;
          socket.listId = result.rows[0].id;
          socket.isAuthenticated = false;
          return next();
        } else {
          return next(new Error('Invalid share token'));
        }
      } catch (err) {
        console.error('Error verifying share token:', err);
        return next(new Error('Database error verifying share token'));
      }
    }
    
    // No valid authentication provided
    return next(new Error('Authentication required'));
  } catch (err) {
    console.error('Socket authentication error:', err);
    return next(err);
  }
});

io.on('connection', (socket) => {
  if (socket.isAuthenticated) {
    // Join user's room for shopping list updates
    socket.join(`user_${socket.userId}`);
    
    // Handle joining a specific list room for real-time updates
    socket.on('join_list', (listId) => {
      socket.join(`list_${listId}`);
    });
  } else if (socket.shareToken) {
    // Automatically join the list room for shared access
    socket.join(`list_${socket.listId}`);
  }
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

