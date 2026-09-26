const express = require('express');
const router = express.Router();
const coordinatorController = require('../controllers/coordinatorController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(allowRoles('coordinator'));

router.get('/dashboard', coordinatorController.getDashboard);
router.get('/news', coordinatorController.getNews);

router.get('/students', coordinatorController.getAllStudents);
router.get('/mentors', coordinatorController.getAllMentors);
router.get('/assignments', coordinatorController.listAssignments);
router.get('/events', coordinatorController.getEvents);
router.get('/submissions', coordinatorController.getSubmissions);
router.get('/leaderboard', coordinatorController.getLeaderboard);
router.get('/resources', coordinatorController.getResources);
router.post('/resources', coordinatorController.createResource);
router.delete('/resources/:id', coordinatorController.deleteResource);
router.post('/assign', coordinatorController.assignMentorToStudent);
router.delete('/assign/:id', coordinatorController.unassignMentor);
router.post('/tasks', coordinatorController.createTask);
router.put('/tasks/:id', coordinatorController.updateTask);
router.delete('/tasks/:id', coordinatorController.deleteTask);
router.post('/news', coordinatorController.createNews);
router.put('/news/:id', coordinatorController.updateNews);
router.delete('/news/:id', coordinatorController.deleteNews);
router.post('/events', coordinatorController.createEvent);
router.put('/events/:id', coordinatorController.updateEvent);
router.delete('/events/:id', coordinatorController.deleteEvent);

module.exports = router;
