# Quick Start Guide

## Prerequisites
- Docker and Docker Compose installed on your system

## Starting the Application

1. **Start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Wait for services to start:**
   - Database will initialize automatically
   - Backend will wait for database to be ready
   - Frontend will start on port 3000

3. **Access the application:**
   - Open your browser to http://localhost:3000
   - Backend API is available at http://localhost:5001
   - Register a new account or login

## Using the Application

### 1. Create Ingredients
- Go to the "Ingredients" page
- Click "Add Ingredient"
- Enter ingredient name and unit (e.g., "Flour", "cups")

### 2. Create Recipes
- Go to the "Recipes" page
- Click "Create Recipe"
- Enter recipe name, description, and number of servings
- Add ingredients with amounts
- Save the recipe

### 3. Create Shopping Lists
- Go to the "Shopping Lists" page
- Click "Create Shopping List"
- Enter a name for your shopping list
- Select the number of servings you want to make
- Select one or more recipes
- The system will automatically calculate and aggregate all ingredients needed

### 4. Real-time Updates
- Open a shopping list
- Open the same shopping list in another browser tab or device (logged in as the same user)
- Check or uncheck items in one tab
- See the updates appear in real-time in the other tab

## Stopping the Application

Press `Ctrl+C` in the terminal, then run:
```bash
docker-compose down
```

To remove all data (including the database):
```bash
docker-compose down -v
```

## Troubleshooting

### Port already in use
If ports 3000, 5001, or 5432 are already in use, you can modify the port mappings in `docker-compose.yml`

### Database connection errors
The backend will retry connecting to the database up to 5 times. If it still fails, check that the PostgreSQL container is running:
```bash
docker-compose ps
```

### Frontend not loading
Make sure the frontend container is running and check the logs:
```bash
docker-compose logs frontend
```

### Backend errors
Check backend logs:
```bash
docker-compose logs backend
```

## Development

To develop locally without Docker:

### Backend
```bash
cd backend
npm install
# Make sure PostgreSQL is running locally
# Update .env with your database credentials
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Make sure to update `REACT_APP_API_URL` in the frontend environment if your backend is running on a different port.

