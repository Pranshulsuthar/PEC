const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(allowRoles('mentor', 'coordinator'));

router.post('/', allowRoles('coordinator'), require('../controllers/coordinatorController').createMentor);
router.put('/:id/status', allowRoles('coordinator'), require('../controllers/coordinatorController').updateMentorStatus);
router.put('/:id/coordinator', allowRoles('coordinator'), require('../controllers/coordinatorController').updateMentor);
router.put('/:id', allowRoles('mentor', 'coordinator'), (req, res, next) => req.user.role === 'coordinator' ? require('../controllers/coordinatorController').updateMentor(req, res, next) : mentorController.update(req, res, next));
router.get('/', allowRoles('coordinator'), mentorController.getAll);
router.get('/:id', allowRoles('mentor', 'coordinator'), mentorController.getById);
router.put('/:id', allowRoles('mentor'), mentorController.update);
router.get('/:id/mentees', allowRoles('mentor', 'coordinator'), mentorController.getMentees);
router.post('/:id/feedback', allowRoles('mentor'), mentorController.createFeedback);
router.get('/:id/feedback', allowRoles('mentor', 'student', 'coordinator'), mentorController.getFeedback);

module.exports = router;
