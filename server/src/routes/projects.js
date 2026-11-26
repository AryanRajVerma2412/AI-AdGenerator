import express from "express";
import fs from "fs";
import path from "path";
import Project from "../models/Project.js";
import { auth } from "../middleware/auth.js";
import { upload, productReferenceUpload } from "../middleware/upload.js";
import { referencePart } from "../services/imageGeneration.service.js";
import { 
  runPipeline, 
  renderProjectVideo, 
  regenerateSceneImageOnly, 
  regenerateSceneAudioOnly 
} from "../services/pipeline.js";
import { generateScript } from "../services/scriptService.js";
import { 
  AVAILABLE_VOICES, 
  SUPPORTED_LANGUAGES, 
  generateVoiceOver 
} from "../services/ttsService.js";
import { jobManager } from "../services/jobManager.js";

const router = express.Router();
router.use(auth);

const fields = productReferenceUpload.fields([
  { name: "productImages", maxCount: 5 },
  { name: "productImage", maxCount: 1 }, // legacy
  { name: "modelImage", maxCount: 1 },
]);

function cleanupRequestFiles(req) {
  for (const file of Object.values(req.files || {}).flat()) {
    if (file?.path) fs.rmSync(file.path, { force: true });
  }
}

// Uploaded files must be cleaned even when multipart parsing fails.
function projectUpload(req, res, next) {
  fields(req, res, error => {
    if (error) {
      cleanupRequestFiles(req);
      return res.status(400).json({ message: error.message });
    }
    next();
  });
}

function validateUploadedImages(files) {
  for (const file of files) {
    if (!file.size || file.size > 8 * 1024 * 1024) {
      throw Object.assign(new Error("Each reference image must be 8 MB or smaller"), { status: 400 });
    }
    const bytes = fs.readFileSync(file.path);
    referencePart(bytes); // checks actual image signature (not only client MIME)
  }
}

/**
 * 1. Get available voice catalog and supported languages.
 */
router.get("/voices", (_req, res) => {
  res.json({
    voices: AVAILABLE_VOICES,
    languages: SUPPORTED_LANGUAGES,
  });
});

/**
 * 2. Voice Preview Generator.
 * Generates an instant sample audio clip to preview voice, style, speed, and language.
 */
router.post("/voice-preview", async (req, res, next) => {
  try {
    const { text, voiceSettings } = req.body;
    const sampleText = text?.trim() || "Discover the next level of quality and performance designed just for you.";
    
    const audioRes = await generateVoiceOver({
      text: sampleText,
      voiceSettings: voiceSettings || {},
      isTemporaryPreview: true,
    });

    const publicUrl = `/uploads/${path.basename(audioRes.filePath)}`;
    res.json({
      audioUrl: publicUrl,
      duration: audioRes.duration,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. AI Script Generator standalone endpoint.
 * Allows generating, editing, and previewing structured scripts before saving/rendering.
 */
router.post("/generate-script", async (req, res, next) => {
  try {
    const { productName, description, category, audience, tone, duration, ctaText, aspectRatio } = req.body;
    if (!productName?.trim()) {
      return res.status(400).json({ message: "Product name is required for script generation" });
    }

    const warnings = [];
    const scenes = await generateScript({
      language: req.body.language || "en",
      onWarning: (message) => warnings.push(message),
      productName: productName.trim(),
      description: description?.trim() || "",
      category: category || "General Retail",
      audience: audience?.trim() || "General Audience",
      tone: tone || "Professional",
      duration: Number(duration) || 30,
      ctaText: ctaText?.trim() || "Shop now",
      aspectRatio: aspectRatio || "9:16",
    });

    res.json({ script: scenes, warnings });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. Create Project & Run Video Generation Pipeline.
 */
router.post("/", projectUpload, async (req, res, next) => {
  try {
    const { 
      productName, 
      description, 
      category, 
      audience, 
      tone, 
      duration, 
      style, 
      ctaText, 
      aspectRatio, 
      voiceSettings, 
      script 
    } = req.body;

    const productImages = req.files?.productImages || [];
    const legacyProduct = req.files?.productImage?.[0];
    const productImage = productImages[0] || legacyProduct;
    if (productImages.length && (productImages.length < 3 || productImages.length > 5 || legacyProduct)) {
      throw Object.assign(new Error("Upload 3–5 product reference images using productImages only"), { status: 400 });
    }
    if (productImages.length) validateUploadedImages(productImages);
    if (req.files?.modelImage?.length) validateUploadedImages(req.files.modelImage);

    const missing = ["productName", "description", "audience", "ctaText"].filter(
      (k) => !req.body[k]?.trim()
    );
    if (missing.length) {
      return res.status(400).json({ message: `Missing fields: ${missing.join(", ")}` });
    }
    if (!productImage) {
      return res.status(400).json({ message: "A product image or video is required" });
    }

    const validRatios = ["9:16", "16:9", "1:1", "4:5"];
    const selectedRatio = validRatios.includes(aspectRatio) ? aspectRatio : "9:16";

    let parsedVoice = {};
    if (voiceSettings) {
      try {
        parsedVoice = typeof voiceSettings === "string" ? JSON.parse(voiceSettings) : voiceSettings;
      } catch (e) {
        parsedVoice = {};
      }
    }

    let parsedScript = [];
    if (script) {
      try {
        parsedScript = typeof script === "string" ? JSON.parse(script) : script;
      } catch (e) {
        parsedScript = [];
      }
    }

    const project = await Project.create({
      userId: req.userId,
      productName: productName.trim(),
      description: description.trim(),
      category: category || "Electronics & Gadgets",
      audience: audience.trim(),
      tone: tone || "Professional",
      duration: [15, 30, 45, 60].includes(Number(duration)) ? Number(duration) : 30,
      style: style?.trim() || "Energetic and modern",
      ctaText: ctaText.trim(),
      aspectRatio: selectedRatio,
      productImageUrl: `/uploads/${productImage.filename}`,
      productImageUrls: productImages.length
        ? productImages.map(file => `/uploads/${file.filename}`)
        : [`/uploads/${productImage.filename}`],
      modelImageUrl: req.files?.modelImage?.[0]
        ? `/uploads/${req.files.modelImage[0].filename}`
        : undefined,
      voiceSettings: parsedVoice,
      script: parsedScript,
      status: "processing",
    });

    // Fire background generation pipeline
    runPipeline(project._id, req.userId).catch((err) => console.error("Generation task failed:", err.message));

    res.status(201).json(project);
  } catch (err) {
    cleanupRequestFiles(req);
    next(err);
  }
});

/**
 * 5. List all user projects.
 */
router.get("/", async (req, res, next) => {
  try {
    const projects = await Project.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

/**
 * 6. Get single project by ID.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// Authenticated attachment response, also used by the client's blob download.
router.get("/:id/download", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.status !== "completed" || !project.finalVideoUrl) {
      return res.status(409).json({ message: "Video is not ready yet" });
    }
    const file = path.resolve("uploads", path.basename(project.finalVideoUrl));
    if (!fs.existsSync(file)) return res.status(404).json({ message: "Video file is missing; please re-render" });
    res.download(file, `advertisement-${project._id}.mp4`, (error) => { if (error) next(error); });
  } catch (error) { next(error); }
});

/**
 * 7. Update project settings or script text.
 */
router.put("/:id", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const allowed = ["productName", "description", "category", "audience", "tone", "style", "ctaText", "aspectRatio", "voiceSettings", "script"];
    const voiceChanged = req.body.voiceSettings && JSON.stringify(req.body.voiceSettings) !== JSON.stringify(project.voiceSettings?.toObject());
    if (req.body.script) {
      if (!Array.isArray(req.body.script) || req.body.script.some(s => !s || typeof s.sceneText !== "string" || !s.sceneText.trim())) {
        return res.status(400).json({ message: "Every scene requires narration" });
      }
      req.body.script = req.body.script.map((scene, index) => ({ ...scene,
        audioUrl: voiceChanged || scene.sceneText !== project.script[index]?.sceneText ? undefined : project.script[index]?.audioUrl,
      }));
    } else if (voiceChanged) {
      project.script.forEach(scene => { scene.audioUrl = undefined; });
    }
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) project[k] = req.body[k];
    });

    await project.save();
    res.json(project);
  } catch (err) {
    next(err);
  }
});

/**
 * 8. Regenerate visual image for an individual scene.
 */
router.post("/:id/scenes/:index/regenerate-image", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.status === 'processing') return res.status(409).json({ message: 'Project is already processing' });
    const updatedScene = await regenerateSceneImageOnly(req.params.id, req.params.index);
    res.json(updatedScene);
  } catch (err) {
    next(err);
  }
});

/**
 * 9. Upload custom image replacement for an individual scene.
 */
router.post("/:id/scenes/:index/upload-image", upload.single("sceneImage"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const idx = Number(req.params.index);
    if (idx < 0 || idx >= project.script.length) {
      return res.status(400).json({ message: "Invalid scene index" });
    }

    project.script[idx].imageUrl = `/uploads/${req.file.filename}`;
    await project.save();

    res.json(project.script[idx]);
  } catch (err) {
    next(err);
  }
});

/**
 * 10. Regenerate voiceover audio for an individual scene.
 */
router.post("/:id/scenes/:index/regenerate-audio", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.status === 'processing') return res.status(409).json({ message: 'Project is already processing' });
    const updatedScene = await regenerateSceneAudioOnly(req.params.id, req.params.index);
    res.json(updatedScene);
  } catch (err) {
    next(err);
  }
});

/**
 * 11. Re-render full video with FFmpeg.
 * Useful after changing aspect ratio, editing scripts, or updating scenes.
 */
router.post("/:id/render", async (req, res, next) => {
  try {
    const { aspectRatio } = req.body;
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (jobManager.getJob(project._id)) return res.status(409).json({ message: 'A render is already active' });

    if (aspectRatio && ["9:16", "16:9", "1:1", "4:5"].includes(aspectRatio)) {
      project.aspectRatio = aspectRatio;
    }

    project.status = "processing";
    project.errorMessage = "";
    await project.save();

    // Trigger video rendering in background
    const task = project.script.length ? renderProjectVideo(project._id, req.userId) : runPipeline(project._id, req.userId);
    task.catch((err) => console.error("Render task failed:", err.message));

    res.json({ message: "Video rendering initiated", status: "processing" });
  } catch (err) {
    next(err);
  }
});

/**
 * 12. Cancel active video generation.
 * Real cancellation: terminates running FFmpeg processes, aborts network requests,
 * cleans up temporary render files, and marks project status as cancelled.
 */
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Edge case: generation already completed
    if (project.status === "completed") {
      return res.status(400).json({ 
        message: "Video generation has already completed", 
        status: "completed",
        project 
      });
    }

    // Edge case: duplicate cancellation request
    if (project.status === "cancelled") {
      return res.json({ 
        message: "Video generation is already cancelled", 
        status: "cancelled", 
        project 
      });
    }

    // Edge case: not currently processing
    if (project.status !== "processing") {
      return res.status(400).json({ 
        message: `Cannot cancel video generation with status "${project.status}"`, 
        status: project.status,
        project 
      });
    }

    // Real backend termination via jobManager
    try {
      jobManager.cancelJob(project._id.toString(), req.userId.toString());
    } catch (e) {
      console.warn("Notice during cancelJob:", e.message);
    }

    // Update MongoDB status
    project.status = "cancelled";
    project.generationStage = "Generation Cancelled";
    project.errorMessage = "Generation was cancelled by the user.";
    await project.save();

    res.json({ 
      message: "Video generation cancelled successfully", 
      status: "cancelled", 
      project 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 12. Delete project and associated assets.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ message: "Project not found" });
    jobManager.cancelJob(project._id, req.userId);

    const urls = [
      project.productImageUrl,
      ...(project.productImageUrls || []),
      project.modelImageUrl,
      project.finalVideoUrl,
      ...project.script.flatMap((s) => [s.imageUrl, s.audioUrl]),
    ].filter(Boolean);

    for (const url of urls) {
      const file = path.resolve("uploads", path.basename(url));
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (e) {
        // ignore unlink error
      }
    }

    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;

