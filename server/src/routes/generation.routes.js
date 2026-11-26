
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';

import { auth } from '../middleware/auth.js';
import Job from '../models/GenerationJob.js';
import Project from '../models/Project.js';

import {
  geminiConfig,
  IMAGE_RATIOS,
  VIDEO_RATIOS,
  PRICING,
  problem
} from '../config/gemini.config.js';

import {
  estimateCost,
  usageSummary
} from '../services/usage.service.js';

import {
  startGeneration,
  ownedJob,
  publicJob,
  cancelGeneration,
  mediaPath
} from '../services/generationJobs.service.js';

const router = express.Router();

router.use(auth);

const reference = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 5,
    fields: 8,
    fieldSize: 10000
  }
}).fields([{ name: 'referenceImage', maxCount: 1 }, { name: 'referenceImages', maxCount: 5 }]);

const route = fn => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);

// Generation configuration
router.get('/config', route(async (_req, res) => {
  const c = geminiConfig();

  const imageConfigured = Boolean(
    c.apiKey && !c.apiKey.startsWith('your_')
  );

  const videoConfigured = Boolean(
    c.googleCloudProject &&
    c.googleCloudLocation &&
    c.videoOutputGcsUri?.startsWith('gs://')
  );

  res.json({
    imageModel: c.imageModel,
    videoModel: c.videoModel,

    imageEnabled: c.imageEnabled,
    videoEnabled: c.videoEnabled,

    imageConfigured,
    videoConfigured,

    // Backward compatibility
    configured: imageConfigured,

    imageRatios: IMAGE_RATIOS,
    videoRatios: VIDEO_RATIOS,

    duration: c.duration,
    resolution: '720p',

    pricing: PRICING,

    imageCost: estimateCost('image'),
    videoCost: estimateCost('video', c.duration),

    usage: await usageSummary()
  });
}));

// List generation jobs
router.get('/jobs', route(async (req, res) => {
  const jobs = await Job.find({
    userId: req.userId
  })
    .sort({ createdAt: -1 })
    .limit(30);

  res.json(jobs.map(publicJob));
}));

// Image and video generation
for (const kind of ['image', 'video']) {

  router.post(`/${kind}`, reference, route(async (req, res) => {
    const multi = req.files?.referenceImages || [];
    const single = req.files?.referenceImage || [];
    if (multi.length && single.length) {
      throw problem('Use referenceImages or referenceImage, not both');
    }
    if (kind === 'video' && multi.length > 1) {
      throw problem('Direct Veo video generation accepts one starting reference image');
    }
    const references = multi.length ? multi.map(file => file.buffer) : single.map(file => file.buffer);
    const job = await startGeneration(
      kind,
      req.userId,
      req.body,
      references,
      req.get('Idempotency-Key')
    );

    res.status(202).json(publicJob(job));
  }));

  // Job status
  router.get(`/${kind}/:operationId`, route(async (req, res) => {
    const job = await ownedJob(
      req.params.operationId,
      req.userId,
      kind
    );

    res.json(publicJob(job));
  }));

  // Cancel job locally
  router.post(`/${kind}/:operationId/cancel`, route(async (req, res) => {
    await ownedJob(
      req.params.operationId,
      req.userId,
      kind
    );

    const job = await cancelGeneration(
      req.params.operationId,
      req.userId
    );

    res.json(publicJob(job));
  }));
}

// Preview and download generated media
router.get(
  ['/media/:id', '/media/:id/download'],
  route(async (req, res) => {
    const job = await ownedJob(req.params.id, req.userId);

    if (job.status !== 'completed' || !job.file) {
      throw problem('Media is not ready', 409);
    }

    const file = mediaPath(job);

    if (!fs.existsSync(file)) {
      throw problem('Generated file is missing', 404);
    }

    res.set('Cache-Control', 'private, no-store');

    if (req.path.endsWith('/download')) {
      return res.download(file);
    }

    res.type(job.mimeType).sendFile(file);
  })
);

// Use generated media in a project scene
router.post('/media/:id/use-in-scene', route(async (req, res) => {
  const job = await ownedJob(req.params.id, req.userId);

  if (job.status !== 'completed' || !job.file) {
    throw problem('Media is not ready', 409);
  }

  const project = await Project.findOne({
    _id: req.body.projectId,
    userId: req.userId
  });

  if (!project) {
    throw problem('Project not found', 404);
  }

  if (project.status === 'processing') {
    throw problem('Wait for the current render to finish', 409);
  }

  const index = Number(req.body.sceneIndex);

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= project.script.length
  ) {
    throw problem('Invalid scene index');
  }

  const filename =
    `scene-${job._id}-${project._id}-${index}${path.extname(job.file)}`;

  fs.copyFileSync(
    mediaPath(job),
    path.resolve('uploads', filename)
  );

  project.script[index].imageUrl = `/uploads/${filename}`;

  await project.save();

  res.json({
    message: 'Scene media replaced. Re-render the project to apply it.',
    projectId: project._id
  });
}));

export default router;
