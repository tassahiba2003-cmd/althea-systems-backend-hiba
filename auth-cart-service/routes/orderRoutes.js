const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const jwt = require('jsonwebtoken'); // On en a besoin pour décoder le token

// --- NOTRE VIGILE SOUPLE (optionalAuth) ---
// Il vérifie si un Token existe, mais laisse passer quand même si c'est un invité
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (!err) req.user = user; // Si le token est bon, on attache l'utilisateur
            next();
        });
    } else {
        next(); // Si pas de token, on continue en mode invité
    }
};

// --- NOS ROUTES ---
router.post('/checkout', optionalAuth, orderController.checkout);
router.post('/pay', optionalAuth, orderController.confirmPayment);

module.exports = router; // Très important pour que server.js puisse l'utiliser !