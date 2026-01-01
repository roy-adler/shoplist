const express = require('express');
const { pool } = require('../config/database');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// Get all shopping lists for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shopping_lists WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single shopping list with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const listResult = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    const list = listResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT sli.id, sli.amount, sli.checked, i.id as ingredient_id, i.name, i.unit
       FROM shopping_list_items sli
       JOIN ingredients i ON sli.ingredient_id = i.id
       WHERE sli.shopping_list_id = $1
       ORDER BY sli.checked, i.name`,
      [id]
    );

    list.items = itemsResult.rows;
    res.json(list);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create shopping list from recipes
router.post('/', [
  body('name').notEmpty().trim(),
  body('recipeIds').isArray(),
  body('servings').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, recipeIds, servings } = req.body;
    const targetServings = servings || 1;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create shopping list
      const listResult = await client.query(
        'INSERT INTO shopping_lists (name, user_id) VALUES ($1, $2) RETURNING *',
        [name, req.userId]
      );

      const list = listResult.rows[0];

      // Aggregate ingredients from recipes
      const ingredientMap = new Map();

      for (const recipeId of recipeIds) {
        // Verify recipe belongs to user
        const recipeCheck = await client.query(
          'SELECT id, servings FROM recipes WHERE id = $1 AND user_id = $2',
          [recipeId, req.userId]
        );

        if (recipeCheck.rows.length === 0) {
          throw new Error(`Recipe ${recipeId} not found`);
        }

        const recipe = recipeCheck.rows[0];
        const scaleFactor = targetServings / recipe.servings;

        // Get recipe ingredients
        const ingredientsResult = await client.query(
          `SELECT ri.ingredient_id, ri.amount
           FROM recipe_ingredients ri
           WHERE ri.recipe_id = $1`,
          [recipeId]
        );

        for (const row of ingredientsResult.rows) {
          const ingredientId = row.ingredient_id;
          const scaledAmount = parseFloat(row.amount) * scaleFactor;

          if (ingredientMap.has(ingredientId)) {
            ingredientMap.set(
              ingredientId,
              ingredientMap.get(ingredientId) + scaledAmount
            );
          } else {
            ingredientMap.set(ingredientId, scaledAmount);
          }
        }
      }

      // Insert aggregated items
      for (const [ingredientId, amount] of ingredientMap.entries()) {
        await client.query(
          'INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, amount) VALUES ($1, $2, $3)',
          [list.id, ingredientId, amount]
        );
      }

      await client.query('COMMIT');

      // Fetch complete list
      const itemsResult = await pool.query(
        `SELECT sli.id, sli.amount, sli.checked, i.id as ingredient_id, i.name, i.unit
         FROM shopping_list_items sli
         JOIN ingredients i ON sli.ingredient_id = i.id
         WHERE sli.shopping_list_id = $1
         ORDER BY sli.checked, i.name`,
        [list.id]
      );

      list.items = itemsResult.rows;
      res.status(201).json(list);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating shopping list:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update shopping list item (check/uncheck)
router.patch('/:id/items/:itemId', [
  body('checked').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id, itemId } = req.params;
    const { checked } = req.body;

    // Verify list belongs to user
    const listCheck = await pool.query(
      'SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    // Update item
    const result = await pool.query(
      `UPDATE shopping_list_items
       SET checked = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND shopping_list_id = $3
       RETURNING *`,
      [checked, itemId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Emit real-time update to all users viewing this shopping list
    const io = req.app.get('io');
    if (io) {
      const updateData = {
        listId: parseInt(id),
        itemId: parseInt(itemId),
        checked: checked
      };
      // Broadcast to both user's room and list's room (for shared access)
      io.to(`user_${req.userId}`).emit('shopping_list_updated', updateData);
      io.to(`list_${id}`).emit('shopping_list_updated', updateData);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate or regenerate share token for shopping list
router.post('/:id/share', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify list belongs to user
    const listCheck = await pool.query(
      'SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    // Generate a secure random token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // Update shopping list with share token
    const result = await pool.query(
      'UPDATE shopping_lists SET share_token = $1 WHERE id = $2 RETURNING share_token',
      [shareToken, id]
    );

    res.json({ shareToken: result.rows[0].share_token });
  } catch (error) {
    console.error('Error generating share token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get share token for shopping list (if exists)
router.get('/:id/share', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify list belongs to user
    const listCheck = await pool.query(
      'SELECT share_token FROM shopping_lists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    res.json({ shareToken: listCheck.rows[0].share_token || null });
  } catch (error) {
    console.error('Error fetching share token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete shopping list
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM shopping_lists WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    res.json({ message: 'Shopping list deleted successfully' });
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

