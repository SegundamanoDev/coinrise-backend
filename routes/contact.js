// backend/routes/contactRoutes.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
require("dotenv").config(); // Load environment variables directly in this file

// Create a Nodemailer transporter. This configuration is now directly in the route file.
const transporter = nodemailer.createTransport({
  service: process.env.NODEMAILER_SERVICE,
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
});

router.post("/send-message", async (req, res) => {
  console.log(req.body);
  // Destructure the data sent from the frontend form
  const { name, email, subject, message } = req.body;

  // Basic validation of incoming data
  if (!name || !email || !subject || !message) {
    return res
      .status(400)
      .json({ message: "Please provide name, email, subject, and message." });
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res
      .status(400)
      .json({ message: "Please enter a valid email address." });
  }

  try {
    // Define the email content
    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: process.env.NODEMAILER_USER,
      subject: `New Contact Form Submission: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #0056b3;">Contact Form Message</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background-color: #f9f9f9;">
            <p>${message}</p>
          </div>
          <p style="font-size: 0.9em; color: #777; margin-top: 20px;">
            This email was sent from your website's contact form.
          </p>
        </div>
      `,
    };

    // Send the email using the configured transporter
    await transporter.sendMail(mailOptions);
    res
      .status(200)
      .json({ message: "Your message has been sent successfully!" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to send message. Please try again later." });
  }
});

module.exports = router;
