const prisma = require('../config/prisma'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const emailService = require('../utils/emailService'); // ✅ Import du service d'e-mail

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

        // CRÉATION DU TOKEN DE CONFIRMATION (Valide 24h)
        const validationToken = jwt.sign(
            { userId: newUser.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        // ✅ ENVOI RÉEL DE L'E-MAIL VIA MAILTRAP
        await emailService.sendConfirmationEmail(newUser.email, validationToken);

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

// --- 3. LA CONNEXION (Version finale avec fusion Guest-to-User) ---
exports.login = async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        const sessionId = req.headers['x-session-id'];

        if (!email || !password) {
            return res.status(400).json({ message: "Email et mot de passe requis." });
        }

        const emailClean = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({ where: { email: emailClean } });
        if (!user) {
            return res.status(401).json({ message: "Identifiants incorrects." });
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                message: "Mot de passe incorrect.",
                suggestion: "Avez-vous oublié votre mot de passe ?",
                resetLink: "http://localhost:3000/api/auth/forgot-password" 
            });
        }

        if (!user.isEmailConfirmed) {
            return res.status(403).json({ 
                message: "Compte non confirmé. Vérifiez vos e-mails." 
            });
        }

        // LOGIQUE DE FUSION (GUEST -> USER)
        if (sessionId && sessionId !== "undefined" && sessionId !== "null") {
            try {
                await prisma.$transaction(async (tx) => {
                    await tx.address.updateMany({
                        where: { sessionId: sessionId },
                        data: { userId: user.id, sessionId: null }
                    });

                    await tx.order.updateMany({
                        where: { sessionId: sessionId },
                        data: { userId: user.id, sessionId: null }
                    });

                    const guestCart = await tx.cart.findUnique({
                        where: { sessionId: sessionId },
                        include: { items: true }
                    });

                    if (guestCart && guestCart.items.length > 0) {
                        let userCart = await tx.cart.findUnique({
                            where: { userId: user.id },
                            include: { items: true }
                        });

                        if (!userCart) {
                            await tx.cart.update({
                                where: { id: guestCart.id },
                                data: { userId: user.id, sessionId: null }
                            });
                        } else {
                            for (const guestItem of guestCart.items) {
                                const existingItem = userCart.items.find(i => i.productId === guestItem.productId);
                                if (existingItem) {
                                    await tx.cartItem.update({
                                        where: { id: existingItem.id },
                                        data: { quantity: existingItem.quantity + guestItem.quantity }
                                    });
                                    await tx.cartItem.delete({ where: { id: guestItem.id } });
                                } else {
                                    await tx.cartItem.update({
                                        where: { id: guestItem.id },
                                        data: { cartId: userCart.id }
                                    });
                                }
                            }
                            await tx.cart.delete({ where: { id: guestCart.id } });
                        }
                    }
                });
                console.log(`✅ Fusion réussie pour l'utilisateur ${user.id}`);
            } catch (mergeError) {
                console.error("⚠️ Erreur lors de la fusion :", mergeError);
            }
        }

        const tokenExpiration = rememberMe ? '30d' : '24h';
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: tokenExpiration }
        );

        res.status(200).json({
            message: "Connexion réussie !",
            token: token,
            user: { id: user.id, fullName: user.fullName, email: user.email }
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

        if (!user) {
            return res.status(404).json({ 
                message: "Ce compte n'existe pas. Veuillez vous inscrire." 
            });
        }

        const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // ✅ ENVOI RÉEL DU MAIL DE RÉINITIALISATION
        await emailService.sendPasswordResetEmail(user.email, resetToken);

        res.status(200).json({ message: "Un lien de réinitialisation a été envoyé à votre adresse e-mail." });

    } catch (error) {
        console.error("🚨 ERREUR FORGOT PASSWORD :", error);
        res.status(500).json({ message: "Erreur lors de la demande." });
    }
};


// --- 5. RÉINITIALISATION RÉELLE DU MOT DE PASSE ---
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) return res.status(400).json({ message: "Le mot de passe est obligatoire." });

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ message: "Format de mot de passe invalide." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await prisma.user.update({
            where: { id: decoded.userId },
            data: { passwordHash: passwordHash }
        });

        res.status(200).json({ message: "Mot de passe modifié avec succès." });

    } catch (error) {
        res.status(401).json({ message: "Lien invalide ou expiré." });
    }
};


// --- 6. RENVOYER LE LIEN DE CONFIRMATION ---
exports.resendConfirmation = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "E-mail requis." });

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

        if (!user) return res.status(404).json({ message: "Compte introuvable." });
        if (user.isEmailConfirmed) return res.status(400).json({ message: "Compte déjà confirmé." });

        const validationToken = jwt.sign(
            { userId: user.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        // ✅ RENVOI RÉEL DU MAIL
        await emailService.sendConfirmationEmail(user.email, validationToken);

        res.status(200).json({ message: "Nouveau lien envoyé." });

    } catch (error) {
        res.status(500).json({ message: "Erreur lors du renvoi." });
    }
};