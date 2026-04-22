const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        // 1. Récupérer le token dans l'en-tête "Authorization"
        const authHeader = req.headers.authorization;
        
        // Si pas de token, on bloque l'accès (Erreur 401)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: "Accès refusé. Vous devez être connecté." });
        }

        // 2. Extraire le token (on enlève le mot "Bearer ")
        const token = authHeader.split(' ')[1];

        // 3. Vérifier la signature du token avec ta clé secrète
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 4. On stocke les infos de l'utilisateur dans 'req.user' pour les utiliser plus tard
        req.user = decoded;
        
        // 5. On laisse passer la requête vers le contrôleur
        next();
    } catch (error) {
        // Si le token est faux ou expiré (Erreur 403)
        return res.status(403).json({ message: "Session expirée ou token invalide." });
    }
};