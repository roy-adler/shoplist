const express = require('express');
const { pool } = require('../config/database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get all ingredients for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ingredients WHERE user_id = $1 ORDER BY name',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create ingredient
router.post('/', [
  body('name').notEmpty().trim(),
  body('unit').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, unit } = req.body;

    // Check if ingredient already exists for user
    const existing = await pool.query(
      'SELECT id FROM ingredients WHERE name = $1 AND user_id = $2',
      [name, req.userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ingredient already exists' });
    }

    const result = await pool.query(
      'INSERT INTO ingredients (name, unit, user_id) VALUES ($1, $2, $3) RETURNING *',
      [name, unit, req.userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ingredient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ingredient
router.put('/:id', [
  body('name').optional().notEmpty().trim(),
  body('unit').optional().notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, unit } = req.body;

    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM ingredients WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (unit) {
      updates.push(`unit = $${paramCount++}`);
      values.push(unit);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, req.userId);

    const result = await pool.query(
      `UPDATE ingredients SET ${updates.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ingredient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete ingredient
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM ingredients WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    res.json({ message: 'Ingredient deleted successfully' });
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

