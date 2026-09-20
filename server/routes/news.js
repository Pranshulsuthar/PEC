const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const { allowRoles } = require('../middleware/roleMiddleware');

router.get('/', newsController.getAll);
router.get('/:id', newsController.getById);
router.post('/', allowRoles('coordinator'), newsController.create);
router.put('/:id', allowRoles('coordinator'), newsController.update);
router.delete('/:id', allowRoles('coordinator'), newsController.delete);

module.exports = router;
