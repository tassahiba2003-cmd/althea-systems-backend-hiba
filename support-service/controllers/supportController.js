const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==============================================================
// 1. FORMULAIRE CLASSIQUE (Chapitre XIV - Point 1 & 2)
// ==============================================================
exports.submitContactForm = async (req, res) => {
    try {
        const { email, subject, message } = req.body;

        if (!email || !subject || !message) {
            return res.status(400).json({ message: "Tous les champs sont obligatoires." });
        }

        const newMessage = await prisma.contactMessage.create({
            data: { email, subject, message }
        });

        res.status(201).json({ 
            message: "Votre message a bien été envoyé. Notre équipe vous contactera sous peu."
        });
    } catch (error) {
        console.error("🚨 Erreur Formulaire :", error);
        res.status(500).json({ message: "Erreur serveur lors de l'envoi du message." });
    }
};

// ==============================================================
// 2. CHATBOT : DÉMARRER LA SESSION
// ==============================================================
exports.startChatSession = async (req, res) => {
    try {
        const session = await prisma.chatSession.create({ data: {} });
        
        const welcomeMsg = await prisma.chatMessage.create({
            data: {
                sessionId: session.id,
                sender: "BOT",
                text: "Bonjour ! Je suis l'assistant d'Althea Systems. Comment puis-je vous aider ?"
            }
        });

        res.status(201).json({ sessionId: session.id, messages: [welcomeMsg] });
    } catch (error) {
        res.status(500).json({ message: "Erreur d'initialisation du chat." });
    }
};

// ==============================================================
// 3. CHATBOT : L'INTELLIGENCE & ESCALADE (Chapitre XIV - Point 2 & 3)
// ==============================================================
exports.handleChatMessage = async (req, res) => {
    try {
        const { sessionId, text, userEmail } = req.body;

        if (!sessionId || !text) {
            return res.status(400).json({ message: "Session ID et texte requis." });
        }

        // 1. Enregistrer le message de l'utilisateur
        await prisma.chatMessage.create({
            data: { sessionId: parseInt(sessionId), sender: "USER", text }
        });

        if (userEmail) {
            await prisma.chatSession.update({
                where: { id: parseInt(sessionId) },
                data: { userEmail }
            });
        }

        // 2. Logique du Bot
        let botResponse = "Je ne suis pas sûr de comprendre. Voulez-vous parler à un agent du support ?";
        let statusUpdate = "BOT";
        const msgLower = text.toLowerCase();

        if (msgLower.includes("adresse")) {
            botResponse = "Pour modifier votre adresse, allez dans 'Mon Compte' > 'Mes Adresses'.";
        } else if (msgLower.includes("paiement") || msgLower.includes("carte")) {
            botResponse = "Nous acceptons les paiements sécurisés via Stripe (Visa, Mastercard).";
        } else if (msgLower.includes("commande") || msgLower.includes("suivi")) {
            botResponse = "Retrouvez le suivi de votre commande dans l'onglet 'Mes Commandes'.";
        } else if (msgLower.includes("humain") || msgLower.includes("agent") || msgLower.includes("support") || msgLower.includes("oui")) {
            botResponse = "D'accord, je vous transfère. L'équipe support a été notifiée et prendra le relais.";
            statusUpdate = "ESCALATED"; // Déclenche l'escalade vers un humain
        }

        // 3. Enregistrer la réponse du Bot
        const botSavedMsg = await prisma.chatMessage.create({
            data: { sessionId: parseInt(sessionId), sender: "BOT", text: botResponse }
        });

        // 4. Mettre à jour la session si besoin d'un humain
        if (statusUpdate === "ESCALATED") {
            await prisma.chatSession.update({
                where: { id: parseInt(sessionId) },
                data: { status: "ESCALATED" }
            });
        }

        res.status(200).json({ reply: botSavedMsg, status: statusUpdate });

    } catch (error) {
        console.error("🚨 Erreur Chatbot :", error);
        res.status(500).json({ message: "Erreur de traitement du message." });
    }
};