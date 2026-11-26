
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffprobe from '@ffprobe-installer/ffprobe';
import { setTimeout as delay } from 'node:timers/promises';
import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';

import {
  geminiConfig,
  requireGeneration,
  validateGeneration,
  problem
} from '../config/gemini.config.js';

import { referencePart } from './imageGeneration.service.js';
import { videoPrompt } from './generationPrompts.js';

const execute = promisify(execFile);


let vertexClient;
let storageClient;

function getVertexClient(config) {
  if (!vertexClient) {
    vertexClient = new GoogleGenAI({
      vertexai: true,
      project: config.googleCloudProject,
      location: config.googleCloudLocation
    });
  }

  return vertexClient;
}

function getStorageClient() {
  if (!storageClient) {
    storageClient = new Storage();
  }

  return storageClient;
}

// Convert gs:// URI into bucket and object path.
function parseGcsUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('gs://')) {
    throw problem('Veo did not return a valid Google Cloud Storage URI.', 502);
  }

  const value = uri.slice(5);
  const slash = value.indexOf('/');

  if (slash < 1 || slash === value.length - 1) {
    throw problem('Invalid generated video GCS path.', 502);
  }

  return {
    bucket: value.slice(0, slash),
    object: value.slice(slash + 1)
  };
}

// Build Vertex AI Veo request.
export function videoRequest(options) {
  const config = requireGeneration('video');
  const data = validateGeneration('video', options);

  const request = {
    model: config.videoModel,
    prompt: videoPrompt(
      data.prompt,
      data.duration,
      data.aspectRatio
    ),
    config: {
      numberOfVideos: 1,
      durationSeconds: data.duration,
      aspectRatio: data.aspectRatio,
      resolution: data.resolution,
      outputGcsUri: config.videoOutputGcsUri,
      generateAudio: false
    }
  };

  if (options.reference) {
    const part = referencePart(options.reference);

    request.image = {
      imageBytes: part.data,
      mimeType: part.mimeType
    };
  }

  return request;
}

// Verify generated video using FFprobe.
export async function verifyVideo(file, aspectRatio) {
  const { stdout } = await execute(
    process.env.FFPROBE_PATH || ffprobe.path,
    [
      '-v', 'error',
      '-show_streams',
      '-show_format',
      '-of', 'json',
      file
    ],
    { windowsHide: true }
  );

  const metadata = JSON.parse(stdout);

  const video = metadata.streams.find(
    stream => stream.codec_type === 'video'
  );

  const expected =
    aspectRatio === '9:16'
      ? [720, 1280]
      : [1280, 720];

  if (
    !video ||
    video.width !== expected[0] ||
    video.height !== expected[1]
  ) {
    throw problem(
      'Veo output is not the requested 720p aspect ratio.',
      502
    );
  }

  return {
    width: video.width,
    height: video.height,
    duration: Number(metadata.format.duration),
    audio: metadata.streams.some(
      stream => stream.codec_type === 'audio'
    )
  };
}

// Retry temporary polling failures without creating another generation.
async function retrieveOperation(client, operation, signal, wait) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.operations.getVideosOperation({
        operation
      });
    } catch (error) {
      if (
        signal?.aborted ||
        attempt >= 3 ||
        ![429, 500, 502, 503, 504].includes(
          Number(error.status || error.code)
        )
      ) {
        throw error;
      }

      await wait(
        Math.min(60000, 10000 * 2 ** attempt),
        undefined,
        { signal }
      );
    }
  }
}

// Download generated video from GCS to local uploads.
async function downloadGeneratedVideo(uri, destination, signal) {
  signal?.throwIfAborted();

  const { bucket, object } = parseGcsUri(uri);

  await getStorageClient()
    .bucket(bucket)
    .file(object)
    .download({
      destination,
      validation: 'crc32c'
    });

  signal?.throwIfAborted();

  if (!fs.existsSync(destination) || fs.statSync(destination).size === 0) {
    throw problem('Downloaded video is empty.', 502);
  }
}

// Generate video using Vertex AI Veo.
export async function generateVideo(options, dependencies = {}) {
  const config = requireGeneration('video');
  const validated = validateGeneration('video', options);

  const client = dependencies.client || getVertexClient(config);
  const wait = dependencies.delay || delay;
  const signal = options.signal;

  signal?.throwIfAborted();

  let operation;

  // Resume existing operation instead of submitting another request.
  if (options.providerId) {
    operation = await retrieveOperation(
      client,
      { name: options.providerId },
      signal,
      wait
    );
  } else {
    operation = await client.models.generateVideos(
      videoRequest(options)
    );
  }

  if (!operation?.name) {
    throw problem(
      'Vertex AI did not return an operation name. No replacement request was submitted.',
      502
    );
  }

  await options.onOperation?.(operation.name);

  const deadline = Date.now() + 20 * 60 * 1000;

  while (!operation.done) {
    signal?.throwIfAborted();

    await options.onStatus?.(
      operation.metadata?.state || 'running'
    );

    if (Date.now() > deadline) {
      throw problem(
        'Veo polling timed out. Remote generation may continue; no replacement request was submitted.',
        504
      );
    }

    await wait(15000, undefined, { signal });

    operation = await retrieveOperation(
      client,
      operation,
      signal,
      wait
    );
  }

  signal?.throwIfAborted();

  if (operation.error) {
    const message =
      operation.error.message ||
      JSON.stringify(operation.error);

    throw problem(`Veo generation failed: ${message}`, 502);
  }

  const generatedVideo =
    operation.response?.generatedVideos?.[0]?.video;

  if (!generatedVideo?.uri) {
    throw problem(
      'Veo completed without a generated video GCS URI.',
      502
    );
  }

  const directory =
    options.directory || path.resolve('uploads');

  fs.mkdirSync(directory, { recursive: true });

  const filePath = path.join(
    directory,
    `generated-${randomUUID()}.mp4`
  );

  try {
    await (
      dependencies.download || downloadGeneratedVideo
    )(generatedVideo.uri, filePath, signal);

    const metadata = await (
      dependencies.verify || verifyVideo
    )(filePath, validated.aspectRatio);

    signal?.throwIfAborted();

    return {
      filePath,
      mimeType: 'video/mp4',
      usage: operation.response?.usageMetadata || null,
      metadata
    };
  } catch (error) {
    fs.rmSync(filePath, { force: true });
    throw error;
  }
}
