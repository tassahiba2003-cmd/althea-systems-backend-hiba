const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: "smtp.mailtrap.io",
    port: 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000, // 10 secondes max pour se connecter
    greetingTimeout: 5000,
    socketTimeout: 15000
});

exports.sendConfirmationEmail = async (email, token) => {
    const confirmationUrl = `http://localhost:3000/api/auth/verify-email/${token}`;

    console.log("📨 Tentative de connexion au serveur SMTP Mailtrap...");

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Bienvenue chez Althea Systems - Confirmez votre compte',
        html: `<h2>Bienvenue !</h2><p>Cliquez ici : <a href="${confirmationUrl}">${confirmationUrl}</a></p>`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ E-mail envoyé avec succès ! ID:", info.messageId);
        return info;
    } catch (error) {
        console.error("❌ ÉCHEC DE L'ENVOI DE L'EMAIL :", error.message);
        // On ne bloque pas tout le processus si le mail échoue
        throw error; 
    }
};