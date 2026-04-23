const prisma = require('../config/prisma');

// --- SIMULATION DU CATALOGUE (Mock) ---
const getFakeProduct = (id) => {
    const products = {
        "1": { name: "iPhone 15", price: 999, stock: 10 },
        "2": { name: "MacBook Air", price: 1200, stock: 5 },
        "3": { name: "AirPods Pro", price: 250, stock: 50 }
    };
    return products[id] || { name: `Produit n°${id}`, price: 49.99, stock: 100 };
};

// --- FONCTION UTILITAIRE : Trouver le panier (Connecté ou Invité) ---
// Cette fonction nous évite de répéter le même code partout
const findCart = async (userId, sessionId) => {
    if (userId) {
        return await prisma.cart.findUnique({ where: { userId: userId }, include: { items: true } });
    } else if (sessionId) {
        return await prisma.cart.findUnique({ where: { sessionId: sessionId }, include: { items: true } });
    }
    return null;
};

// --- 1. AFFICHER LE PANIER ---
exports.getCart = async (req, res) => {
    try {
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id']; // Récupération depuis le Header

        if (!userId && !sessionId) {
            return res.status(400).json({ message: "Non identifié. Connectez-vous ou fournissez un Session ID." });
        }

        const cart = await findCart(userId, sessionId);

        if (!cart || cart.items.length === 0) {
            return res.status(200).json({ items: [], cartTotal: 0 });
        }

        const itemsWithDetails = cart.items.map((item) => {
            const productData = getFakeProduct(item.productId.toString());
            const unitPrice = productData.price;
            const totalPrice = unitPrice * item.quantity;

            return {
                productId: item.productId,
                name: productData.name,
                quantity: item.quantity,
                unitPrice: unitPrice,
                totalPrice: totalPrice,
                availableStock: productData.stock 
            };
        });

        const cartTotal = itemsWithDetails.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

        res.status(200).json({
            cartId: cart.id,
            items: itemsWithDetails,
            cartTotal: cartTotal
        });

    } catch (error) {
        console.error("🚨 ERREUR RECUPERATION PANIER :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération du panier." });
    }
};




// --- 4. AJOUTER UN PRODUIT AU PANIER (Création du panier si besoin) ---
exports.addItem = async (req, res) => {
    try {
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id'];
        const { productId, quantity } = req.body;

        if (!userId && !sessionId) {
            return res.status(400).json({ message: "Non identifié. Connectez-vous ou fournissez un Session ID." });
        }

        // 1. On cherche le panier de cet invité ou utilisateur
        let cart = await findCart(userId, sessionId);

        // 2. MAGIE : Si le panier n'existe pas, ON LE CRÉE !
        if (!cart) {
            cart = await prisma.cart.create({
                data: {
                    userId: userId ? userId : undefined,
                    sessionId: !userId ? sessionId : undefined
                }
            });
        }

        // 3. Vérification du stock avec notre Mock
        const productData = getFakeProduct(productId.toString());
        if (productData.stock < quantity) {
            return res.status(400).json({ message: "Stock insuffisant." });
        }

        // 4. Vérifier si l'article est déjà dans le panier
        const existingItem = await prisma.cartItem.findFirst({
            where: { cartId: cart.id, productId: parseInt(productId) }
        });

        if (existingItem) {
            // S'il y est déjà, on additionne la quantité
            await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: existingItem.quantity + quantity }
            });
        } else {
            // Sinon, on crée la nouvelle ligne d'article
            await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId: parseInt(productId),
                    quantity: quantity
                }
            });
        }

        res.status(201).json({ message: "Article ajouté avec succès !" });

    } catch (error) {
        console.error("🚨 ERREUR AJOUT ARTICLE :", error);
        res.status(500).json({ message: "Erreur lors de l'ajout au panier." });
    }
};




// --- 2. MODIFIER LA QUANTITÉ ---
exports.updateQuantity = async (req, res) => {
    try {
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id'];
        
        const { productId } = req.params;
        const { quantity } = req.body;

        if (!userId && !sessionId) {
            return res.status(400).json({ message: "Non identifié. Connectez-vous ou fournissez un Session ID." });
        }

        if (quantity < 1) {
            return res.status(400).json({ message: "La quantité doit être au minimum de 1." });
        }

        const cart = await findCart(userId, sessionId);
        if (!cart) return res.status(404).json({ message: "Panier introuvable." });

        const productData = getFakeProduct(productId.toString());
        if (productData.stock < quantity) {
            return res.status(400).json({ message: `Stock insuffisant. Il ne reste que ${productData.stock} article(s).` });
        }

        await prisma.cartItem.update({
            where: {
                cartId_productId: { cartId: cart.id, productId: parseInt(productId) }
            },
            data: { quantity: quantity }
        });

        res.status(200).json({ message: "Quantité mise à jour avec succès." });

    } catch (error) {
        console.error("🚨 ERREUR MISE À JOUR QUANTITÉ :", error);
        res.status(500).json({ message: "Erreur lors de la mise à jour de la quantité." });
    }
};

// --- 3. SUPPRIMER UN PRODUIT ---
exports.removeItem = async (req, res) => {
    try {
        const userId = req.user ? req.user.userId : null;
        const sessionId = req.headers['x-session-id'];
        const { productId } = req.params;

        if (!userId && !sessionId) {
            return res.status(400).json({ message: "Non identifié. Connectez-vous ou fournissez un Session ID." });
        }

        const cart = await findCart(userId, sessionId);
        if (!cart) return res.status(404).json({ message: "Panier introuvable." });

        await prisma.cartItem.delete({
            where: {
                cartId_productId: { cartId: cart.id, productId: parseInt(productId) }
            }
        });

        res.status(200).json({ message: "Produit supprimé du panier." });

    } catch (error) {
        console.error("🚨 ERREUR SUPPRESSION ARTICLE :", error);
        res.status(500).json({ message: "Erreur lors de la suppression de l'article." });
    }
};