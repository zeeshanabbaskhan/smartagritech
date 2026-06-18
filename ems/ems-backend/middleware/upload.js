// ─── Multer + Cloudinary upload middleware ────────────────────────────────────
// Two storage configurations: general images go to ems/, icons to ems/icons/.
// Both expect a single field named 'imageFile'.
const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const cloudinary = require('../config/cloudinary')

const defaultStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ems',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
  },
})

const iconStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ems/icons',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
  },
})

const uploadSingle = multer({ storage: defaultStorage }).single('imageFile')
const uploadIcon   = multer({ storage: iconStorage   }).single('imageFile')

module.exports = { uploadSingle, uploadIcon }
