// ─── Multer upload middleware ─────────────────────────────────────────────────
// Prefer Cloudinary when credentials are set; otherwise store files on disk under
// /uploads (served by Express). Both expect a single field named 'imageFile'.
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const cloudinary = require('../config/cloudinary')

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads')
fs.mkdirSync(path.join(UPLOAD_ROOT, 'themes'), { recursive: true })
fs.mkdirSync(path.join(UPLOAD_ROOT, 'icons'), { recursive: true })
fs.mkdirSync(path.join(UPLOAD_ROOT, 'misc'), { recursive: true })

const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET
)

const diskStorage = (subdir) => multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOAD_ROOT, subdir)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
    const safe = ext.replace(/[^.a-z0-9]/gi, '') || '.png'
    cb(null, `${subdir.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safe}`)
  },
})

const cloudinaryStorage = (folder) => new CloudinaryStorage({
  cloudinary,
  params: {
    folder: `ems/${folder}`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'],
  },
})

const imageFilter = (_req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'))
  }
  cb(null, true)
}

const limits = { fileSize: 5 * 1024 * 1024 }

function makeUploader(subdir) {
  const storage = hasCloudinary
    ? cloudinaryStorage(subdir)
    : diskStorage(subdir)
  return multer({ storage, fileFilter: imageFilter, limits }).single('imageFile')
}

const uploadSingle = makeUploader('misc')
const uploadIcon = makeUploader('icons')
const uploadThemeLogo = makeUploader('themes')

/** Public URL for a multer file (Cloudinary URL or /uploads/... path). */
function publicUrlForUpload(file, subdir = 'misc') {
  if (!file) return null
  const candidate = file.path || file.secure_url || file.url
  if (candidate && /^https?:\/\//i.test(candidate)) return candidate
  if (file.filename) return `/uploads/${subdir}/${file.filename}`
  return null
}

module.exports = {
  uploadSingle,
  uploadIcon,
  uploadThemeLogo,
  publicUrlForUpload,
  hasCloudinary,
  UPLOAD_ROOT,
}
