const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { allowRoles } = require('../middleware/roleMiddleware');

// Student routes require the authenticated student role; coordinators use coordinator routes.
router.use(allowRoles('student', 'coordinator'));

router.get('/', studentController.getAll);
router.get('/me', studentController.getMe);
router.get('/:id', studentController.getById);
router.put('/:id', studentController.update);

module.exports = router;
