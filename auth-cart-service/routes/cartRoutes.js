const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const jwt = require('jsonwebtoken'); // N'oublie pas d'importer JWT

// --- LE VIGILE SOUPLE (Middleware Optionnel) ---
// Il lit le Token s'il y en a un, mais ne bloque pas s'il n'y en a pas.
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        // Si un Token est là, on essaie de le lire
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user; // On attache l'identité à la requête
            }
            next(); // On laisse passer vers le contrôleur
        });
    } else {
        // Pas de Token ? On laisse passer quand même (il sera géré via le Session ID)
        next(); 
    }
};

// --- TES ROUTES ---
// On remplace "authenticateToken" par "optionalAuth" sur toutes les routes du panier

router.get('/', optionalAuth, cartController.getCart);
router.post('/add', optionalAuth, cartController.addItem); // Ou '/' selon comment tu l'as nommée
router.put('/update/:productId', optionalAuth, cartController.updateQuantity);
router.delete('/remove/:productId', optionalAuth, cartController.removeItem);

module.exports = router;