import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

// Ensure uploads directories exist
const imagesDir = path.join(__dirname, '../../uploads/emergency-images')
const audioDir = path.join(__dirname, '../../uploads/emergency-audio')
const videosDir = path.join(__dirname, '../../uploads/emergency-videos')

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true })
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true })
}
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true })
}

// Configure storage with dynamic destination based on file type
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination based on field name or MIME type
    if (file.fieldname === 'video' || file.mimetype.startsWith('video/')) {
      cb(null, videosDir)
    } else if (file.fieldname === 'audio' || file.mimetype.startsWith('audio/')) {
      cb(null, audioDir)
    } else {
      cb(null, imagesDir)
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: {uuid}-{timestamp}.{ext}
    const ext = path.extname(file.originalname).toLowerCase()
    const uniqueName = `${uuidv4()}-${Date.now()}${ext}`
    cb(null, uniqueName)
  },
})

// File filter - allow images, audio, and video
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  const allowedImageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const allowedAudioMimes = [
    'audio/mpeg', 
    'audio/mp3', 
    'audio/wav', 
    'audio/webm', 
    'audio/ogg', 
    'audio/aac', 
    'audio/m4a',
    'audio/mp4', // Safari/iOS often uses this
    'audio/x-m4a', // Alternative M4A MIME type
    'audio/opus', // Opus codec
  ]
  const allowedVideoMimes = [
    'video/webm',
    'video/mp4',
    'video/quicktime', // MOV files (Safari/iOS)
    'video/x-msvideo', // AVI files
    'video/ogg',
    'video/x-m4v', // Safari/iOS M4V files
    'video/3gpp', // 3GPP video (mobile)
    'video/3gpp2', // 3GPP2 video (mobile)
    'video/x-matroska', // MKV files
  ]
  
  // Also check if it starts with video/, audio/, or image/ for broader compatibility
  const isImage = allowedImageMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')
  const isAudio = allowedAudioMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')
  const isVideo = allowedVideoMimes.includes(file.mimetype) || file.mimetype.startsWith('video/')
  
  if (isImage || isAudio || isVideo) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, WebP), audio (MP3, WAV, WebM, OGG, AAC, M4A, MP4), and video (WebM, MP4, MOV) are allowed.'))
  }
}

// Configure multer for images only (backward compatibility)
export const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, imagesDir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      const uniqueName = `${uuidv4()}-${Date.now()}${ext}`
      cb(null, uniqueName)
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'))
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
})

// Configure multer for audio only
export const uploadAudio = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, audioDir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      const uniqueName = `${uuidv4()}-${Date.now()}${ext}`
      cb(null, uniqueName)
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 
      'audio/mp3', 
      'audio/wav', 
      'audio/webm', 
      'audio/ogg', 
      'audio/aac', 
      'audio/m4a',
      'audio/mp4', // Safari/iOS
      'audio/x-m4a', // Alternative M4A
      'audio/opus', // Opus codec
    ]
    // Also accept any audio/* MIME type for broader compatibility
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only audio files (MP3, WAV, WebM, OGG, AAC, M4A, MP4) are allowed.'))
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for audio
  },
})

// Configure multer for images, audio, and video (for messages route)
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (for videos, images/audio still limited in validation)
  },
})

/**
 * Get public URL for uploaded image
 */
export const getImageUrl = (filename: string): string => {
  return `/uploads/emergency-images/${filename}`
}

/**
 * Get public URL for uploaded audio
 */
export const getAudioUrl = (filename: string): string => {
  return `/uploads/emergency-audio/${filename}`
}

/**
 * Get public URL for uploaded video
 */
export const getVideoUrl = (filename: string): string => {
  return `/uploads/emergency-videos/${filename}`
}

/**
 * Delete uploaded image file
 */
export const deleteImage = (filename: string): void => {
  const filePath = path.join(imagesDir, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

/**
 * Delete uploaded audio file
 */
export const deleteAudio = (filename: string): void => {
  const filePath = path.join(audioDir, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

/**
 * Delete uploaded video file
 */
export const deleteVideo = (filename: string): void => {
  const filePath = path.join(videosDir, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

