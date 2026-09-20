const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { allowRoles } = require('../middleware/roleMiddleware');

// All routes require student role
router.use(allowRoles('student'));

router.get('/', studentController.getAll);
router.get('/me', studentController.getMe);
router.get('/:id', studentController.getById);
router.put('/:id', studentController.update);

module.exports = router;
