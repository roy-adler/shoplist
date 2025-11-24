import React from 'react';
import { Link } from 'react-router-dom';
import '../index.css';

const Navbar = ({ user, onLogout }) => {
  return (
    <nav className="navbar">
      <div>
        <Link to="/recipes">Recipes</Link>
        <Link to="/ingredients">Ingredients</Link>
        <Link to="/shopping-lists">Shopping Lists</Link>
      </div>
      <div className="navbar-user">
        <span>Welcome, {user?.username || 'User'}</span>
        <button className="btn btn-secondary" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

