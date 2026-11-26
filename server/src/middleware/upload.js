import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Never serve user-selected .html/.svg extensions from the uploads origin.
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
      'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv',
      'video/avi': '.avi', 'video/ogg': '.ogg' }[file.mimetype];
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEOS = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/avi", "video/ogg"];

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit for images and videos
  fileFilter: (_req, file, cb) => {
    const isImage = ALLOWED_IMAGES.includes(file.mimetype);
    const isVideo = ALLOWED_VIDEOS.includes(file.mimetype);

    if (!isImage && !isVideo) {
      return cb(new Error("Only JPG, PNG, WEBP images or MP4, WebM, MOV videos up to 100MB are allowed"));
    }
    cb(null, true);
  },
});

// Project reference assets use Gemini-compatible formats and an 8 MB per-file limit.
// Keep the legacy upload middleware for scene replacements / older video projects.
export const productReferenceUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 7, fields: 35 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "productImages" || file.fieldname === "modelImage") {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
        return cb(new Error("Product references must be JPG, PNG or WebP images (8 MB max each)"));
      }
    } else if (file.fieldname === "productImage") {
      // Preserve old single-asset video uploads.
      if (![...ALLOWED_IMAGES, ...ALLOWED_VIDEOS].includes(file.mimetype)) {
        return cb(new Error("Unsupported product media format"));
      }
    }
    cb(null, true);
  },
});
