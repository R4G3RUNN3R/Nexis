const express = require('express');
const router = express.Router();

// GET /world/regions
router.get('/regions', (req, res) => {
  res.json({
    message: 'World module placeholder',
    regions: []
  });
});

module.exports = { router };