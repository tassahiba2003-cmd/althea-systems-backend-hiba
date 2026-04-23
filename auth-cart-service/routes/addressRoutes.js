const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const jwt = require('jsonwebtoken');

// Le même vigile souple que pour le panier
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (!err) req.user = user;
            next();
        });
    } else {
        next();
    }
};

router.post('/', optionalAuth, addressController.createAddress);
router.get('/', optionalAuth, addressController.getAddresses);

module.exports = router;