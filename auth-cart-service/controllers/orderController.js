const prisma = require('../config/prisma');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sendOrderConfirmation } = require('../utils/emailService');

// --- 1. CRÉATION DE LA COMMANDE (EN ATTENTE) ---
exports.checkout = async (req, res) => {
    try {
        // On récupère soit l'ID de l'user (si connecté), soit le Session ID (si invité)
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id'];
        
        // <-- AJOUT : On récupère "email" en plus de "addressId" depuis le Body
        const { addressId, email } = req.body; 

        if (!userId && !sessionId) {
            return res.status(400).json({ message: "Identification manquante (Token ou Session ID)." });
        }

        if (!addressId) {
            return res.status(400).json({ message: "Une adresse de livraison est requise." });
        }

        // <-- AJOUT : Si c'est un invité (!userId), on le force à fournir un e-mail
        if (!userId && !email) {
            return res.status(400).json({ message: "Une adresse e-mail est requise pour les commandes invitées." });
        }

        // 1. Récupérer le panier (selon si c'est un user ou un invité)
        const cart = await prisma.cart.findUnique({
            where: userId ? { userId: userId } : { sessionId: sessionId },
            include: { items: true }
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: "Votre panier est vide." });
        }

        // 2. Calculer le total
        let totalAmount = 0;
        const orderItemsData = cart.items.map(item => {
            const unitPrice = 99; // Simulation de prix
            totalAmount += unitPrice * item.quantity;
            return {
                productId: item.productId,
                name: `Produit n°${item.productId}`,
                price: unitPrice,
                quantity: item.quantity
            };
        });

        // 3. Créer la commande en "PENDING"
        const newOrder = await prisma.order.create({
            data: {
                userId: userId || undefined, // undefined si null pour que Prisma l'ignore
                
                // <-- AJOUT : On enregistre l'e-mail SEULEMENT si c'est un invité
                guestEmail: !userId ? email : undefined, 
                
                sessionId: !userId ? sessionId : null,
                addressId: parseInt(addressId),
                totalAmount: totalAmount,
                status: "PENDING", 
                items: {
                    create: orderItemsData
                }
            },
            include: { items: true }
        });

        res.status(201).json({
            message: "Commande créée (mode " + (userId ? "Client" : "Invité") + "). En attente de paiement.",
            order: newOrder
        });

    } catch (error) {
        console.error("🚨 ERREUR CHECKOUT :", error);
        res.status(500).json({ message: "Erreur lors de la création de la commande." });
    }
};
// --- 2. PAIEMENT RÉEL VIA STRIPE ET VALIDATION ---
// --- 2. PAIEMENT RÉEL VIA STRIPE ET VALIDATION ---
exports.confirmPayment = async (req, res) => {
    try {
        const { orderId, paymentMethodId } = req.body;
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id'];

        // 1. Trouver la commande AVEC ses items ET son utilisateur (pour l'e-mail)
        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId) },
            include: { 
                items: true, // <-- Pour que l'e-mail puisse lister les produits
                user: true   // <-- Pour récupérer l'e-mail si c'est un client connecté
            }
        });

        if (!order) {
            return res.status(404).json({ message: "Commande introuvable." });
        }

        // 2. Vérification de sécurité : Est-ce bien la commande de cet user ou de cet invité ?
        const isOwner = userId ? (order.userId === userId) : (order.sessionId === sessionId);
        if (!isOwner) {
            return res.status(403).json({ message: "Vous n'avez pas l'autorisation de payer cette commande." });
        }

        // 3. Appel à Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.totalAmount * 100), 
            currency: 'eur',
            payment_method: paymentMethodId,
            confirm: true,
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' }
        });

        if (paymentIntent.status === 'succeeded') {
            // PAIEMENT OK : On valide et on vide le panier correspondant
            await prisma.$transaction([
                prisma.order.update({
                    where: { id: order.id },
                    data: { status: "PAID" }
                }),
                prisma.cartItem.deleteMany({
                    where: { 
                        cart: userId ? { userId: userId } : { sessionId: sessionId } 
                    }
                })
            ]);

            // --- ENVOI DE L'E-MAIL ---
            // On cherche l'e-mail : Soit dans le profil User, soit dans guestEmail
            const targetEmail = userId ? order.user.email : order.guestEmail;

            if (targetEmail) {
                // On importe le service d'e-mail ici (ou tout en haut du fichier)
                const { sendOrderConfirmation } = require('../utils/emailService');
                sendOrderConfirmation(targetEmail, order);
            }

            // Une seule réponse de succès envoyée au client
            return res.status(200).json({ 
                message: "Paiement réussi ! Panier vidé et e-mail de confirmation envoyé.",
                transactionId: paymentIntent.id 
            });
            
        } else {
            return res.status(400).json({ message: "Le paiement a été refusé par Stripe." });
        }

    } catch (error) {
        console.error("🚨 ERREUR STRIPE :", error.message);
        res.status(500).json({ message: "Erreur lors du traitement bancaire." });
    }
};