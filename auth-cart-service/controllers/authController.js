const prisma = require('../config/prisma'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- 1. L'INSCRIPTION ---
exports.register = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) return res.status(400).json({ message: "Tous les champs sont obligatoires." });

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({ message: "Le format de l'adresse e-mail est invalide." });

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial." });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ message: "Cet email est déjà utilisé." });

        const passwordHash = await bcrypt.hash(password, 10);

        // Création de l'utilisateur (isEmailConfirmed est false par défaut)
        const newUser = await prisma.user.create({
            data: { fullName, email, passwordHash }
        });

        // CRÉATION DU LIEN DE CONFIRMATION (Valide 24h)
        const validationToken = jwt.sign(
            { userId: newUser.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        const confirmationLink = `http://localhost:3000/api/auth/verify-email/${validationToken}`;

        // SIMULATION D'ENVOI D'E-MAIL (Pour éviter le pare-feu Worldline)
        console.log("\n=========================================");
        console.log("📧 NOUVEL E-MAIL À ENVOYER À :", newUser.email);
        console.log("Cliquez sur ce lien pour valider votre compte :");
        console.log(confirmationLink);
        console.log("=========================================\n");

        res.status(201).json({
            message: "Inscription réussie ! Veuillez vérifier votre boîte e-mail pour confirmer votre compte.",
        });

    } catch (error) {
        console.error("🚨 ERREUR INSCRIPTION :", error);
        res.status(500).json({ message: "Erreur serveur lors de l'inscription." });
    }
};

// --- 2. LA VALIDATION DU LIEN ---
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        // Décrypter le token pour retrouver l'ID de l'utilisateur
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Mettre à jour l'utilisateur en base de données
        await prisma.user.update({
            where: { id: decoded.userId },
            data: { isEmailConfirmed: true }
        });

        res.status(200).send("<h1>✅ Compte activé avec succès !</h1><p>Vous pouvez maintenant vous connecter à Althea Systems.</p>");

    } catch (error) {
        console.error("🚨 ERREUR VALIDATION EMAIL :", error);
        res.status(400).send("<h1>❌ Le lien est invalide ou a expiré.</h1>");
    }
};

// --- 3. LA CONNEXION (Mise à jour) ---
// --- 3. LA CONNEXION (Version finale avec "Se souvenir de moi") ---
exports.login = async (req, res) => {
    try {
        // On récupère email, password et l'option rememberMe envoyée par le front-end 
        const { email, password, rememberMe } = req.body;

        // 1. Vérification de la présence des champs obligatoires
        if (!email || !password) {
            return res.status(400).json({ message: "Email et mot de passe requis." });
        }

        // 2. Recherche de l'utilisateur dans la base de données
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Identifiants incorrects." });
        }

        // 3. Comparaison sécurisée du mot de passe avec Bcrypt
   // 3. Comparaison sécurisée du mot de passe avec Bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                message: "Mot de passe incorrect.",
                suggestion: "Avez-vous oublié votre mot de passe ?",
                resetLink: "http://localhost:3000/api/auth/forgot-password" 
            });
        }

        // 4. Vérification de la confirmation du compte (Section XI du cahier des charges) 
        if (!user.isEmailConfirmed) {
            return res.status(403).json({ 
                message: "Compte non confirmé. Vérifiez vos e-mails pour valider votre compte ou contactez le support client à support@althea.com." 
            });
        }

        // 5. Gestion de la durée de session "Se souvenir de moi" (Section XI.4) 
        // Si l'utilisateur a coché la case, le token dure 30 jours, sinon 24 heures.
        const tokenExpiration = rememberMe ? '30d' : '24h';

        // 6. Génération du Token JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: tokenExpiration }
        );

        // 7. Envoi de la réponse de succès
        res.status(200).json({
            message: "Connexion réussie !",
            token: token,
            user: { 
                id: user.id, 
                fullName: user.fullName, 
                email: user.email 
            }
        });

    } catch (error) {
        console.error("🚨 ERREUR LOGIN :", error);
        res.status(500).json({ message: "Erreur serveur lors de la connexion." });
    }
};
// --- 4. MOT DE PASSE OUBLIÉ ---
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email requis." });

        const user = await prisma.user.findUnique({ where: { email } });

        // RÈGLE DE SÉCURITÉ : On ne dit pas explicitement si l'email existe ou pas 
        // pour éviter le "User Enumeration", mais on suit le cahier des charges.
        if (!user) {
            return res.status(404).json({ 
                message: "Ce compte n'existe pas. Veuillez vous inscrire ou contacter le support client à support@althea.com." 
            });
        }

        // Génération du Token de réinitialisation (valide 1h pour plus de sécurité)
        const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const resetLink = `http://localhost:3000/api/auth/reset-password/${resetToken}`;

        // Simulation d'envoi d'e-mail
        console.log("\n=========================================");
        console.log("📧 RÉINITIALISATION DE MOT DE PASSE POUR :", email);
        console.log("Lien de réinitialisation :", resetLink);
        console.log("=========================================\n");

        res.status(200).json({ message: "Un lien de réinitialisation a été envoyé à votre adresse e-mail." });

    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la demande de réinitialisation." });
    }
};