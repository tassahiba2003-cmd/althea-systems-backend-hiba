const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- 1. MODIFIER LE PROFIL (Section XII.1 du CDC) ---
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId; // Récupéré par le middleware d'authentification
        const { fullName, email, currentPassword, newPassword } = req.body;

        // On récupère l'utilisateur actuel
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });

        let updatedData = {};

        // A. Changement de nom
        if (fullName) updatedData.fullName = fullName;

        // B. Changement d'e-mail (avec nouvelle confirmation)
        if (email && email !== user.email) {
            const emailExists = await prisma.user.findUnique({ where: { email } });
            if (emailExists) return res.status(400).json({ message: "Cet e-mail est déjà utilisé." });
            
            updatedData.email = email;
            updatedData.isEmailConfirmed = false; // On invalide la confirmation

            // Simulation d'envoi d'e-mail de re-confirmation
            console.log(`📧 E-mail de confirmation envoyé à : ${email}`);
        }

        // C. Changement de mot de passe (Sécurité : Ancien MDP requis)
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: "L'ancien mot de passe est requis pour en créer un nouveau." });
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isPasswordValid) {
                return res.status(401).json({ message: "Ancien mot de passe incorrect." });
            }

            // Validation force du MDP (Section XI.1)
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(newPassword)) {
                return res.status(400).json({ message: "Le nouveau mot de passe ne respecte pas les critères de sécurité." });
            }

            updatedData.passwordHash = await bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(updatedData).length === 0) {
            return res.status(400).json({ message: "Aucune modification fournie." });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updatedData,
            select: { id: true, fullName: true, email: true, isEmailConfirmed: true }
        });

        res.status(200).json({ message: "Profil mis à jour !", user: updatedUser });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la mise à jour." });
    }
};

// --- 2. AJOUTER UNE ADRESSE (Section XII.2 du CDC) ---
exports.addAddress = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { firstName, lastName, address1, city, zipCode, country } = req.body;

        if (!firstName || !lastName || !address1 || !city || !zipCode || !country) {
            return res.status(400).json({ message: "Champs obligatoires manquants." });
        }

        const newAddress = await prisma.address.create({
            data: {
                firstName, lastName, address1, city, zipCode, country,
                userId: userId
            }
        });

        res.status(201).json({ message: "Adresse ajoutée !", address: newAddress });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'ajout de l'adresse." });
    }
};