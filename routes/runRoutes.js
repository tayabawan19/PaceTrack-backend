const express = require('express');
const router = express.Router();
const runController = require('../controllers/runController');
const authMiddleware = require('../middleware/authMiddleware');

// Secure all run tracking endpoints using JWT auth verification middleware
router.use(authMiddleware);

// Expose endpoints
router.post('/', runController.createRun);
router.get('/', runController.getUserRuns);
router.get('/stats', runController.getRunStats);
router.get('/streak', runController.getRunStreak);
router.get('/achievements', runController.getRunAchievements);
router.get('/:id', runController.getRunById);

module.exports = router;
