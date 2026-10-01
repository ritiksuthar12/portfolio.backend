const ImageKit = require('imagekit');

class ImageKitService {
  constructor() {
    this.client = null;
    this.init();
  }

  init() {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    // Check if real keys are provided (not empty and not default placeholders)
    if (
      publicKey &&
      privateKey &&
      urlEndpoint &&
      !publicKey.includes('your_imagekit') &&
      !privateKey.includes('your_imagekit') &&
      !urlEndpoint.includes('your_imagekit')
    ) {
      try {
        this.client = new ImageKit({
          publicKey: publicKey.trim(),
          privateKey: privateKey.trim(),
          urlEndpoint: urlEndpoint.trim()
        });
        console.log('☁️ ImageKit Cloud Storage: Configured and ready');
      } catch (err) {
        console.warn('⚠️ ImageKit initialization error:', err.message);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  isConfigured() {
    if (!this.client) {
      this.init();
    }
    return !!this.client;
  }

  async uploadResume(fileBuffer, fileName) {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await this.client.upload({
        file: fileBuffer, // Buffer or base64 string
        fileName: fileName || 'Ritik_Suthar_Resume.pdf',
        folder: '/portfolio/resume',
        useUniqueFileName: true
      });

      console.log('✅ ImageKit: Resume successfully uploaded to cloud CDN:', response.url);
      return {
        url: response.url,
        fileId: response.fileId,
        thumbnailUrl: response.thumbnailUrl,
        size: response.size
      };
    } catch (err) {
      console.error('❌ ImageKit upload failed:', err.message);
      return null;
    }
  }

  async deleteFile(fileId) {
    if (!this.isConfigured() || !fileId) {
      return false;
    }

    try {
      await this.client.deleteFile(fileId);
      console.log('🗑️ ImageKit: Deleted cloud file with ID:', fileId);
      return true;
    } catch (err) {
      console.warn('⚠️ ImageKit delete failed:', err.message);
      return false;
    }
  }
}

module.exports = new ImageKitService();
