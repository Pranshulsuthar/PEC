const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.get('/', allowRoles('student', 'mentor', 'coordinator'), eventController.getAll);
router.post('/:id/register', allowRoles('student', 'mentor'), eventController.register);
router.delete('/:id/register', allowRoles('student', 'mentor'), eventController.cancelRegistration);
router.get('/:id', allowRoles('student', 'mentor', 'coordinator'), eventController.getById);
router.post('/', allowRoles('coordinator'), eventController.create);
router.put('/:id', allowRoles('coordinator'), eventController.update);
router.delete('/:id', allowRoles('coordinator'), eventController.delete);

module.exports = router;
