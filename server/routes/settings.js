const express = require('express');
const router = express.Router();
const { getAllSettings, setSetting } = require('../db');

const EDITABLE_KEYS = ['whatsapp_owner_number', 'whatsapp_message_template'];

// GET all application settings (with defaults filled in)
router.get('/', (req, res) => {
  try {
    res.json(getAllSettings());
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings – update one or more settings
router.put('/', (req, res) => {
  try {
    const body = req.body || {};
    for (const key of EDITABLE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const value = typeof body[key] === 'string' ? body[key] : String(body[key] ?? '');
        if (value.length > 2000) {
          return res.status(400).json({ error: `Setting ${key} is too long` });
        }
        setSetting(key, value);
      }
    }
    res.json(getAllSettings());
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
