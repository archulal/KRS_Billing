const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET all banana varieties
router.get('/', (req, res) => {
  try {
    const varieties = db.prepare('SELECT * FROM banana_types ORDER BY id ASC').all();
    res.json(varieties);
  } catch (err) {
    console.error('Error fetching banana varieties:', err);
    res.status(500).json({ error: 'Failed to fetch banana varieties' });
  }
});

// POST add new banana variety
router.post('/', (req, res) => {
  try {
    const { name_en, name_ml, default_rate_per_kg, default_stem_waste_per_bunch_kg } = req.body;
    if (!name_en || !name_ml || default_rate_per_kg == null) {
      return res.status(400).json({ error: 'Missing required variety fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO banana_types (name_en, name_ml, default_rate_per_kg, default_stem_waste_per_bunch_kg)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      name_en.trim(),
      name_ml.trim(),
      parseFloat(default_rate_per_kg) || 0,
      parseFloat(default_stem_waste_per_bunch_kg) || 0
    );

    const newVariety = db.prepare('SELECT * FROM banana_types WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newVariety);
  } catch (err) {
    console.error('Error creating banana variety:', err);
    res.status(500).json({ error: 'Failed to create banana variety' });
  }
});

// PUT update variety
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name_en, name_ml, default_rate_per_kg, default_stem_waste_per_bunch_kg } = req.body;

    const stmt = db.prepare(`
      UPDATE banana_types
      SET name_en = ?, name_ml = ?, default_rate_per_kg = ?, default_stem_waste_per_bunch_kg = ?
      WHERE id = ?
    `);

    stmt.run(
      name_en.trim(),
      name_ml.trim(),
      parseFloat(default_rate_per_kg) || 0,
      parseFloat(default_stem_waste_per_bunch_kg) || 0,
      id
    );

    const updated = db.prepare('SELECT * FROM banana_types WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Error updating banana variety:', err);
    res.status(500).json({ error: 'Failed to update banana variety' });
  }
});

// DELETE variety
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    // Check if variety is referenced in bill_items
    const usage = db.prepare('SELECT COUNT(*) as count FROM bill_items WHERE banana_type_id = ?').get(id);
    if (usage && usage.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete banana variety that is used in previous billing records.'
      });
    }

    db.prepare('DELETE FROM banana_types WHERE id = ?').run(id);
    res.json({ success: true, message: 'Variety deleted successfully' });
  } catch (err) {
    console.error('Error deleting banana variety:', err);
    res.status(500).json({ error: 'Failed to delete banana variety' });
  }
});

module.exports = router;
