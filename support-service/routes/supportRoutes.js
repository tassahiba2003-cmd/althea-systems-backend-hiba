const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');

// Route pour le formulaire classique
router.post('/form', supportController.submitContactForm);

// Routes pour le Chatbot
router.post('/chat/start', supportController.startChatSession);
router.post('/chat/message', supportController.handleChatMessage);

module.exports = router;