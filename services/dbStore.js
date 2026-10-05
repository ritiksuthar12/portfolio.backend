const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const Message = require('../models/Message');
const Admin = require('../models/Admin');
const Resume = require('../models/Resume');
const { initialProjects, initialSkills } = require('../data/initialData');

const storeFilePath = path.join(__dirname, '..', 'data', 'portfolio_store.json');

class DBStore {
  constructor() {
    this.isMongoConnected = false;
    this.localData = {
      projects: [],
      skills: [],
      messages: [],
      admins: [],
      resume: null
    };
    this.initLocalStore();
  }

  get isMongoReady() {
    const mongoose = require('mongoose');
    return this.isMongoConnected || (mongoose.connection && mongoose.connection.readyState === 1);
  }

  setMongoConnected(status) {
    this.isMongoConnected = status;
    if (status) {
      console.log('⚡ DBStore: MongoDB active mode enabled');
      this.syncLocalToMongo();
    } else {
      console.log('⚡ DBStore: Running with persistent JSON store fallback');
    }
  }

  initLocalStore() {
    try {
      const dataDir = path.dirname(storeFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(storeFilePath)) {
        const raw = fs.readFileSync(storeFilePath, 'utf8');
        this.localData = JSON.parse(raw);
      } else {
        const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        this.localData = {
          projects: initialProjects,
          skills: initialSkills,
          messages: [],
          admins: [
            {
              id: 'admin-1',
              username: (process.env.ADMIN_USERNAME || 'ritik').toLowerCase(),
              password: hashedPassword
            }
          ]
        };
        this.saveLocalStore();
      }
    } catch (err) {
      console.error('Error initializing local store:', err.message);
    }
  }

  saveLocalStore() {
    try {
      if (process.env.VERCEL) {
        return;
      }
      fs.writeFileSync(storeFilePath, JSON.stringify(this.localData, null, 2), 'utf8');
    } catch (err) {
      console.warn('Local store write skipped (serverless or read-only):', err.message);
    }
  }

  async syncLocalToMongo() {
    try {
      const seededFile = path.join(__dirname, '..', 'data', '.db_initialized');
      const isAlreadyInitialized = fs.existsSync(seededFile);

      const adminCount = await Admin.countDocuments();
      if (adminCount === 0) {
        const username = (process.env.ADMIN_USERNAME || 'ritik').toLowerCase();
        const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        await Admin.create({ username, password: hashedPassword });
        console.log(`Default admin created in MongoDB: ${username}`);
      }

      // ONLY seed initial demo data if the database has NEVER been initialized before
      if (!isAlreadyInitialized && adminCount === 0) {
        const projectCount = await Project.countDocuments();
        if (projectCount === 0 && this.localData.projects.length > 0) {
          console.log('Seeding MongoDB with initial projects...');
          const mongoProjects = this.localData.projects.map(p => ({
            title: p.title,
            description: p.description,
            deployedUrl: p.deployedUrl,
            githubUrl: p.githubUrl || '',
            tags: p.tags || [],
            category: p.category || 'Full Stack',
            featured: p.featured !== false,
            order: p.order || 0
          }));
          await Project.insertMany(mongoProjects);
        }

        const skillCount = await Skill.countDocuments();
        if (skillCount === 0 && this.localData.skills.length > 0) {
          console.log('Seeding MongoDB with initial skills...');
          const mongoSkills = this.localData.skills.map(s => ({
            name: s.name,
            category: s.category || 'Frontend',
            icon: s.icon || 'code',
            proficiency: s.proficiency || 85,
            featured: s.featured !== false,
            order: s.order || 0
          }));
          await Skill.insertMany(mongoSkills);
        }

        try {
          fs.writeFileSync(seededFile, new Date().toISOString(), 'utf8');
        } catch (e) {}
      } else if (!isAlreadyInitialized) {
        try {
          fs.writeFileSync(seededFile, new Date().toISOString(), 'utf8');
        } catch (e) {}
      }
    } catch (err) {
      console.error('Error syncing to MongoDB:', err.message);
    }
  }

  // Projects CRUD
  async getProjects() {
    if (this.isMongoReady) {
      try {
        const projects = await Project.find().sort({ order: 1, createdAt: -1 });
        return projects.map(p => ({
          id: p._id.toString(),
          _id: p._id.toString(),
          title: p.title,
          description: p.description,
          deployedUrl: p.deployedUrl,
          githubUrl: p.githubUrl,
          tags: p.tags,
          category: p.category,
          featured: p.featured,
          order: p.order,
          createdAt: p.createdAt
        }));
      } catch (err) {
        console.warn('Mongo fetch failed, reading fallback:', err.message);
      }
    }
    return [...this.localData.projects].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getProjectById(id) {
    if (this.isMongoReady) {
      try {
        const p = await Project.findById(id);
        if (p) {
          return {
            id: p._id.toString(),
            _id: p._id.toString(),
            title: p.title,
            description: p.description,
            deployedUrl: p.deployedUrl,
            githubUrl: p.githubUrl,
            tags: p.tags,
            category: p.category,
            featured: p.featured,
            order: p.order,
            createdAt: p.createdAt
          };
        }
      } catch (err) {
        // fallback to local
      }
    }
    return this.localData.projects.find(p => p.id === id || p._id === id);
  }

  async createProject(data) {
    let newProject;
    if (this.isMongoReady) {
      try {
        const doc = await Project.create({
          title: data.title,
          description: data.description,
          deployedUrl: data.deployedUrl,
          githubUrl: data.githubUrl || '',
          tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()) : []),
          category: data.category || 'Full Stack',
          featured: data.featured !== false,
          order: data.order || 0
        });
        newProject = {
          id: doc._id.toString(),
          _id: doc._id.toString(),
          title: doc.title,
          description: doc.description,
          deployedUrl: doc.deployedUrl,
          githubUrl: doc.githubUrl,
          tags: doc.tags,
          category: doc.category,
          featured: doc.featured,
          order: doc.order,
          createdAt: doc.createdAt
        };
      } catch (err) {
        console.warn('Mongo creation failed, falling to local:', err.message);
      }
    }

    if (!newProject) {
      const id = 'proj-' + Date.now();
      newProject = {
        id,
        _id: id,
        title: data.title,
        description: data.description,
        deployedUrl: data.deployedUrl,
        githubUrl: data.githubUrl || '',
        tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()) : []),
        category: data.category || 'Full Stack',
        featured: data.featured !== false,
        order: data.order || 0,
        createdAt: new Date().toISOString()
      };
      this.localData.projects.unshift(newProject);
      this.saveLocalStore();
    } else {
      this.localData.projects.unshift(newProject);
      this.saveLocalStore();
    }

    return newProject;
  }

  async updateProject(id, data) {
    let updated;
    if (this.isMongoReady) {
      try {
        const doc = await Project.findByIdAndUpdate(
          id,
          {
            title: data.title,
            description: data.description,
            deployedUrl: data.deployedUrl,
            githubUrl: data.githubUrl || '',
            tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()) : []),
            category: data.category || 'Full Stack',
            featured: data.featured !== undefined ? data.featured : true,
            order: data.order !== undefined ? data.order : 0
          },
          { new: true }
        );
        if (doc) {
          updated = {
            id: doc._id.toString(),
            _id: doc._id.toString(),
            title: doc.title,
            description: doc.description,
            deployedUrl: doc.deployedUrl,
            githubUrl: doc.githubUrl,
            tags: doc.tags,
            category: doc.category,
            featured: doc.featured,
            order: doc.order,
            createdAt: doc.createdAt
          };
        }
      } catch (err) {
        console.warn('Mongo update failed:', err.message);
      }
    }

    const idx = this.localData.projects.findIndex(p => p.id === id || p._id === id);
    if (idx !== -1) {
      const existing = this.localData.projects[idx];
      const merged = {
        ...existing,
        ...data,
        tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()) : existing.tags),
        updatedAt: new Date().toISOString()
      };
      this.localData.projects[idx] = merged;
      this.saveLocalStore();
      if (!updated) updated = merged;
    }

    return updated;
  }

  async deleteProject(id) {
    let deleted = false;
    let deletedDoc = null;
    const mongoose = require('mongoose');

    if (this.isMongoReady) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          deletedDoc = await Project.findByIdAndDelete(id);
        }
        if (!deletedDoc) {
          deletedDoc = await Project.findOneAndDelete({
            $or: [
              ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
              { id: id },
              { title: id }
            ]
          });
        }
        if (deletedDoc) {
          deleted = true;
        }
      } catch (err) {
        console.warn('Mongo delete failed:', err.message);
      }
    }

    const prevLen = this.localData.projects.length;
    const matchTitle = deletedDoc ? deletedDoc.title : id;
    this.localData.projects = this.localData.projects.filter(p => 
      p.id !== id && p._id !== id && p.title !== id && p.title !== matchTitle
    );
    if (this.localData.projects.length !== prevLen || deleted) {
      deleted = true;
      this.saveLocalStore();
    }
    return deleted;
  }

  // Skills CRUD
  async getSkills() {
    if (this.isMongoReady) {
      try {
        const skills = await Skill.find().sort({ order: 1, name: 1 });
        return skills.map(s => ({
          id: s._id.toString(),
          _id: s._id.toString(),
          name: s.name,
          category: s.category,
          icon: s.icon,
          proficiency: s.proficiency,
          featured: s.featured,
          order: s.order
        }));
      } catch (err) {
        console.warn('Mongo fetch skills failed:', err.message);
      }
    }
    return [...this.localData.skills].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async createSkill(data) {
    let newSkill;
    if (this.isMongoReady) {
      try {
        const doc = await Skill.create({
          name: data.name,
          category: data.category || 'Frontend',
          icon: data.icon || 'code',
          proficiency: Number(data.proficiency) || 85,
          featured: data.featured !== false,
          order: Number(data.order) || 0
        });
        newSkill = {
          id: doc._id.toString(),
          _id: doc._id.toString(),
          name: doc.name,
          category: doc.category,
          icon: doc.icon,
          proficiency: doc.proficiency,
          featured: doc.featured,
          order: doc.order
        };
      } catch (err) {
        console.warn('Mongo create skill failed:', err.message);
      }
    }

    if (!newSkill) {
      const id = 'skill-' + Date.now();
      newSkill = {
        id,
        _id: id,
        name: data.name,
        category: data.category || 'Frontend',
        icon: data.icon || 'code',
        proficiency: Number(data.proficiency) || 85,
        featured: data.featured !== false,
        order: Number(data.order) || 0
      };
      this.localData.skills.push(newSkill);
      this.saveLocalStore();
    } else {
      this.localData.skills.push(newSkill);
      this.saveLocalStore();
    }
    return newSkill;
  }

  async updateSkill(id, data) {
    let updated;
    if (this.isMongoReady) {
      try {
        const doc = await Skill.findByIdAndUpdate(
          id,
          {
            name: data.name,
            category: data.category,
            icon: data.icon,
            proficiency: Number(data.proficiency),
            featured: data.featured,
            order: Number(data.order)
          },
          { new: true }
        );
        if (doc) {
          updated = {
            id: doc._id.toString(),
            _id: doc._id.toString(),
            name: doc.name,
            category: doc.category,
            icon: doc.icon,
            proficiency: doc.proficiency,
            featured: doc.featured,
            order: doc.order
          };
        }
      } catch (err) {
        console.warn('Mongo update skill failed:', err.message);
      }
    }

    const idx = this.localData.skills.findIndex(s => s.id === id || s._id === id);
    if (idx !== -1) {
      const merged = { ...this.localData.skills[idx], ...data };
      this.localData.skills[idx] = merged;
      this.saveLocalStore();
      if (!updated) updated = merged;
    }
    return updated;
  }

  async deleteSkill(id) {
    let deleted = false;
    let deletedDoc = null;
    const mongoose = require('mongoose');

    if (this.isMongoReady) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          deletedDoc = await Skill.findByIdAndDelete(id);
        }
        if (!deletedDoc) {
          deletedDoc = await Skill.findOneAndDelete({
            $or: [
              ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
              { id: id },
              { name: id }
            ]
          });
        }
        if (deletedDoc) {
          deleted = true;
        }
      } catch (err) {
        console.warn('Mongo delete skill failed:', err.message);
      }
    }

    const prevLen = this.localData.skills.length;
    const matchName = deletedDoc ? deletedDoc.name : id;
    this.localData.skills = this.localData.skills.filter(s => 
      s.id !== id && s._id !== id && s.name !== id && s.name !== matchName
    );
    if (this.localData.skills.length !== prevLen || deleted) {
      deleted = true;
      this.saveLocalStore();
    }
    return deleted;
  }

  // Messages
  async getMessages() {
    if (this.isMongoReady) {
      try {
        const msgs = await Message.find().sort({ createdAt: -1 });
        return msgs.map(m => ({
          id: m._id.toString(),
          _id: m._id.toString(),
          name: m.name,
          email: m.email,
          subject: m.subject,
          message: m.message,
          read: m.read,
          createdAt: m.createdAt
        }));
      } catch (err) {
        console.warn('Mongo fetch messages failed:', err.message);
      }
    }
    return [...this.localData.messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createMessage(data) {
    let newMsg;
    if (this.isMongoReady) {
      try {
        const doc = await Message.create({
          name: data.name,
          email: data.email,
          subject: data.subject || 'Portfolio Inquiry',
          message: data.message,
          read: false
        });
        newMsg = {
          id: doc._id.toString(),
          _id: doc._id.toString(),
          name: doc.name,
          email: doc.email,
          subject: doc.subject,
          message: doc.message,
          read: doc.read,
          createdAt: doc.createdAt
        };
      } catch (err) {
        console.warn('Mongo create message failed:', err.message);
      }
    }

    if (!newMsg) {
      const id = 'msg-' + Date.now();
      newMsg = {
        id,
        _id: id,
        name: data.name,
        email: data.email,
        subject: data.subject || 'Portfolio Inquiry',
        message: data.message,
        read: false,
        createdAt: new Date().toISOString()
      };
      this.localData.messages.unshift(newMsg);
      this.saveLocalStore();
    } else {
      this.localData.messages.unshift(newMsg);
      this.saveLocalStore();
    }
    return newMsg;
  }

  async deleteMessage(id) {
    if (this.isMongoReady) {
      try {
        await Message.findByIdAndDelete(id);
      } catch (err) {}
    }
    this.localData.messages = this.localData.messages.filter(m => m.id !== id && m._id !== id);
    this.saveLocalStore();
    return true;
  }

  // Admin Auth
  async findAdminByUsername(username) {
    const raw = (username || '').toLowerCase().trim();
    const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw;
    const withAt = '@' + withoutAt;

    if (this.isMongoReady) {
      try {
        const adminDoc = await Admin.findOne({
          username: { $in: [raw, withAt, withoutAt] }
        });
        if (adminDoc) {
          return {
            id: adminDoc._id.toString(),
            username: adminDoc.username,
            password: adminDoc.password
          };
        }
      } catch (err) {
        console.warn('Mongo findAdmin failed:', err.message);
      }
    }

    return this.localData.admins.find(a => {
      const u = (a.username || '').toLowerCase().trim();
      return u === raw || u === withAt || u === withoutAt;
    });
  }

  async updateAdminPassword(username, newHashedPassword) {
    const normUser = (username || '').toLowerCase().trim();
    if (this.isMongoReady) {
      try {
        await Admin.findOneAndUpdate({ username: normUser }, { password: newHashedPassword });
      } catch (err) {}
    }
    const idx = this.localData.admins.findIndex(a => a.username.toLowerCase() === normUser);
    if (idx !== -1) {
      this.localData.admins[idx].password = newHashedPassword;
      this.saveLocalStore();
    }
  }

  // Resume Management
  async getResume() {
    if (this.isMongoReady) {
      try {
        const resumeDoc = await Resume.findOne().sort({ updatedAt: -1 });
        if (resumeDoc) {
          return {
            id: resumeDoc._id.toString(),
            fileName: resumeDoc.fileName,
            fileUrl: resumeDoc.imageKitUrl || resumeDoc.fileUrl,
            filePath: resumeDoc.filePath,
            fileSize: resumeDoc.fileSize,
            mimeType: resumeDoc.mimeType,
            customUrl: resumeDoc.customUrl,
            imageKitUrl: resumeDoc.imageKitUrl,
            storageType: resumeDoc.storageType || (resumeDoc.imageKitUrl ? 'imagekit' : (resumeDoc.fileData ? 'mongodb_buffer' : 'local')),
            uploadedAt: resumeDoc.uploadedAt,
            hasResume: true,
            hasBuffer: !!(resumeDoc.fileData && resumeDoc.fileData.length > 0)
          };
        }
      } catch (err) {
        console.warn('Mongo getResume failed:', err.message);
      }
    }

    if (this.localData.resume) {
      return {
        ...this.localData.resume,
        fileUrl: this.localData.resume.imageKitUrl || this.localData.resume.fileUrl,
        hasResume: true
      };
    }

    return null;
  }

  async getResumeFile() {
    if (this.isMongoReady) {
      try {
        const resumeDoc = await Resume.findOne().sort({ updatedAt: -1 });
        if (resumeDoc) {
          return {
            buffer: resumeDoc.fileData && resumeDoc.fileData.length > 0 ? resumeDoc.fileData : null,
            filePath: resumeDoc.filePath,
            mimeType: resumeDoc.mimeType || 'application/pdf',
            fileName: resumeDoc.fileName || 'Ritik_Suthar_Resume.pdf',
            imageKitUrl: resumeDoc.imageKitUrl || '',
            customUrl: resumeDoc.customUrl || ''
          };
        }
      } catch (err) {
        console.warn('Mongo getResumeFile error:', err.message);
      }
    }

    if (this.localData.resume) {
      return {
        buffer: this.localData.resume.fileBase64 ? Buffer.from(this.localData.resume.fileBase64, 'base64') : null,
        filePath: this.localData.resume.filePath,
        mimeType: this.localData.resume.mimeType || 'application/pdf',
        fileName: this.localData.resume.fileName || 'Ritik_Suthar_Resume.pdf',
        imageKitUrl: this.localData.resume.imageKitUrl || '',
        customUrl: this.localData.resume.customUrl || ''
      };
    }

    return null;
  }

  async saveResume(resumeData) {
    const payload = {
      fileName: resumeData.fileName || 'Ritik_Suthar_Resume.pdf',
      fileUrl: resumeData.fileUrl || '',
      filePath: resumeData.filePath || '',
      fileSize: resumeData.fileSize || 0,
      mimeType: resumeData.mimeType || 'application/pdf',
      customUrl: resumeData.customUrl || '',
      fileData: resumeData.fileData || null,
      imageKitUrl: resumeData.imageKitUrl || '',
      imageKitFileId: resumeData.imageKitFileId || '',
      storageType: resumeData.storageType || 'mongodb_buffer',
      uploadedAt: new Date().toISOString()
    };

    if (this.isMongoReady) {
      try {
        await Resume.deleteMany({});
        const created = await Resume.create(payload);
        payload.id = created._id.toString();
      } catch (err) {
        console.warn('Mongo saveResume error:', err.message);
      }
    }

    // Save lightweight copy without binary buffer into JSON store
    const localCopy = { ...payload };
    if (payload.fileData) {
      // Store small base64 copy for offline store if size <= 5MB
      if (payload.fileSize <= 5 * 1024 * 1024) {
        localCopy.fileBase64 = payload.fileData.toString('base64');
      }
      delete localCopy.fileData;
    }

    this.localData.resume = localCopy;
    this.saveLocalStore();
    return {
      fileName: payload.fileName,
      fileUrl: payload.imageKitUrl || payload.fileUrl,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      customUrl: payload.customUrl,
      imageKitUrl: payload.imageKitUrl,
      storageType: payload.storageType,
      uploadedAt: payload.uploadedAt,
      hasResume: true
    };
  }

  async deleteResume() {
    if (this.isMongoReady) {
      try {
        await Resume.deleteMany({});
      } catch (err) {
        console.warn('Mongo deleteResume error:', err.message);
      }
    }

    this.localData.resume = null;
    this.saveLocalStore();
    return true;
  }
}

module.exports = new DBStore();
