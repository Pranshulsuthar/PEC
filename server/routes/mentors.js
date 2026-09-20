const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(allowRoles('mentor'));

router.get('/', mentorController.getAll);
router.get('/:id', mentorController.getById);
router.put('/:id', mentorController.update);
router.get('/:id/mentees', mentorController.getMentees);

module.exports = router;
