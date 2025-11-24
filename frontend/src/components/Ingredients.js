import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../index.css';

const Ingredients = () => {
  const [ingredients, setIngredients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', unit: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      const response = await api.get('/ingredients');
      setIngredients(response.data);
    } catch (err) {
      setError('Failed to fetch ingredients');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.put(`/ingredients/${editingId}`, formData);
      } else {
        await api.post('/ingredients', formData);
      }
      setShowForm(false);
      setFormData({ name: '', unit: '' });
      setEditingId(null);
      fetchIngredients();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save ingredient');
    }
  };

  const handleEdit = (ingredient) => {
    setFormData({ name: ingredient.name, unit: ingredient.unit });
    setEditingId(ingredient.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this ingredient?')) {
      try {
        await api.delete(`/ingredients/${id}`);
        fetchIngredients();
      } catch (err) {
        setError('Failed to delete ingredient');
      }
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Ingredients</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(true);
              setFormData({ name: '', unit: '' });
              setEditingId(null);
            }}
          >
            Add Ingredient
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {showForm && (
          <div className="card" style={{ marginTop: '20px' }}>
            <h3>{editingId ? 'Edit' : 'Add'} Ingredient</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="e.g., cups, grams, pieces"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ name: '', unit: '' });
                  setEditingId(null);
                }}
                style={{ marginLeft: '10px' }}
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        <div>
          {ingredients.length === 0 ? (
            <p>No ingredients yet. Add your first ingredient!</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Unit</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ingredient) => (
                  <tr key={ingredient.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{ingredient.name}</td>
                    <td style={{ padding: '10px' }}>{ingredient.unit}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleEdit(ingredient)}
                        style={{ marginRight: '5px' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(ingredient.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Ingredients;

