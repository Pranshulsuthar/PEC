const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { allowRoles } = require('../middleware/roleMiddleware');

// Students can create submissions, mentors can review
router.post('/', allowRoles('student'), submissionController.create);
router.get('/', submissionController.getAll); // protected, can filter by role inside
router.get('/:id', submissionController.getById);
router.put('/:id', allowRoles('mentor', 'coordinator'), submissionController.update);
router.delete('/:id', allowRoles('student'), submissionController.delete);

module.exports = router;
