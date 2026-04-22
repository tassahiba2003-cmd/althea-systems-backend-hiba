const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route de mise à jour (PUT)
router.put('/profile', authMiddleware, userController.updateProfile);

// Route d'ajout d'adresse (POST)
router.post('/addresses', authMiddleware, userController.addAddress);

module.exports = router;