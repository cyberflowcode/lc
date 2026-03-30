import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../middlewares/authenticate.js";

const router: IRouter = Router();

const uploadDir = path.join(process.cwd(), "uploads");
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch { /* already exists */ }

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `audio-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

router.post("/upload/audio", authenticate, upload.single("audio"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No audio file uploaded" });
    return;
  }
  const audioUrl = `/api/uploads/${req.file.filename}`;
  res.json({ audioUrl });
});

export default router;
