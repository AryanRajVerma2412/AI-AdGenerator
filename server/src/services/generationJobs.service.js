
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

import Job from '../models/GenerationJob.js';

import {
  requireGeneration,
  validateGeneration,
  problem
} from '../config/gemini.config.js';

import {
  generateImage,
  referencePart
} from './imageGeneration.service.js';

import { generateVideo } from './videoGeneration.service.js';

import {
  estimateCost,
  reserveUsage
} from './usage.service.js';

const active = new Map();

const live = [
  'queued',
  'submitting',
  'running',
  'processing'
];

const directory = path.resolve('generation-output');

// Public job response
export function publicJob(job) {
  return {
    id: job._id,
    operationId: job._id,
    kind: job.kind,
    model: job.model,
    status: job.status,
    providerStatus: job.providerStatus,
    aspectRatio: job.aspectRatio,
    duration: job.duration,
    estimatedUSD: job.estimatedUSD,
    reservedINR: job.reservedINR,
    error: job.error,
    providerHTTPStatus: job.providerHTTPStatus,
    remoteCancellation: job.remoteCancellation,

    previewUrl:
      job.status === 'completed'
        ? `/api/generate/media/${job._id}`
        : undefined,

    downloadUrl:
      job.status === 'completed'
        ? `/api/generate/media/${job._id}/download`
        : undefined
  };
}

// Find job owned by user
export async function ownedJob(id, userId, kind) {
  const job = await Job.findOne({
    _id: id,
    userId,
    ...(kind ? { kind } : {})
  });

  if (!job) {
    throw problem('Generation job not found', 404);
  }

  return job;
}

// Start image or video generation
export async function startGeneration(
  kind,
  userId,
  body,
  reference,
  key
) {
  const config = requireGeneration(kind);
  const input = validateGeneration(kind, body);

  const references = (Array.isArray(reference) ? reference : [reference]).filter(Boolean);
  if (references.length > 5) throw problem('At most 5 reference images are allowed');
  if (kind === 'video' && references.length > 1) {
    throw problem('Video generation supports one starting image');
  }
  references.forEach(referencePart);

  if (
    typeof key !== 'string' ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(key)
  ) {
    throw problem(
      'A unique Idempotency-Key header is required'
    );
  }

  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ kind, ...input }))
    .update(String(references.length));
  for (const image of references) fingerprint.update(image);
  const fingerprintHash = fingerprint.digest('hex');

  const previous = await Job.findOne({
    userId,
    requestKey: key
  });

  if (previous) {
    if (previous.fingerprint !== fingerprintHash) {
      throw problem(
        'This request key belongs to different input',
        409
      );
    }

    return previous;
  }

  const cost = estimateCost(kind, input.duration);

  let job;

  try {
    job = await Job.create({
      _id: randomUUID(),
      userId,
      kind,
      requestKey: key,
      fingerprint: fingerprintHash,
      activeKey: String(userId),
      model: config[`${kind}Model`],
      ...input,
      estimatedUSD: cost.outputUSD,
      reservedINR: cost.reservedINR
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const duplicate = await Job.findOne({
      userId,
      requestKey: key
    });

    if (duplicate?.fingerprint === fingerprintHash) {
      return duplicate;
    }

    throw problem(
      'Another media generation is already active. Wait or cancel it before submitting again.',
      409
    );
  }

  void runJob(job, references);

  return job;
}

// Run or resume generation
async function runJob(job, reference, resume = false) {
  const controller = new AbortController();

  active.set(job._id, controller);

  let output;

  try {
    const claimed = await Job.findOneAndUpdate(
      {
        _id: job._id,
        status: { $in: live }
      },
      {
        $set: { status: 'submitting' }
      }
    );

    if (!claimed) return;

    const options = {
      prompt: job.prompt,
      aspectRatio: job.aspectRatio,
      duration: job.duration,
      reference: Array.isArray(reference) ? reference[0] : reference,
      references: Array.isArray(reference) ? reference : [reference].filter(Boolean),
      signal: controller.signal,
      directory,
      providerId: resume ? job.providerId : undefined
    };

    if (job.kind === 'video') {
      if (!resume) {
        await reserveUsage('video', job.duration);
      }

      output = await generateVideo({
        ...options,

        // Save Vertex AI operation name for recovery.
        onOperation: async providerId => {
          await Job.updateOne(
            { _id: job._id },
            { $set: { providerId } }
          );

          const current = await Job.findById(job._id);

          if (current?.status === 'cancelled') {
            controller.abort();
            await remoteCancel(current);
          }
        },

        // Update job progress.
        onStatus: async providerStatus => {
          const result = await Job.updateOne(
            {
              _id: job._id,
              status: { $in: live }
            },
            {
              $set: {
                providerStatus,
                status:
                  providerStatus === 'completed'
                    ? 'processing'
                    : 'running'
              }
            }
          );

          if (!result.matchedCount) {
            controller.abort();
          }
        }
      });
    } else {
      output = await generateImage(options);
    }

    controller.signal.throwIfAborted();

    // Publish only if job is still active.
    const published = await Job.updateOne(
      {
        _id: job._id,
        status: { $in: live }
      },
      {
        $set: {
          status: 'completed',
          file: path.basename(output.filePath),
          mimeType: output.mimeType,
          usage: output.usage
        },
        $unset: {
          activeKey: 1
        }
      }
    );

    if (!published.modifiedCount) {
      fs.rmSync(output.filePath, { force: true });
    }

  } catch (error) {
    if (output?.filePath) {
      fs.rmSync(output.filePath, { force: true });
    }

    await Job.updateOne(
      {
        _id: job._id,
        status: { $in: live }
      },
      {
        $set: {
          status: controller.signal.aborted
            ? 'cancelled'
            : 'failed',

          error: controller.signal.aborted
            ? 'Cancelled locally. Remote charges may still apply.'
            : error.message,

          providerHTTPStatus: error.providerHTTPStatus
        },

        $unset: {
          activeKey: 1
        }
      }
    ).catch(() => {});

  } finally {
    active.delete(job._id);
  }
}

// Veo remote cancellation is not confirmed by this integration.
// Local cancellation is handled separately.
async function remoteCancel(job) {
  if (!job.providerId) return;

  await Job.updateOne(
    { _id: job._id },
    {
      $set: {
        remoteCancellation: 'not_supported'
      }
    }
  );
}

// Cancel generation locally
export async function cancelGeneration(id, userId) {
  const job = await ownedJob(id, userId);

  if (job.status === 'cancelled') {
    return job;
  }

  const changed = await Job.findOneAndUpdate(
    {
      _id: id,
      userId,
      status: { $in: live }
    },
    {
      $set: {
        status: 'cancelled',
        remoteCancellation: job.providerId
          ? 'not_supported'
          : 'unconfirmed',

        error:
          'Cancelled locally. Remote generation may continue and charges may apply.'
      },

      $unset: {
        activeKey: 1
      }
    },
    { new: true }
  );

  if (!changed) {
    throw problem(
      'This generation is no longer active',
      409
    );
  }

  active.get(id)?.abort();

  void remoteCancel(changed).catch(() => {});

  return changed;
}

// Resolve generated media path
export function mediaPath(job) {
  return path.join(
    directory,
    path.basename(job.file)
  );
}

// Recover jobs after server restart
export async function recoverGenerationJobs() {
  await Job.init();

  const jobs = await Job.find({
    status: { $in: live }
  });

  for (const job of jobs) {
    if (job.kind === 'video' && job.providerId) {
      // Resume existing Veo operation. Do not submit a new request.
      void runJob(job, undefined, true);
    } else {
      await Job.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'interrupted',

            error:
              'Server restarted before a recoverable operation was recorded. Remote charges are uncertain; no request was resubmitted.'
          },

          $unset: {
            activeKey: 1
          }
        }
      );
    }
  }
}
