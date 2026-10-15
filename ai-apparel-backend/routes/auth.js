const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // <-- NEW IMPORT
const User = require('../models/User');

const router = express.Router();

// Setup the email engine using your Google App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 1. REGISTER A NEW USER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Encrypt the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save the new user to the database
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    // --- NEW: SEND WELCOME EMAIL ---
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email, // Sends to the person who just registered
      subject: 'Welcome to AI Apparel! 🎨',
      text: `Hi ${name},\n\nYour account has been created successfully! Get ready to design some amazing custom AI shirts.\n\nBest,\nThe AI Apparel Team`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("❌ Email error: ", error);
      } else {
        console.log("✅ Email sent: " + info.response);
      }
    });
    // -------------------------------

    res.status(201).json({ message: 'User created successfully and email sent!' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// 2. LOGIN AN EXISTING USER
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;