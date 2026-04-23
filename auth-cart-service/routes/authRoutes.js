const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const rateLimit = require('express-rate-limit'); // <-- 1. On importe la librairie


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Le temps de blocage : 15 minutes
    max: 5, // Le nombre maximum de tentatives autorisées par IP pendant ces 15 minutes
    message: { 
        message: "Trop de tentatives de connexion échouées. Veuillez réessayer dans 15 minutes." 
    },
    standardHeaders: true, // Renvoie les infos de limite dans les headers (bonnes pratiques)
    legacyHeaders: false, // Désactive les vieux headers obsolètes
});


router.post('/register', authController.register);
router.post('/login', authController.login); 
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.post('/resend-confirmation', authController.resendConfirmation);
module.exports = router;