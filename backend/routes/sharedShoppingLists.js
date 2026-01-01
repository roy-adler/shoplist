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
