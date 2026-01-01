const express = require('express');
const { pool } = require('../config/database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get shopping list by share token (public, no auth required)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const listResult = await pool.query(
      'SELECT * FROM shopping_lists WHERE share_token = $1',
      [token]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found or sharing is disabled' });
    }

    const list = listResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT sli.id, sli.amount, sli.checked, i.id as ingredient_id, i.name, i.unit
       FROM shopping_list_items sli
       JOIN ingredients i ON sli.ingredient_id = i.id
       WHERE sli.shopping_list_id = $1
       ORDER BY sli.checked, i.name`,
      [list.id]
    );

    list.items = itemsResult.rows;
    res.json(list);
  } catch (error) {
    console.error('Error fetching shared shopping list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add ingredient to shared shopping list (public, no auth required)
router.post('/:token/items', [
  body('name').notEmpty().trim(),
  body('unit').notEmpty().trim(),
  body('amount').isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.params;
    const { name, unit, amount } = req.body;

    // Verify list exists and get owner info
    const listCheck = await pool.query(
      'SELECT id, user_id FROM shopping_lists WHERE share_token = $1',
      [token]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found or sharing is disabled' });
    }

    const list = listCheck.rows[0];
    const listId = list.id;
    const ownerUserId = list.user_id;

    // Check if ingredient exists for the list owner
    let ingredientId;
    const existingIngredient = await pool.query(
      'SELECT id FROM ingredients WHERE name = $1 AND user_id = $2',
      [name, ownerUserId]
    );

    if (existingIngredient.rows.length > 0) {
      ingredientId = existingIngredient.rows[0].id;
    } else {
      // Create new ingredient for the list owner
      const newIngredient = await pool.query(
        'INSERT INTO ingredients (name, unit, user_id) VALUES ($1, $2, $3) RETURNING id',
        [name, unit, ownerUserId]
      );
      ingredientId = newIngredient.rows[0].id;
    }

    // Check if item already exists in the list
    const existingItem = await pool.query(
      'SELECT id, amount FROM shopping_list_items WHERE shopping_list_id = $1 AND ingredient_id = $2',
      [listId, ingredientId]
    );

    let result;
    if (existingItem.rows.length > 0) {
      // Update existing item by adding to the amount
      const newAmount = parseFloat(existingItem.rows[0].amount) + parseFloat(amount);
      result = await pool.query(
        `UPDATE shopping_list_items
         SET amount = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [newAmount, existingItem.rows[0].id]
      );
    } else {
      // Create new item
      result = await pool.query(
        'INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, amount) VALUES ($1, $2, $3) RETURNING *',
        [listId, ingredientId, amount]
      );
    }

    // Fetch the complete item with ingredient details
    const itemResult = await pool.query(
      `SELECT sli.id, sli.amount, sli.checked, i.id as ingredient_id, i.name, i.unit
       FROM shopping_list_items sli
       JOIN ingredients i ON sli.ingredient_id = i.id
       WHERE sli.id = $1`,
      [result.rows[0].id]
    );

    const newItem = itemResult.rows[0];

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`list_${listId}`).emit('shopping_list_item_added', {
        listId: parseInt(listId),
        item: newItem
      });
    }

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding item to shared shopping list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update shopping list item by share token (public, no auth required)
router.patch('/:token/items/:itemId', [
  body('checked').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, itemId } = req.params;
    const { checked } = req.body;

    // Verify list exists and has this share token
    const listCheck = await pool.query(
      'SELECT id FROM shopping_lists WHERE share_token = $1',
      [token]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Shopping list not found or sharing is disabled' });
    }

    const listId = listCheck.rows[0].id;

    // Update item
    const result = await pool.query(
      `UPDATE shopping_list_items
       SET checked = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND shopping_list_id = $3
       RETURNING *`,
      [checked, itemId, listId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Emit real-time update to all users viewing this shopping list
    const io = req.app.get('io');
    if (io) {
      // Broadcast to all users viewing this list (both authenticated and shared)
      io.to(`list_${listId}`).emit('shopping_list_updated', {
        listId: parseInt(listId),
        itemId: parseInt(itemId),
        checked: checked
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating shared shopping list item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
