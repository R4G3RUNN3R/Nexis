const express = require('express');
const router = express.Router();

// GET /education/courses
router.get('/courses', (req, res) => {
  res.json({
    message: 'Education module placeholder',
    courses: []
  });
});

module.exports = { router };