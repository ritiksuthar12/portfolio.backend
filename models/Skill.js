const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['Frontend', 'Backend', 'Database', 'Language', 'Core', 'Tools', 'Other'],
      default: 'Frontend',
    },
    icon: {
      type: String,
      default: 'code',
      trim: true,
    },
    proficiency: {
      type: Number,
      min: 0,
      max: 100,
      default: 85,
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

module.exports = mongoose.model('Skill', skillSchema);
