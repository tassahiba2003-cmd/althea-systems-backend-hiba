const prisma = require('../config/prisma');

// --- 1. ENREGISTRER UNE NOUVELLE ADRESSE ---
exports.createAddress = async (req, res) => {
    try {
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id'];
        const { firstName, lastName, street, city, zipCode, country, phone } = req.body;

        if (!userId && !sessionId) {
            return res.status(400).json({ message: "Non identifié. Connectez-vous ou fournissez un Session ID." });
        }

        if (!firstName || !lastName || !street || !city || !zipCode || !country || !phone) {
            return res.status(400).json({ message: "Tous les champs sont obligatoires." });
        }

        const newAddress = await prisma.address.create({
            data: {
                userId: userId ? userId : undefined,
                sessionId: !userId ? sessionId : undefined,
                firstName,
                lastName,
                street,
                city,
                zipCode,
                country,
                phone
            }
        });

        res.status(201).json({ message: "Adresse enregistrée avec succès !", address: newAddress });
    } catch (error) {
        console.error("🚨 ERREUR CREATION ADRESSE :", error);
        res.status(500).json({ message: "Erreur lors de l'enregistrement de l'adresse." });
    }
};


// --- 2. RÉCUPÉRER LES ADRESSES DE L'UTILISATEUR ---
// --- 2. RÉCUPÉRER LES ADRESSES (Connecté ou Invité) ---
exports.getAddresses = async (req, res) => {
    try {
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id'];

        if (!userId && !sessionId) {
            return res.status(400).json({ message: "Non identifié. Connectez-vous ou fournissez un Session ID." });
        }

        // On cherche les adresses liées soit à l'User, soit à la Session
        const addresses = await prisma.address.findMany({
            where: {
                OR: [
                    { userId: userId ? userId : -1 }, // -1 pour ignorer si null
                    { sessionId: sessionId ? sessionId : undefined }
                ]
            }
        });

        res.status(200).json(addresses);
    } catch (error) {
        console.error("🚨 ERREUR RECUPERATION ADRESSES :", error);
        res.status(500).json({ message: "Erreur lors de la récupération des adresses." });
    }
};