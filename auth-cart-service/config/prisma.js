const { PrismaClient } = require('@prisma/client');

// Connexion standard à ton PostgreSQL local
const prisma = new PrismaClient();

module.exports = prisma;