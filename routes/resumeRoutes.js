const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const dbStore = require('../services/dbStore');
const imageKitService = require('../services/imageKitService');
const authMiddleware = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'resume');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `Ritik_Suthar_Resume_${Date.now()}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter
});

// GET /api/resume - Get resume metadata (Public)
router.get('/', async (req, res) => {
  try {
    const resume = await dbStore.getResume();
    res.json({
      success: true,
      hasResume: !!resume,
      data: resume || null,
      cloudProvider: imageKitService.isConfigured() ? 'imagekit' : 'mongodb_buffer'
    });
  } catch (err) {
    console.error('Error fetching resume metadata:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch resume metadata' });
  }
});

// GET /api/resume/download - Download latest resume file (Public)
router.get('/download', async (req, res) => {
  try {
    const resume = await dbStore.getResume();

    // 1. If ImageKit cloud CDN URL is available, redirect directly to cloud
    if (resume && resume.imageKitUrl) {
      return res.redirect(resume.imageKitUrl);
    }

    // 2. Check custom external URL
    if (resume && resume.customUrl && !resume.filePath && !resume.hasBuffer) {
      return res.redirect(resume.customUrl);
    }

    // 3. Check MongoDB binary buffer (100% persistent on free hosts like Render/Vercel)
    const fileObj = await dbStore.getResumeFile();
    if (fileObj && fileObj.buffer) {
      const downloadName = fileObj.fileName || 'Ritik_Suthar_Resume.pdf';
      res.setHeader('Content-Type', fileObj.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Length', fileObj.buffer.length);
      return res.send(fileObj.buffer);
    }

    // 4. Check local uploaded file if on disk
    if (resume && resume.filePath && fs.existsSync(resume.filePath)) {
      const downloadName = resume.fileName || 'Ritik_Suthar_Resume.pdf';
      return res.download(resume.filePath, downloadName);
    }

    // 5. Fallback: check if client public folder has resume.pdf
    const clientFallbackPath = path.join(__dirname, '..', '..', 'client', 'public', 'resume.pdf');
    if (fs.existsSync(clientFallbackPath)) {
      return res.download(clientFallbackPath, 'Ritik_Suthar_Resume.pdf');
    }

    // 6. Fallback: check any file in uploads/resume
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      if (files.length > 0) {
        const latestFile = path.join(uploadDir, files[files.length - 1]);
        return res.download(latestFile, 'Ritik_Suthar_Resume.pdf');
      }
    }

    return res.status(404).json({
      success: false,
      message: 'Resume has not been uploaded yet. Please check back soon or contact Ritik directly!'
    });
  } catch (err) {
    console.error('Error downloading resume:', err);
    res.status(500).json({ success: false, message: 'Failed to download resume' });
  }
});

// GET /api/resume/view - Preview resume inline in browser (Public)
router.get('/view', async (req, res) => {
  try {
    const resume = await dbStore.getResume();

    // 1. If ImageKit cloud CDN URL is available, redirect to cloud
    if (resume && resume.imageKitUrl) {
      return res.redirect(resume.imageKitUrl);
    }

    if (resume && resume.customUrl && !resume.filePath && !resume.hasBuffer) {
      return res.redirect(resume.customUrl);
    }

    // 2. Stream from MongoDB Atlas buffer
    const fileObj = await dbStore.getResumeFile();
    if (fileObj && fileObj.buffer) {
      res.setHeader('Content-Type', fileObj.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileObj.fileName || 'Ritik_Suthar_Resume.pdf'}"`);
      return res.send(fileObj.buffer);
    }

    let targetPath = null;
    let mimeType = 'application/pdf';

    if (resume && resume.filePath && fs.existsSync(resume.filePath)) {
      targetPath = resume.filePath;
      mimeType = resume.mimeType || 'application/pdf';
    } else {
      const clientFallback = path.join(__dirname, '..', '..', 'client', 'public', 'resume.pdf');
      if (fs.existsSync(clientFallback)) {
        targetPath = clientFallback;
      }
    }

    if (targetPath) {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${resume?.fileName || 'Ritik_Suthar_Resume.pdf'}"`);
      return fs.createReadStream(targetPath).pipe(res);
    }

    return res.status(404).json({
      success: false,
      message: 'No resume available for preview.'
    });
  } catch (err) {
    console.error('Error previewing resume:', err);
    res.status(500).json({ success: false, message: 'Failed to preview resume' });
  }
});

// POST /api/resume/upload - Upload new resume file (Protected)
router.post('/upload', authMiddleware, (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file provided. Please choose a PDF, DOC, or DOCX file.'
      });
    }

    try {
      const file = req.file;
      const fileUrl = `/uploads/resume/${file.filename}`;
      const fileBuffer = fs.readFileSync(file.path);

      // Clean up previous files if any
      let oldImageKitFileId = null;
      try {
        const oldResume = await dbStore.getResume();
        if (oldResume) {
          oldImageKitFileId = oldResume.imageKitFileId;
          if (oldResume.filePath && oldResume.filePath !== file.path && fs.existsSync(oldResume.filePath)) {
            fs.unlinkSync(oldResume.filePath);
          }
        }
      } catch (cleanErr) {
        console.warn('Could not remove previous resume file:', cleanErr.message);
      }

      // 1. Upload to ImageKit Cloud Storage if configured
      let imageKitData = null;
      if (imageKitService.isConfigured()) {
        imageKitData = await imageKitService.uploadResume(fileBuffer, file.originalname);
        // Delete old ImageKit file
        if (oldImageKitFileId) {
          await imageKitService.deleteFile(oldImageKitFileId);
        }
      }

      // Sync copy to client/public/resume.pdf for robust static fallback
      try {
        const clientPublicDir = path.join(__dirname, '..', '..', 'client', 'public');
        if (fs.existsSync(clientPublicDir)) {
          fs.copyFileSync(file.path, path.join(clientPublicDir, 'resume.pdf'));
        }
      } catch (copyErr) {
        console.warn('Could not copy resume to client/public:', copyErr.message);
      }

      // 2. Save directly to MongoDB Atlas with Buffer (permanent on free hosts)
      const updated = await dbStore.saveResume({
        fileName: file.originalname,
        fileUrl: imageKitData ? imageKitData.url : fileUrl,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileData: fileBuffer, // MongoDB Atlas binary buffer
        imageKitUrl: imageKitData ? imageKitData.url : '',
        imageKitFileId: imageKitData ? imageKitData.fileId : '',
        storageType: imageKitData ? 'imagekit' : 'mongodb_buffer',
        customUrl: ''
      });

      res.status(200).json({
        success: true,
        message: imageKitData
          ? 'Resume uploaded to ImageKit Cloud CDN and saved to MongoDB!'
          : 'Resume uploaded and stored permanently in MongoDB Atlas!',
        data: updated
      });
    } catch (saveErr) {
      console.error('Error saving resume record:', saveErr);
      res.status(500).json({
        success: false,
        message: 'Failed to record uploaded resume'
      });
    }
  });
});

// POST /api/resume/url - Set external custom URL (Protected)
router.post('/url', authMiddleware, async (req, res) => {
  try {
    const { customUrl, fileName } = req.body;
    if (!customUrl || !customUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Custom URL is required'
      });
    }

    const updated = await dbStore.saveResume({
      fileName: fileName?.trim() || 'Ritik_Suthar_Resume.pdf',
      fileUrl: customUrl.trim(),
      filePath: '',
      fileSize: 0,
      mimeType: 'application/pdf',
      customUrl: customUrl.trim(),
      storageType: 'external'
    });

    res.json({
      success: true,
      message: 'External resume link updated successfully!',
      data: updated
    });
  } catch (err) {
    console.error('Error saving external resume URL:', err);
    res.status(500).json({ success: false, message: 'Failed to update external resume link' });
  }
});

// DELETE /api/resume - Delete current resume (Protected)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const resume = await dbStore.getResume();
    if (resume) {
      if (resume.imageKitFileId) {
        await imageKitService.deleteFile(resume.imageKitFileId);
      }
      if (resume.filePath && fs.existsSync(resume.filePath)) {
        try {
          fs.unlinkSync(resume.filePath);
        } catch (delErr) {
          console.warn('Failed to delete resume physical file:', delErr.message);
        }
      }
    }

    await dbStore.deleteResume();
    res.json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting resume:', err);
    res.status(500).json({ success: false, message: 'Failed to delete resume' });
  }
});

module.exports = router;
