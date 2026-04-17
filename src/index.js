require('dotenv').config();
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

const { getStaffMember } = require('./services/firebase');
const { sendWhatsAppMessage, sendWhatsAppDocument } = require('./services/twilio');
const { startAlertScheduler } = require('./services/scheduler');
const { parseCommand } = require('./utils/parser');

// Handlers
const { handleBook, handleEdit, handleCancel } = require('./handlers/booking');
const { handleStatus, handleAvailable } = require('./handlers/status');
const { handleCheckout, handleConfirm } = require('./handlers/checkout');
const { handleIdUpload } = require('./handlers/idUpload');
const { handleReportToday, handleReportMonth, handleReportExcel, handlePending } = require('./handlers/reports');
const { handleHelp } = require('./handlers/help');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ── Health check ──
app.get('/', (req, res) => {
  res.json({ status: 'SpectatorBot is running 🏨', timestamp: new Date().toISOString() });
});

// ── Twilio WhatsApp Webhook ──
app.post('/webhook', async (req, res) => {
  const twiml = new MessagingResponse();

  try {
    const body = req.body.Body || '';
    const from = req.body.From || '';       // "whatsapp:+91XXXXXXXXXX"
    const numMedia = parseInt(req.body.NumMedia || '0', 10);
    const mediaUrl = numMedia > 0 ? req.body.MediaUrl0 : null;
    const mediaContentType = numMedia > 0 ? req.body.MediaContentType0 : null;

    console.log(`📩 Message from ${from}: ${body}`);

    // ── Staff Authentication ──
    const staff = await getStaffMember(from);
    if (!staff) {
      twiml.message('❌ Unauthorized. Contact the hotel owner to get access.');
      return res.type('text/xml').send(twiml.toString());
    }

    // ── Parse Command ──
    const parsed = parseCommand(body);
    if (!parsed) {
      twiml.message('❓ Unknown command. Type /help to see all available commands.');
      return res.type('text/xml').send(twiml.toString());
    }

    const { command, args } = parsed;
    let reply = '';

    // ── Route to Handlers ──
    switch (command) {
      case 'book':
        reply = await handleBook(args, staff);
        break;

      case 'edit':
        reply = await handleEdit(args);
        break;

      case 'cancel':
        // Handle "/cancel checkout" as special case
        if (args[0]?.toLowerCase() === 'checkout') {
          reply = '✅ Checkout cancelled. No changes made.';
        } else {
          reply = await handleCancel(args);
        }
        break;

      case 'status':
        reply = await handleStatus(args);
        break;

      case 'available':
        reply = await handleAvailable(args);
        break;

      case 'checkout':
        reply = await handleCheckout(args, staff);
        break;

      case 'confirm':
        reply = await handleConfirm(args, staff);
        break;

      case 'id':
        reply = await handleIdUpload(args, mediaUrl, mediaContentType);
        break;

      case 'report': {
        const subCmd = args[0]?.toLowerCase();
        if (subCmd === 'today') {
          reply = await handleReportToday();
        } else if (subCmd === 'month') {
          reply = await handleReportMonth();
        } else if (subCmd === 'excel') {
          const result = await handleReportExcel();
          reply = result.message;
          // If file was generated, send it as a document
          if (result.filePath) {
            try {
              // Upload to Firebase Storage for public URL
              const { bucket } = require('./services/firebase');
              const storagePath = `reports/${result.fileName}`;
              await bucket.upload(result.filePath, { destination: storagePath });
              const file = bucket.file(storagePath);
              await file.makePublic();
              const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

              // Send via Twilio with media
              const twilio = require('twilio');
              const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
              await twilioClient.messages.create({
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: from,
                body: `📊 ${result.fileName}`,
                mediaUrl: [publicUrl],
              });
            } catch (uploadErr) {
              console.error('Excel upload/send error:', uploadErr.message);
              reply += '\n⚠️ File generated but could not be sent. Check server logs.';
            }
          }
        } else {
          reply = '❌ Format: /report today | month | excel';
        }
        break;
      }

      case 'pending':
        reply = await handlePending();
        break;

      case 'help':
        reply = handleHelp();
        break;

      default:
        reply = '❓ Unknown command. Type /help to see all available commands.';
    }

    twiml.message(reply);
  } catch (err) {
    console.error('❌ Webhook error:', err);
    twiml.message('❌ Something went wrong. Please try again or contact support.');
  }

  res.type('text/xml').send(twiml.toString());
});

// ── Start Server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🏨 SpectatorBot is live on port ${PORT}`);
  console.log(`📡 Webhook URL: https://your-domain.com/webhook\n`);

  // Start daily alert scheduler
  startAlertScheduler(sendWhatsAppMessage);
});
