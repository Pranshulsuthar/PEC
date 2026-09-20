const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { allowRoles } = require('../middleware/roleMiddleware');

// All authenticated users can view tasks
router.get('/', taskController.getAll);
router.get('/:id', taskController.getById);

// Only coordinators can create/update/delete
router.post('/', allowRoles('coordinator'), taskController.create);
router.put('/:id', allowRoles('coordinator'), taskController.update);
router.delete('/:id', allowRoles('coordinator'), taskController.delete);

module.exports = router;
