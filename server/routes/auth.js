const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const coordinatorController = require('../controllers/coordinatorController');
const { verifyToken } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

// Register new student or mentor account
router.post('/register', authController.register);
router.post('/coordinator-register', verifyToken, allowRoles('coordinator'), coordinatorController.createCoordinator);

// Login returns JWT
router.post('/login', authController.login);

// Get current user info (protected)
router.get('/me', verifyToken, authController.getMe);

module.exports = router;
