const express = require('express');
const router = express.Router();
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/auth');

// GET /api/projects - Public
router.get('/', async (req, res) => {
  try {
    const projects = await dbStore.getProjects();
    res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve projects' });
  }
});

// GET /api/projects/:id - Public
router.get('/:id', async (req, res) => {
  try {
    const project = await dbStore.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve project' });
  }
});

// POST /api/projects - Protected (Ritik only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, deployedUrl, githubUrl, tags, category, featured, order } = req.body;

    if (!title || !description || !deployedUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and deployed URL are required'
      });
    }

    const created = await dbStore.createProject({
      title,
      description,
      deployedUrl,
      githubUrl,
      tags,
      category,
      featured,
      order
    });

    res.status(201).json({
      success: true,
      message: 'Project added successfully!',
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create project: ' + err.message });
  }
});

// PUT /api/projects/:id - Protected (Ritik only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await dbStore.updateProject(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({
      success: true,
      message: 'Project updated successfully!',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Protected (Ritik only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await dbStore.deleteProject(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Project not found or already deleted' });
    }
    res.json({
      success: true,
      message: 'Project deleted successfully!'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
});

module.exports = router;
