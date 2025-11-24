# ShopList - Recipe and Shopping List Manager

A Dockerized full-stack application for managing recipes, ingredients, and shopping lists with real-time collaboration features.

## Features

- **User Authentication**: Register and login with username/password
- **Recipe Management**: Create, read, update, delete, and search recipes
- **Ingredient Management**: Manage ingredients with units (cups, grams, etc.)
- **Recipe Scaling**: Automatically scale ingredients based on serving size
- **Shopping Lists**: Generate shopping lists from multiple recipes
- **Real-time Updates**: See shopping list changes in real-time when multiple users are logged in
- **User Isolation**: Each user only sees their own recipes and data

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: React
- **Real-time**: Socket.io
- **Authentication**: JWT
- **Database**: PostgreSQL
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose installed

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd shoplist
```

2. Start the application:
```bash
docker-compose up --build
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 5001
- Frontend React app on port 3000

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

### First Steps

1. Register a new account at http://localhost:3000/register
2. Create ingredients in the Ingredients page
3. Create recipes using those ingredients
4. Generate shopping lists from your recipes
5. Open the shopping list in multiple tabs/browsers to see real-time updates

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Ingredients
- `GET /api/ingredients` - Get all ingredients
- `POST /api/ingredients` - Create ingredient
- `PUT /api/ingredients/:id` - Update ingredient
- `DELETE /api/ingredients/:id` - Delete ingredient

### Recipes
- `GET /api/recipes` - Get all recipes (with optional search query)
- `GET /api/recipes/:id` - Get single recipe
- `POST /api/recipes` - Create recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe

### Shopping Lists
- `GET /api/shopping-lists` - Get all shopping lists
- `GET /api/shopping-lists/:id` - Get single shopping list
- `POST /api/shopping-lists` - Create shopping list from recipes
- `PATCH /api/shopping-lists/:id/items/:itemId` - Toggle item checked status
- `DELETE /api/shopping-lists/:id` - Delete shopping list

## Environment Variables

### Backend
- `DB_HOST` - Database host (default: postgres)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user (default: shoplist_user)
- `DB_PASSWORD` - Database password (default: shoplist_password)
- `DB_NAME` - Database name (default: shoplist_db)
- `JWT_SECRET` - JWT secret key
- `PORT` - Backend port (default: 5001)

### Frontend
- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:5001)

## Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Database

The database is automatically initialized when the backend starts. Tables are created if they don't exist.

## Real-time Features

Shopping lists support real-time updates using WebSockets. When a user checks or unchecks an item, all other users viewing the same shopping list will see the update in real-time.

## Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- User data isolation (users can only access their own data)
- SQL injection protection using parameterized queries

## License

MIT

