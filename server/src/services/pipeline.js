
import path from "node:path";
import fs from "node:fs";
import Project from "../models/Project.js";
import { generateScript } from "./scriptService.js";
import { generateSceneImage } from "./imageService.js";
import { generateVoiceOver } from "./ttsService.js";
import { generateVideo } from "./videoGeneration.service.js";
import { assembleVideo } from "./videoService.js";
import { jobManager } from "./jobManager.js";

const publicUrl = (filePath) => `/uploads/${path.basename(filePath)}`;
const localPath = (url) => path.resolve("uploads", path.basename(url));

const recordWarning = (project) => (message) => {
  if (!project.warnings.includes(message)) {
    project.warnings.push(message);
  }
};

// Video API currently accepts only 16:9 and 9:16.
function getVideoAspectRatio(aspectRatio) {
  return aspectRatio === "9:16" ? "9:16" : "16:9";
}

async function createSceneVideo({
  imagePath,
  scene,
  project,
  index,
  job,
}) {
  jobManager.checkCancelled(project._id, job.jobId);

  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(`Scene ${index + 1}: reference image not found`);
  }

  const motionPrompt = `
Create a cinematic luxury perfume commercial video.
Use the supplied reference image as the visual starting point.
Preserve the exact perfume bottle design, label, branding,
colors and the model's appearance.

Scene description:
${scene.sceneText || ""}

Visual direction:
${scene.imagePrompt || ""}

Motion direction:
- Add natural, realistic movement.
- Use smooth cinematic camera movement.
- Add subtle atmospheric particles where appropriate.
- Use premium luxury-product commercial lighting.
- Keep the perfume bottle clearly visible.
- Avoid changing the product label or bottle shape.
- Do not create a slideshow or static zoom effect.
- Generate continuous real motion throughout the clip.
`;

  const result = await generateVideo({
    prompt: motionPrompt.trim().slice(0, 5500),
    reference: fs.readFileSync(imagePath),
    aspectRatio: getVideoAspectRatio(project.aspectRatio),
    duration: 8,
    directory: path.resolve("uploads"),
    signal: job.abortController.signal,
  });

  jobManager.checkCancelled(project._id, job.jobId);

  if (!result?.filePath || !fs.existsSync(result.filePath)) {
    throw new Error(`Scene ${index + 1}: video generation returned no MP4`);
  }

  jobManager.registerTempFile(project._id, result.filePath);

  return result.filePath;
}

export async function runPipeline(projectId, userId) {
  const job = jobManager.startJob({
    projectId,
    userId,
    type: "pipeline",
  });

  const project = await Project.findById(projectId);

  if (!project) {
    jobManager.finishJob(projectId, job.jobId);
    return;
  }

  try {
    project.status = "processing";
    project.errorMessage = "";
    project.generationStage = "Writing advertisement script";
    await project.save();

    jobManager.checkCancelled(projectId, job.jobId);

    // 1. Generate script
    let scenes = project.script;

    if (!scenes || !scenes.length) {
      scenes = await generateScript({
        productName: project.productName,
        description: project.description,
        category: project.category,
        audience: project.audience,
        tone: project.tone || project.style,
        style: project.style,
        duration: project.duration,
        ctaText: project.ctaText,
        aspectRatio: project.aspectRatio,
        language: project.voiceSettings?.language,
        onWarning: recordWarning(project),
        abortSignal: job.abortController.signal,
      });
    }

    jobManager.checkCancelled(projectId, job.jobId);

    // Product and model reference images
    const referenceImagePath = localPath(project.productImageUrl);
    const referenceImagePaths = (project.productImageUrls?.length
      ? project.productImageUrls
      : [project.productImageUrl]).map(localPath);

    const modelImagePath = project.modelImageUrl
      ? localPath(project.modelImageUrl)
      : null;

    const built = [];

    // Phase 1: Generate AND PERSIST every scene still before launching any Veo video.
    for (let i = 0; i < scenes.length; i++) {
      jobManager.checkCancelled(projectId, job.jobId);
      const scene = scenes[i];
      project.generationStage = `Creating scene image ${i + 1} of ${scenes.length}`;
      await project.save();

      let imagePath;
      if (scene.imageUrl && fs.existsSync(localPath(scene.imageUrl))) {
        imagePath = localPath(scene.imageUrl);
      } else {
        imagePath = await generateSceneImage({
          imagePrompt: scene.imagePrompt,
          referenceImagePath,
          referenceImagePaths,
          modelImagePath,
          aspectRatio: project.aspectRatio,
          index: i,
          onWarning: recordWarning(project),
          abortSignal: job.abortController.signal,
          projectId,
        });
        if (!referenceImagePaths.includes(imagePath)) {
          jobManager.registerTempFile(projectId, imagePath);
        }
      }
      jobManager.checkCancelled(projectId, job.jobId);
      scene.imageUrl = publicUrl(imagePath);
      project.script = scenes;
      await project.save();
    }

    // Phase 2: Use the saved scene stills as starting frames for existing Veo clips.
    for (let i = 0; i < scenes.length; i++) {
      jobManager.checkCancelled(projectId, job.jobId);
      const scene = scenes[i];
      const imagePath = localPath(scene.imageUrl);
      project.generationStage = `Generating AI video ${i + 1} of ${scenes.length}`;
      await project.save();

      const videoPath = await createSceneVideo({
        imagePath, scene, project, index: i, job,
      });
      jobManager.checkCancelled(projectId, job.jobId);

      project.generationStage = `Recording narration for scene ${i + 1} of ${scenes.length}`;
      await project.save();

      const audioRes = await generateVoiceOver({
        text: scene.sceneText,
        voiceSettings: project.voiceSettings,
        index: i,
        abortSignal: job.abortController.signal,
        projectId,
      });
      jobManager.registerTempFile(projectId, audioRes.filePath);

      built.push({
        sceneNumber: i + 1,
        sectionType: scene.sectionType || "content",
        sceneText: scene.sceneText,
        imagePrompt: scene.imagePrompt,
        sourceImagePath: imagePath,
        imagePath: videoPath,
        audioPath: audioRes.filePath,
        duration: audioRes.duration,
      });
    }

    jobManager.checkCancelled(projectId, job.jobId);

    // Save original still images in MongoDB
    project.script = built.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      sectionType: scene.sectionType,
      sceneText: scene.sceneText,
      imagePrompt: scene.imagePrompt,
      imageUrl: publicUrl(scene.sourceImagePath),
      audioUrl: publicUrl(scene.audioPath),
      duration: scene.duration,
    }));

    await project.save();

    // 3. Assemble actual MP4 clips with audio and music
    project.generationStage = "Joining AI video clips and mixing music";
    await project.save();

    const finalPath = await assembleVideo({
      scenes: built,
      productName: project.productName,
      tone: project.tone,
      ctaText: project.ctaText,
      aspectRatio: project.aspectRatio,
      projectId,
    });

    if (jobManager.isCancelled(projectId, job.jobId)) {
      fs.rmSync(finalPath, { force: true });
      return;
    }

    const published = await Project.updateOne(
      {
        _id: projectId,
        status: "processing",
      },
      {
        $set: {
          finalVideoUrl: publicUrl(finalPath),
          status: "completed",
          generationStage: "Ready to preview and download",
        },
      }
    );

    if (!published.modifiedCount) {
      fs.rmSync(finalPath, { force: true });
    }
  } catch (err) {
    if (
      jobManager.isCancelled(projectId, job.jobId) ||
      err?.isCancelled ||
      err?.name === "JobCancelledError" ||
      err?.name === "CanceledError" ||
      err?.name === "AbortError"
    ) {
      console.log(`Pipeline cancelled for project ${projectId}`);
      return;
    }

    console.error("Pipeline failed:", err);

    const current = await Project.findById(projectId);

    if (current && current.status === "cancelled") {
      return;
    }

    project.status = "failed";
    project.generationStage = "Generation failed";
    project.errorMessage = err?.message || "Video generation failed";

    await project.save();
  } finally {
    jobManager.finishJob(projectId, job.jobId);
  }
}

export async function renderProjectVideo(projectId, userId) {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.script || !project.script.length) {
    throw new Error("No scenes to render");
  }

  const job = jobManager.startJob({
    projectId,
    userId,
    type: "render",
  });

  project.status = "processing";
  project.errorMessage = "";
  project.generationStage = "Generating AI video clips";
  await project.save();

  try {
    const built = [];

    for (let i = 0; i < project.script.length; i++) {
      jobManager.checkCancelled(projectId, job.jobId);

      const scene = project.script[i];

      const imagePath = scene.imageUrl
        ? localPath(scene.imageUrl)
        : null;

      if (!imagePath || !fs.existsSync(imagePath)) {
        throw new Error(`Scene ${i + 1} image is missing. Regenerate it first.`);
      }

      project.generationStage =
        `Generating AI video ${i + 1} of ${project.script.length}`;
      await project.save();

      const videoPath = await createSceneVideo({
        imagePath,
        scene,
        project,
        index: i,
        job,
      });

      let audioPath = scene.audioUrl
        ? localPath(scene.audioUrl)
        : null;

      if (!audioPath || !fs.existsSync(audioPath)) {
        const audioRes = await generateVoiceOver({
          text: scene.sceneText,
          voiceSettings: project.voiceSettings,
          index: i,
          abortSignal: job.abortController.signal,
          projectId,
        });

        audioPath = audioRes.filePath;
        scene.audioUrl = publicUrl(audioPath);
        scene.duration = audioRes.duration;

        jobManager.registerTempFile(projectId, audioPath);
      }

      built.push({
        sceneText: scene.sceneText,
        imagePath: videoPath,
        audioPath,
        duration: scene.duration,
      });
    }

    jobManager.checkCancelled(projectId, job.jobId);

    project.generationStage = "Joining AI video clips and mixing music";
    await project.save();

    const finalPath = await assembleVideo({
      scenes: built,
      productName: project.productName,
      tone: project.tone,
      ctaText: project.ctaText,
      aspectRatio: project.aspectRatio,
      projectId,
    });

    if (jobManager.isCancelled(projectId, job.jobId)) {
      fs.rmSync(finalPath, { force: true });
      return project;
    }

    const published = await Project.updateOne(
      {
        _id: projectId,
        status: "processing",
      },
      {
        $set: {
          finalVideoUrl: publicUrl(finalPath),
          status: "completed",
          generationStage: "Ready to preview and download",
        },
      }
    );

    if (!published.modifiedCount) {
      fs.rmSync(finalPath, { force: true });
    }

    return project;
  } catch (err) {
    if (
      jobManager.isCancelled(projectId, job.jobId) ||
      err?.isCancelled ||
      err?.name === "JobCancelledError" ||
      err?.name === "CanceledError" ||
      err?.name === "AbortError"
    ) {
      return project;
    }

    console.error("Render failed:", err);

    project.status = "failed";
    project.errorMessage = err?.message || "Re-render failed";
    project.generationStage = "Generation failed";
    await project.save();

    throw err;
  } finally {
    jobManager.finishJob(projectId, job.jobId);
  }
}

export async function regenerateSceneImageOnly(projectId, sceneIndex) {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const idx = Number(sceneIndex);

  if (
    !Number.isInteger(idx) ||
    idx < 0 ||
    idx >= project.script.length
  ) {
    throw new Error("Invalid scene index");
  }

  const scene = project.script[idx];

  const referenceImagePath = localPath(project.productImageUrl);
  const referenceImagePaths = (project.productImageUrls?.length
    ? project.productImageUrls
    : [project.productImageUrl]).map(localPath);

  const modelImagePath = project.modelImageUrl
    ? localPath(project.modelImageUrl)
    : null;

  const imagePath = await generateSceneImage({
    imagePrompt: scene.imagePrompt,
    referenceImagePath,
    referenceImagePaths,
    modelImagePath,
    aspectRatio: project.aspectRatio,
    index: idx,
    onWarning: recordWarning(project),
  });

  scene.imageUrl = publicUrl(imagePath);

  await project.save();

  return scene;
}

export async function regenerateSceneAudioOnly(projectId, sceneIndex) {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const idx = Number(sceneIndex);

  if (
    !Number.isInteger(idx) ||
    idx < 0 ||
    idx >= project.script.length
  ) {
    throw new Error("Invalid scene index");
  }

  const scene = project.script[idx];

  const audioRes = await generateVoiceOver({
    text: scene.sceneText,
    voiceSettings: project.voiceSettings,
    index: idx,
  });

  scene.audioUrl = publicUrl(audioRes.filePath);
  scene.duration = audioRes.duration;

  await project.save();

  return scene;
}
