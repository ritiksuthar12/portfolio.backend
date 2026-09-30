const express = require('express');
const router = express.Router();
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/auth');

// POST /api/contact - Public
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required'
      });
    }

    const created = await dbStore.createMessage({
      name,
      email,
      subject: subject || 'Portfolio Message',
      message
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! Ritik has received your message.',
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send message: ' + err.message });
  }
});

// GET /api/contact - Protected (Ritik only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const messages = await dbStore.getMessages();
    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve messages' });
  }
});

// DELETE /api/contact/:id - Protected (Ritik only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await dbStore.deleteMessage(req.params.id);
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

module.exports = router;
