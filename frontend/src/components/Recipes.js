import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import '../index.css';

const Recipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecipes();
  }, [searchTerm]);

  const fetchRecipes = async () => {
    try {
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await api.get('/recipes', { params });
      setRecipes(response.data);
    } catch (err) {
      setError('Failed to fetch recipes');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this recipe?')) {
      try {
        await api.delete(`/recipes/${id}`);
        fetchRecipes();
      } catch (err) {
        setError('Failed to delete recipe');
      }
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recipes</h2>
          <Link to="/recipes/new" className="btn btn-primary">
            Create Recipe
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          {recipes.length === 0 ? (
            <p>No recipes found. Create your first recipe!</p>
          ) : (
            <div>
              {recipes.map((recipe) => (
                <div key={recipe.id} className="card" style={{ marginBottom: '15px' }}>
                  <div className="card-header">
                    <div>
                      <h3 style={{ marginBottom: '5px' }}>{recipe.name}</h3>
                      <p style={{ color: '#666', fontSize: '14px' }}>
                        Servings: {recipe.servings}
                      </p>
                    </div>
                    <div>
                      <Link
                        to={`/recipes/${recipe.id}/edit`}
                        className="btn btn-secondary"
                        style={{ marginRight: '5px' }}
                      >
                        Edit
                      </Link>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(recipe.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {recipe.description && (
                    <p style={{ marginBottom: '10px' }}>{recipe.description}</p>
                  )}
                  <div>
                    <strong>Ingredients:</strong>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                      {recipe.ingredients?.map((ing, idx) => (
                        <li key={idx}>
                          {ing.amount} {ing.unit} {ing.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recipes;

