// LIGNE 1 OBLIGATOIRE : Charge le .env avant de faire quoi que ce soit d'autre
require('dotenv').config();
const userRoutes = require('./routes/userRoutes.js');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json()); 

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.listen(3000, () => {
    console.log(`✅ Serveur démarré sur le port 3000`);
});