import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import '../index.css';

const ShoppingLists = () => {
  const [lists, setLists] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    recipeIds: [],
    servings: 1,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLists();
    fetchRecipes();
  }, []);

  const fetchLists = async () => {
    try {
      const response = await api.get('/shopping-lists');
      setLists(response.data);
    } catch (err) {
      setError('Failed to fetch shopping lists');
    }
  };

  const fetchRecipes = async () => {
    try {
      const response = await api.get('/recipes');
      setRecipes(response.data);
    } catch (err) {
      setError('Failed to fetch recipes');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.recipeIds.length === 0) {
      setError('Please select at least one recipe');
      return;
    }

    try {
      await api.post('/shopping-lists', formData);
      setShowForm(false);
      setFormData({ name: '', recipeIds: [], servings: 1 });
      fetchLists();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create shopping list');
    }
  };

  const handleRecipeToggle = (recipeId) => {
    setFormData({
      ...formData,
      recipeIds: formData.recipeIds.includes(recipeId)
        ? formData.recipeIds.filter((id) => id !== recipeId)
        : [...formData.recipeIds, recipeId],
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this shopping list?')) {
      try {
        await api.delete(`/shopping-lists/${id}`);
        fetchLists();
      } catch (err) {
        setError('Failed to delete shopping list');
      }
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Shopping Lists</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(true);
              setFormData({ name: '', recipeIds: [], servings: 1 });
            }}
          >
            Create Shopping List
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {showForm && (
          <div className="card" style={{ marginTop: '20px' }}>
            <h3>Create Shopping List from Recipes</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Shopping List Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Number of Servings</label>
                <input
                  type="number"
                  value={formData.servings}
                  onChange={(e) => setFormData({ ...formData, servings: parseInt(e.target.value) })}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Select Recipes</label>
                {recipes.length === 0 ? (
                  <p>No recipes available. Create recipes first!</p>
                ) : (
                  <div>
                    {recipes.map((recipe) => (
                      <div key={recipe.id} style={{ marginBottom: '10px' }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={formData.recipeIds.includes(recipe.id)}
                            onChange={() => handleRecipeToggle(recipe.id)}
                            style={{ marginRight: '10px' }}
                          />
                          {recipe.name} (servings: {recipe.servings})
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary">
                Create Shopping List
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ name: '', recipeIds: [], servings: 1 });
                }}
                style={{ marginLeft: '10px' }}
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        <div>
          {lists.length === 0 ? (
            <p>No shopping lists yet. Create your first shopping list!</p>
          ) : (
            <div>
              {lists.map((list) => (
                <div key={list.id} className="card" style={{ marginBottom: '15px' }}>
                  <div className="card-header">
                    <Link to={`/shopping-lists/${list.id}`}>
                      <h3>{list.name}</h3>
                    </Link>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(list.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <p style={{ color: '#666', fontSize: '14px' }}>
                    Created: {new Date(list.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingLists;

