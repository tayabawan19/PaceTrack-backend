const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public endpoints
router.post('/signup', authController.signup);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/login', authController.login);

// Protected endpoints
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
