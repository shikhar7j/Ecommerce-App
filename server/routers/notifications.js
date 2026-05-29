const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const Notification = require("../models/notification");

// Setup transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});


// ✅ SEND EMAIL ONLY
router.post("/email", async (req, res) => {
  try {
    const { email, subject, htmlContent, textContent } = req.body;

    const info = await transporter.sendMail({
      from: `"OOPS Delivery" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    res.json({
      success: true,
      message: "✅ Email sent successfully",
      messageId: info.messageId
    });

  } catch (error) {
    console.error("❌ Email error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ✅ MAIN: SEND + SAVE TO DB
router.post("/send", async (req, res) => {
  try {
    const {
      customerId,
      customerEmail,
      trackingNumber,
      estimatedTime,
      message
    } = req.body;

    console.log("📧 Sending email to:", customerEmail);

    // 1. SEND REAL EMAIL
    await transporter.sendMail({
      from: `"OOPS Delivery" <${process.env.SMTP_EMAIL}>`,
      to: customerEmail,
      subject: "📦 Your order has been shipped!",
      html: `
        <h2>🚚 Order Update</h2>
        <p>${message}</p>
        <p><b>Tracking Number:</b> ${trackingNumber}</p>
        <p><b>Estimated Delivery:</b> ${estimatedTime?.minutes || "soon"} minutes</p>
        <br/>
        <p>Thank you for shopping with us.</p>
      `
    });

    // 2. SAVE NOTIFICATION TO DATABASE
    await Notification.create({
      userId: customerId,
      title: "📦 Order Shipped",
      message: `Tracking Number: ${trackingNumber}`,
      type: "order",
      read: false,
    });

    res.json({
      success: true,
      message: "✅ Email sent + Notification saved to DB"
    });

  } catch (error) {
    console.error("❌ Notification error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/:id/read", async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ DELETE SINGLE NOTIFICATION
router.delete("/:id", async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ MARK ALL AS READ
router.put("/user/:id/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.params.id },
      { $set: { read: true } }
    );

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/user/:id", async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.params.id });

    res.json({
      success: true,
      message: "✅ All notifications deleted"
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ FETCH USER NOTIFICATIONS (for Notifications page)
router.get("/user/:id", async (req, res) => {
  try {
    const notifications = await Notification
      .find({ userId: req.params.id })
      .sort({ createdAt: -1 });

    res.json(notifications);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
