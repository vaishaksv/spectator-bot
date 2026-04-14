import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";

const app = express();
app.use(express.json());

// 🔥 Firebase from ENV (IMPORTANT)
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.BUCKET,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// 🔐 CONFIG
const VERIFY_TOKEN = "spectator_verify";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_ID;

// 📩 Send text
async function sendMessage(to, text) {
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    }),
  });
}

// 🔢 Booking ID
async function generateId() {
  const ref = db.collection("meta").doc("config");
  const doc = await ref.get();
  let last = doc.exists ? doc.data().last_booking_id : 0;
  last++;
  await ref.set({ last_booking_id: last }, { merge: true });
  return `SP-${String(last).padStart(4, "0")}`;
}

// 🔐 Verify webhook
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// 🤖 BOT LOGIC
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body;

    // 🔐 Staff check
    const staffDoc = await db.collection("staff").doc(from).get();
    if (!staffDoc.exists) {
      await sendMessage(from, "❌ Unauthorized");
      return res.sendStatus(200);
    }

    const staff = staffDoc.data();
    const isOwner = staff.role === "owner";

    // =====================
    // 🏨 BOOK
    // =====================
    if (text?.startsWith("/book")) {
      const p = text.split(" ");

      if (p.length < 6) {
        return await sendMessage(from, "❌ Invalid format");
      }

      const room = p[1];
      const guests = Number(p[2]);

      const roomDoc = await db.collection("rooms").doc(room).get();
      const type = roomDoc.data().type;

      if (type === "single" && guests > 1)
        return await sendMessage(from, "❌ Max 1 guest");

      if (type === "double" && guests > 2)
        return await sendMessage(from, "❌ Max 2 guests");

      const active = await db
        .collection("bookings")
        .where("room", "==", room)
        .where("status", "==", "active")
        .get();

      if (!active.empty)
        return await sendMessage(from, "❌ Room already booked");

      const id = await generateId();

      await db.collection("bookings").doc(id).set({
        booking_id: id,
        room,
        guests,
        checkin: p[3],
        checkout: p[4],
        amount: Number(p[5]),
        payment_mode: p[6] || "cash",
        payment_status: p[7] || "paid",
        status: "active",
        created_at: new Date(),
      });

      await db.collection("rooms").doc(room).update({
        room_status: "occupied",
      });

      await sendMessage(
        from,
        `✅ Booking Confirmed
🏨 Room ${room}
📅 ${p[3]} → ${p[4]}
💵 ₹${p[5]}
🔖 ${id}`
      );
    }

    // =====================
    // 🧾 CHECKOUT
    // =====================
    else if (text?.startsWith("/checkout")) {
      const room = text.split(" ")[1];

      const snap = await db
        .collection("bookings")
        .where("room", "==", room)
        .where("status", "==", "active")
        .get();

      if (snap.empty)
        return await sendMessage(from, "❌ No active booking");

      const b = snap.docs[0].data();

      await sendMessage(
        from,
        `🧾 Checkout Bill
🏨 Room ${room}
₹${b.amount}
Type /confirm ${b.booking_id}`
      );
    }

    // =====================
    // ✅ CONFIRM
    // =====================
    else if (text?.startsWith("/confirm")) {
      const id = text.split(" ")[1];

      const ref = db.collection("bookings").doc(id);
      const doc = await ref.get();

      if (!doc.exists)
        return await sendMessage(from, "❌ Not found");

      const room = doc.data().room;

      await ref.update({
        status: "checked_out",
        payment_status: "paid",
      });

      await db.collection("rooms").doc(room).update({
        room_status: "vacant",
      });

      await sendMessage(from, `✅ Checkout done\n🏨 Room ${room} vacant`);
    }

    // =====================
    // 📊 REPORT (OWNER ONLY)
    // =====================
    else if (text?.startsWith("/report")) {
      if (!isOwner)
        return await sendMessage(from, "🔒 Owner only");

      const snap = await db.collection("bookings").get();
      let total = 0;

      snap.forEach((d) => (total += d.data().amount || 0));

      await sendMessage(from, `📊 Revenue ₹${total}`);
    }

    else {
      await sendMessage(from, "❓ Unknown command");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.listen(3000, () =>
  console.log("🚀 SpectatorHotel Bot Running")
);