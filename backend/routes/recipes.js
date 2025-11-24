const express = require('express');
const { pool } = require('../config/database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get all recipes for user (with search)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM recipes WHERE user_id = $1';
    const params = [req.userId];

    if (search) {
      query += ' AND (name ILIKE $2 OR description ILIKE $2)';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const recipes = result.rows;

    // Fetch ingredients for each recipe
    for (let recipe of recipes) {
      const ingredientsResult = await pool.query(
        `SELECT ri.id, ri.amount, i.id as ingredient_id, i.name, i.unit
         FROM recipe_ingredients ri
         JOIN ingredients i ON ri.ingredient_id = i.id
         WHERE ri.recipe_id = $1`,
        [recipe.id]
      );
      recipe.ingredients = ingredientsResult.rows;
    }

    res.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single recipe
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const recipeResult = await pool.query(
      'SELECT * FROM recipes WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipe = recipeResult.rows[0];

    const ingredientsResult = await pool.query(
      `SELECT ri.id, ri.amount, i.id as ingredient_id, i.name, i.unit
       FROM recipe_ingredients ri
       JOIN ingredients i ON ri.ingredient_id = i.id
       WHERE ri.recipe_id = $1`,
      [id]
    );

    recipe.ingredients = ingredientsResult.rows;
    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create recipe
router.post('/', [
  body('name').notEmpty().trim(),
  body('servings').isInt({ min: 1 }),
  body('description').optional(),
  body('ingredients').isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, servings, ingredients } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create recipe
      const recipeResult = await client.query(
        'INSERT INTO recipes (name, description, servings, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, description || '', servings || 1, req.userId]
      );

      const recipe = recipeResult.rows[0];

      // Add ingredients
      for (const ingredient of ingredients) {
        // Verify ingredient belongs to user
        const ingredientCheck = await client.query(
          'SELECT id FROM ingredients WHERE id = $1 AND user_id = $2',
          [ingredient.ingredient_id, req.userId]
        );

        if (ingredientCheck.rows.length === 0) {
          throw new Error(`Ingredient ${ingredient.ingredient_id} not found`);
        }

        await client.query(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES ($1, $2, $3)',
          [recipe.id, ingredient.ingredient_id, ingredient.amount]
        );
      }

      await client.query('COMMIT');

      // Fetch recipe with ingredients
      const ingredientsResult = await pool.query(
        `SELECT ri.id, ri.amount, i.id as ingredient_id, i.name, i.unit
         FROM recipe_ingredients ri
         JOIN ingredients i ON ri.ingredient_id = i.id
         WHERE ri.recipe_id = $1`,
        [recipe.id]
      );

      recipe.ingredients = ingredientsResult.rows;
      res.status(201).json(recipe);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update recipe
router.put('/:id', [
  body('name').optional().notEmpty().trim(),
  body('servings').optional().isInt({ min: 1 }),
  body('description').optional(),
  body('ingredients').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, servings, ingredients } = req.body;

    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM recipes WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update recipe
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (name) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }
      if (servings) {
        updates.push(`servings = $${paramCount++}`);
        values.push(servings);
      }
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updates.length > 1) {
        values.push(id, req.userId);
        await client.query(
          `UPDATE recipes SET ${updates.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1}`,
          values
        );
      }

      // Update ingredients if provided
      if (ingredients) {
        // Delete existing ingredients
        await client.query(
          'DELETE FROM recipe_ingredients WHERE recipe_id = $1',
          [id]
        );

        // Add new ingredients
        for (const ingredient of ingredients) {
          const ingredientCheck = await client.query(
            'SELECT id FROM ingredients WHERE id = $1 AND user_id = $2',
            [ingredient.ingredient_id, req.userId]
          );

          if (ingredientCheck.rows.length === 0) {
            throw new Error(`Ingredient ${ingredient.ingredient_id} not found`);
          }

          await client.query(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES ($1, $2, $3)',
            [id, ingredient.ingredient_id, ingredient.amount]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch updated recipe
      const recipeResult = await pool.query(
        'SELECT * FROM recipes WHERE id = $1 AND user_id = $2',
        [id, req.userId]
      );

      const recipe = recipeResult.rows[0];

      const ingredientsResult = await pool.query(
        `SELECT ri.id, ri.amount, i.id as ingredient_id, i.name, i.unit
         FROM recipe_ingredients ri
         JOIN ingredients i ON ri.ingredient_id = i.id
         WHERE ri.recipe_id = $1`,
        [id]
      );

      recipe.ingredients = ingredientsResult.rows;
      res.json(recipe);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete recipe
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

