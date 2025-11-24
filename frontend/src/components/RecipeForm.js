import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import '../index.css';

const RecipeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    servings: 1,
    recipeIngredients: [],
  });
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [ingredientAmount, setIngredientAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIngredients();
    if (id) {
      fetchRecipe();
    }
  }, [id]);

  const fetchIngredients = async () => {
    try {
      const response = await api.get('/ingredients');
      setIngredients(response.data);
    } catch (err) {
      setError('Failed to fetch ingredients');
    }
  };

  const fetchRecipe = async () => {
    try {
      const response = await api.get(`/recipes/${id}`);
      const recipe = response.data;
      setFormData({
        name: recipe.name,
        description: recipe.description || '',
        servings: recipe.servings,
        recipeIngredients: recipe.ingredients || [],
      });
    } catch (err) {
      setError('Failed to fetch recipe');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        servings: parseInt(formData.servings),
        ingredients: formData.recipeIngredients.map((ri) => ({
          ingredient_id: ri.ingredient_id,
          amount: parseFloat(ri.amount),
        })),
      };

      if (id) {
        await api.put(`/recipes/${id}`, payload);
      } else {
        await api.post('/recipes', payload);
      }
      navigate('/recipes');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save recipe');
    }
  };

  const handleAddIngredient = () => {
    if (!selectedIngredient || !ingredientAmount) {
      setError('Please select an ingredient and enter an amount');
      return;
    }

    const ingredient = ingredients.find((i) => i.id === parseInt(selectedIngredient));
    if (!ingredient) return;

    const existing = formData.recipeIngredients.find(
      (ri) => ri.ingredient_id === ingredient.id
    );

    if (existing) {
      setError('Ingredient already added');
      return;
    }

    setFormData({
      ...formData,
      recipeIngredients: [
        ...formData.recipeIngredients,
        {
          ingredient_id: ingredient.id,
          name: ingredient.name,
          unit: ingredient.unit,
          amount: ingredientAmount,
        },
      ],
    });

    setSelectedIngredient('');
    setIngredientAmount('');
    setError('');
  };

  const handleRemoveIngredient = (ingredientId) => {
    setFormData({
      ...formData,
      recipeIngredients: formData.recipeIngredients.filter(
        (ri) => ri.ingredient_id !== ingredientId
      ),
    });
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{id ? 'Edit' : 'Create'} Recipe</h2>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Recipe Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Servings</label>
            <input
              type="number"
              value={formData.servings}
              onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label>Ingredients</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Select ingredient</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Amount"
                value={ingredientAmount}
                onChange={(e) => setIngredientAmount(e.target.value)}
                step="0.01"
                min="0"
                style={{ width: '120px' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddIngredient}
              >
                Add
              </button>
            </div>

            <div>
              {formData.recipeIngredients.map((ri, idx) => (
                <div
                  key={idx}
                  className="ingredient-item"
                  style={{ justifyContent: 'space-between' }}
                >
                  <span>
                    {ri.amount} {ri.unit} {ri.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleRemoveIngredient(ri.ingredient_id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            {id ? 'Update' : 'Create'} Recipe
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/recipes')}
            style={{ marginLeft: '10px' }}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default RecipeForm;

