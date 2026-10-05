const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { allowRoles } = require('../middleware/roleMiddleware');

// Student routes require the authenticated student role; coordinators use coordinator routes.
router.use(allowRoles('student', 'coordinator'));

router.get('/', allowRoles('coordinator'), studentController.getAll);
router.post('/', allowRoles('coordinator'), async (req, res) => require('../controllers/coordinatorController').createStudent(req, res));
router.get('/me', allowRoles('student'), studentController.getMe);
router.put('/:id/status', allowRoles('coordinator'), require('../controllers/coordinatorController').updateStudentStatus);
router.get('/:id', allowRoles('student', 'mentor', 'coordinator'), studentController.getById);
router.put('/:id', allowRoles('coordinator'), require('../controllers/coordinatorController').updateStudent);
router.put('/profile/:id', allowRoles('student'), studentController.update);

module.exports = router;
