const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
    },
    deployedUrl: {
      type: String,
      required: [true, 'Deployed link is required'],
      trim: true,
    },
    githubUrl: {
      type: String,
      default: '',
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      enum: ['Full Stack', 'Frontend', 'Backend', 'Core', 'Mobile', 'Other'],
      default: 'Full Stack',
    },
    featured: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Project', projectSchema);
