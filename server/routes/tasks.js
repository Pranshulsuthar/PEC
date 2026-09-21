const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { allowRoles } = require('../middleware/roleMiddleware');

// All authenticated users can view tasks
router.get('/', taskController.getAll);
router.get('/:id', taskController.getById);

// Only coordinators can create/update/delete
router.post('/', allowRoles('coordinator', 'mentor'), taskController.create);
router.put('/:id', allowRoles('coordinator', 'mentor'), taskController.update);
router.delete('/:id', allowRoles('coordinator', 'mentor'), taskController.delete);

module.exports = router;
