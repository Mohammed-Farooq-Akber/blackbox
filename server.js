const express = require('express');
const multer = require('multer');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer uploads
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ✅ FIXED: createTransport (NOT createTransporter)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Test transporter on startup
transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email setup failed:', error.message);
    } else {
        console.log('✅ Email ready!');
    }
});

// Form endpoint
app.post('/api/intake', upload.single('file'), async (req, res) => {
    try {
        const { name, email, phone, service, message } = req.body;
        
        // Admin email (YOU receive)
        const adminEmail = {
            from: `"ProDocs" <${process.env.EMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL,
            replyTo: email,
            subject: `🆕 New ${service} Request - ${name}`,
            html: `
                <h2>📥 New Client Request</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Service:</strong> ${service}</p>
                ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
            `
        };

        // Client confirmation
        const clientEmail = {
            from: `"ProDocs" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '✅ ProDocs Quote Request Received',
            html: `
                <h2>Thank You ${name}!</h2>
                <p>Your ${service} request received.</p>
                <p>Response within 24 hours.</p>
            `
        };

        await Promise.all([
            transporter.sendMail(adminEmail),
            transporter.sendMail(clientEmail)
        ]);

        console.log(`✅ SENT: ${name} → ${service}`);
        res.json({ success: true, message: '✅ Emails sent!' });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/health', (req, res) => res.json({ status: 'OK', email: 'ready' }));

app.listen(PORT, () => {
    console.log(`🚀 http://localhost:${PORT}`);
});
