import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import Recipes from './components/Recipes';
import RecipeForm from './components/RecipeForm';
import Ingredients from './components/Ingredients';
import ShoppingLists from './components/ShoppingLists';
import ShoppingListDetail from './components/ShoppingListDetail';
import Navbar from './components/Navbar';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

axios.defaults.baseURL = API_URL;

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <Router>
      <div className="App">
        {token && <Navbar user={user} onLogout={handleLogout} />}
        <Routes>
          <Route
            path="/login"
            element={token ? <Navigate to="/recipes" /> : <Login onLogin={handleLogin} />}
          />
          <Route
            path="/register"
            element={token ? <Navigate to="/recipes" /> : <Register onLogin={handleLogin} />}
          />
          <Route
            path="/recipes"
            element={token ? <Recipes /> : <Navigate to="/login" />}
          />
          <Route
            path="/recipes/new"
            element={token ? <RecipeForm /> : <Navigate to="/login" />}
          />
          <Route
            path="/recipes/:id/edit"
            element={token ? <RecipeForm /> : <Navigate to="/login" />}
          />
          <Route
            path="/ingredients"
            element={token ? <Ingredients /> : <Navigate to="/login" />}
          />
          <Route
            path="/shopping-lists"
            element={token ? <ShoppingLists /> : <Navigate to="/login" />}
          />
          <Route
            path="/shopping-lists/:id"
            element={token ? <ShoppingListDetail /> : <Navigate to="/login" />}
          />
          <Route
            path="/"
            element={token ? <Navigate to="/recipes" /> : <Navigate to="/login" />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

