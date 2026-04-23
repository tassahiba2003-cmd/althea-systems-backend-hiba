const nodemailer = require('nodemailer');

const sendOrderConfirmation = async (userEmail, order) => {
    // 1. Configuration du transporteur (ex: Gmail, Mailtrap, etc.)
    // Pour tes tests, je te conseille "Mailtrap" (c'est gratuit et ça simule une boîte mail)
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // 2. Préparation du contenu de l'e-mail
    const mailOptions = {
        from: '"Althea Systems" <noreply@althea.com>',
        to: userEmail,
        subject: `Confirmation de votre commande #${order.id}`,
        html: `
            <h1>Merci pour votre achat !</h1>
            <p>Votre commande <strong>#${order.id}</strong> a été validée avec succès.</p>
            <p><strong>Montant total :</strong> ${order.totalAmount} €</p>
            <hr>
            <h3>Détails de la commande :</h3>
            <ul>
                ${order.items.map(item => `<li>${item.name} (x${item.quantity}) - ${item.price} €</li>`).join('')}
            </ul>
            <p>Elle sera expédiée très prochainement.</p>
        `,
    };

    // 3. Envoi
    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ E-mail de confirmation envoyé à :", userEmail);
    } catch (error) {
        console.error("❌ Erreur envoi e-mail :", error);
    }
};

module.exports = { sendOrderConfirmation };