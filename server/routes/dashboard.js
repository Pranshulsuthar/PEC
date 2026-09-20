const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.get('/student', allowRoles('student'), controller.student);
router.get('/mentor', allowRoles('mentor'), controller.mentor);
router.get('/coordinator', allowRoles('coordinator'), controller.coordinator);

module.exports = router;
