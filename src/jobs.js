const express = require('express');
const router = express.Router();

// GET /jobs/list
router.get('/list', (req, res) => {
  res.json({
    message: 'Jobs module placeholder',
    jobs: []
  });
});

module.exports = { router };