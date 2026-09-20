const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Register new user (student, mentor, coordinator)
router.post('/register', authController.register);

// Login returns JWT
router.post('/login', authController.login);

// Get current user info (protected)
router.get('/me', verifyToken, authController.getMe);

module.exports = router;
