const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.get('/', eventController.getAll);
router.get('/:id', eventController.getById);
router.post('/', allowRoles('coordinator'), eventController.create);
router.put('/:id', allowRoles('coordinator'), eventController.update);
router.delete('/:id', allowRoles('coordinator'), eventController.delete);

module.exports = router;
