const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(allowRoles('mentor', 'coordinator'));

router.get('/', allowRoles('coordinator'), mentorController.getAll);
router.get('/:id', mentorController.getById);
router.put('/:id', allowRoles('mentor'), mentorController.update);
router.get('/:id/mentees', allowRoles('mentor'), mentorController.getMentees);

module.exports = router;
