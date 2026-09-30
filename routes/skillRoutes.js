const express = require('express');
const router = express.Router();
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/auth');

// GET /api/skills - Public
router.get('/', async (req, res) => {
  try {
    const skills = await dbStore.getSkills();
    res.json({
      success: true,
      count: skills.length,
      data: skills
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve skills' });
  }
});

// POST /api/skills - Protected (Ritik only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, category, icon, proficiency, featured, order } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Skill name is required'
      });
    }

    const created = await dbStore.createSkill({
      name,
      category,
      icon,
      proficiency,
      featured,
      order
    });

    res.status(201).json({
      success: true,
      message: 'Skill added successfully!',
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create skill: ' + err.message });
  }
});

// PUT /api/skills/:id - Protected (Ritik only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await dbStore.updateSkill(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }
    res.json({
      success: true,
      message: 'Skill updated successfully!',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update skill' });
  }
});

// DELETE /api/skills/:id - Protected (Ritik only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await dbStore.deleteSkill(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Skill not found or already deleted' });
    }
    res.json({
      success: true,
      message: 'Skill deleted successfully!'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete skill' });
  }
});

module.exports = router;
