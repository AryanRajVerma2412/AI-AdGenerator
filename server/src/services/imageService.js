
import { generateImage } from "./imageGeneration.service.js";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { jobManager, JobCancelledError } from "./jobManager.js";

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);

const uploadDir = path.resolve("uploads");

const ASPECT_RATIO_DIMENSIONS = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

/**
 * Creates a fallback studio scene from the product image.
 * Used when AI image generation is unavailable.
 */
async function compositeSceneFrame({
  referenceImagePath,
  aspectRatio = "9:16",
  index = 0,
  projectId
}) {
  if (projectId) jobManager.checkCancelled(projectId);

  const dims =
    ASPECT_RATIO_DIMENSIONS[aspectRatio] ||
    ASPECT_RATIO_DIMENSIONS["9:16"];

  const productScale = [0.80, 0.92, 0.70, 0.84][index % 4];

  const outPath = path.join(
    uploadDir,
    `scene-${Date.now()}-${index}.png`
  );

  return new Promise((resolve, reject) => {
    const isVideo = /\.(mp4|webm|mov|mkv|avi|ogg)$/i.test(
      referenceImagePath
    );

    const inputOptions = isVideo ? ["-ss 00:00:01"] : [];

    const filter = [
      `[0:v]split=2[bg][fg]`,

      `[bg]scale=${dims.width}:${dims.height}:force_original_aspect_ratio=increase,crop=${dims.width}:${dims.height},gblur=sigma=40,eq=brightness=-0.38[blurred]`,

      `[fg]scale=${Math.round(dims.width * productScale)}:${Math.round(dims.height * 0.56)}:force_original_aspect_ratio=decrease,eq=contrast=1.03:saturation=1.04[product]`,

      `[blurred][product]overlay=(W-w)/2:H*0.44-h/2:format=auto,format=yuv420p`
    ].join(";");

    const cmd = ffmpeg()
      .input(referenceImagePath)
      .inputOptions(inputOptions)
      .complexFilter(filter)
      .outputOptions(["-vframes 1"])
      .output(outPath);

    let unregister = () => {};

    if (projectId) {
      unregister = jobManager.registerProcess(projectId, cmd);
    }

    cmd.on("end", () => {
      unregister();
      resolve(outPath);
    });

    cmd.on("error", (err) => {
      unregister();

      if (projectId && jobManager.isCancelled(projectId)) {
        return reject(new JobCancelledError());
      }

      console.warn("FFmpeg composition failed:", err.message);

      const fallbackCmd = ffmpeg()
        .input(referenceImagePath)
        .inputOptions(inputOptions)
        .videoFilters([
          `scale=${dims.width}:${dims.height}:force_original_aspect_ratio=increase`,
          `crop=${dims.width}:${dims.height}`,
          "format=yuv420p"
        ])
        .outputOptions(["-vframes 1"])
        .output(outPath);

      let unregisterFallback = () => {};

      if (projectId) {
        unregisterFallback = jobManager.registerProcess(
          projectId,
          fallbackCmd
        );
      }

      fallbackCmd
        .on("end", () => {
          unregisterFallback();
          resolve(outPath);
        })
        .on("error", (e) => {
          unregisterFallback();
          reject(e);
        })
        .run();
    });

    cmd.run();
  });
}

/**
 * Generates one advertising scene using:
 * 1. Product image
 * 2. Model image (optional)
 *
 * Both images are sent to Gemini as references.
 */
export async function generateSceneImage({
  imagePrompt,
  referenceImagePath,
  referenceImagePaths,
  modelImagePath,
  aspectRatio = "9:16",
  index = 0,
  onWarning = () => {},
  abortSignal,
  projectId
}) {
  if (
    abortSignal?.aborted ||
    (projectId && jobManager.isCancelled(projectId))
  ) {
    throw new JobCancelledError();
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Reuse uploaded video footage directly.
  if (
    referenceImagePath &&
    /\.(mp4|webm|mov|mkv|avi|ogg)$/i.test(referenceImagePath) &&
    fs.existsSync(referenceImagePath)
  ) {
    return referenceImagePath;
  }

  // Each scene sees the complete ordered set of original product photographs.
  const productPaths = referenceImagePaths?.length
    ? referenceImagePaths
    : [referenceImagePath].filter(Boolean);
  const references = productPaths.map(file => {
    if (!fs.existsSync(file)) throw new Error(`Product reference image missing: ${path.basename(file)}`);
    return fs.readFileSync(file);
  });
  if (modelImagePath) {
    if (!fs.existsSync(modelImagePath)) throw new Error("Model reference image missing");
    references.push(fs.readFileSync(modelImagePath));
  }

  // Generate combined advertising image.
  if (
    apiKey &&
    process.env.IMAGE_GENERATION_ENABLED !== "false"
  ) {
    try {
      const combinedPrompt = `
Create a professional commercial advertising image.

REFERENCE IMAGE INSTRUCTIONS:

The first ${productPaths.length} image(s) show THE SAME EXACT PRODUCT from different
angles or under different lighting. Treat them as one product identity,
not separate products or alternatives. Use all views to preserve the exact
logo, lettering, label layout, packaging, silhouette, shape, surface texture,
finish, material, color and proportions. Do not recolor, reshape, replace,
mirror branding, duplicate, or invent parts. When angles differ,
reconstruct the same physical product consistently across every scene.

${modelImagePath ? `Reference image ${productPaths.length + 1} is a MODEL / PERSON.
Preserve their appearance, facial identity and clothing.` : 'No model image was supplied; do not invent a specific reference person.'}

COMPOSITION:

Show the model naturally holding or interacting
with the exact product.

The product must be clearly visible.
The model and product should appear naturally
together in the same realistic scene.

Use premium studio lighting,
cinematic photography,
realistic shadows,
professional advertising composition
and high-quality commercial styling.

Do not invent a different product.
Do not change product branding.
Do not add unrelated objects.

${imagePrompt}

Aspect ratio: ${aspectRatio}.
`;

      const result = await generateImage({
        prompt: combinedPrompt,
        aspectRatio,
        scene: true,
        references,
        signal: abortSignal
      });

      if (
        projectId &&
        jobManager.isCancelled(projectId)
      ) {
        fs.rmSync(result.filePath, { force: true });
        throw new JobCancelledError();
      }

      return result.filePath;

    } catch (err) {
      if (
        abortSignal?.aborted ||
        err.isCancelled ||
        (projectId && jobManager.isCancelled(projectId))
      ) {
        throw new JobCancelledError();
      }

      onWarning(
        `AI image generation failed. ${err.message} Using product fallback composition.`
      );
    }
  } else {
    onWarning(
      "AI image generation is disabled or unconfigured. Using product fallback."
    );
  }

  // Fallback: use product image.
  if (
    !referenceImagePath ||
    !fs.existsSync(referenceImagePath)
  ) {
    throw new Error(
      "No AI image was generated and product reference is missing."
    );
  }

  return compositeSceneFrame({
    referenceImagePath,
    aspectRatio,
    index,
    projectId
  });
}
