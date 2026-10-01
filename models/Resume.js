const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      default: 'Ritik_Suthar_Resume.pdf'
    },
    fileUrl: {
      type: String,
      default: ''
    },
    filePath: {
      type: String,
      default: ''
    },
    fileSize: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: 'application/pdf'
    },
    customUrl: {
      type: String,
      default: ''
    },
    // Direct MongoDB Binary Buffer storage (permanent across ephemeral serverless/Render restarts)
    fileData: {
      type: Buffer,
      default: null
    },
    // ImageKit Cloud Storage fields
    imageKitUrl: {
      type: String,
      default: ''
    },
    imageKitFileId: {
      type: String,
      default: ''
    },
    storageType: {
      type: String,
      enum: ['mongodb_buffer', 'imagekit', 'local', 'external'],
      default: 'mongodb_buffer'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Resume', resumeSchema);
