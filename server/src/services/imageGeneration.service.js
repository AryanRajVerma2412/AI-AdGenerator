
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  requireGeneration,
  validateGeneration,
  problem
} from '../config/gemini.config.js';

import { imagePrompt } from './generationPrompts.js';
import { reserveUsage } from './usage.service.js';
import { providerError } from './googleInteractions.js';

// Validate and convert an image buffer into Gemini inline data
export function referencePart(buffer) {
  if (!buffer || buffer.length > 8 * 1024 * 1024) {
    throw problem('Reference image must be under 8 MB');
  }

  let mimeType;

  // PNG
  if (
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    mimeType = 'image/png';
  }

  // JPEG
  else if (
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  ) {
    mimeType = 'image/jpeg';
  }

  // WEBP
  else if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    mimeType = 'image/webp';
  }

  else {
    throw problem(
      'Reference must contain a JPEG, PNG or WebP image'
    );
  }

  return {
    mimeType,
    data: buffer.toString('base64')
  };
}

export async function generateImage(options, dependencies = {}) {
  const c = requireGeneration('image');

  const { prompt, aspectRatio } = validateGeneration(
    'image',
    options
  );

  options.signal?.throwIfAborted();

  // Main prompt
  const parts = [
    {
      text: imagePrompt(
        prompt,
        aspectRatio,
        options.scene
      )
    }
  ];

  // Support multiple reference images:
  // 1. Product image
  // 2. Model image
  if (Array.isArray(options.references) && options.references.length > 0) {
    for (const reference of options.references) {
      if (reference) {
        parts.push({
          inlineData: referencePart(reference)
        });
      }
    }
  }

  // Backward compatibility with existing single reference calls
  else if (options.reference) {
    parts.push({
      inlineData: referencePart(options.reference)
    });
  }

  // Reserve usage
  const cost = await (
    dependencies.reserve || reserveUsage
  )('image');

  options.signal?.throwIfAborted();

  // Initialize Google AI
  const ai =
    dependencies.client ||
    new GoogleGenAI({
      apiKey: c.apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        retryOptions: {
          attempts: 1
        }
      }
    });

  let result;

  try {
    result = await ai.models.generateContent({
      model: c.imageModel,

      contents: [
        {
          role: 'user',
          parts
        }
      ],

      config: {
        responseModalities: ['TEXT', 'IMAGE'],

        imageConfig: {
          aspectRatio,
          imageSize: '1K'
        },

        candidateCount: 1,
        maxOutputTokens: 4096,
        abortSignal: options.signal,

        httpOptions: {
          timeout: 120000
        }
      }
    });
  }

  catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    throw providerError(error);
  }

  options.signal?.throwIfAborted();

  // Extract generated image
  const media =
    result.candidates?.[0]?.content?.parts?.find(
      (part) =>
        !part.thought &&
        part.inlineData?.mimeType?.startsWith('image/')
    )?.inlineData;

  if (!media?.data) {
    const reason =
      result.candidates?.[0]?.finishReason ||
      result.promptFeedback?.blockReason ||
      'empty output';

    throw problem(
      `Google returned no image (${reason}). No fallback was generated.`,
      502
    );
  }

  // Convert generated image into buffer
  const bytes = Buffer.from(
    media.data,
    'base64'
  );

  // Validate generated image
  const checked = referencePart(bytes);

  const ext = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
  }[checked.mimeType];

  // Save generated image
  const directory =
    options.directory || path.resolve('uploads');

  fs.mkdirSync(directory, {
    recursive: true
  });

  const filePath = path.join(
    directory,
    `generated-${randomUUID()}.${ext}`
  );

  fs.writeFileSync(filePath, bytes, {
    flag: 'wx'
  });

  return {
    filePath,
    mimeType: checked.mimeType,
    usage: result.usageMetadata,
    ...cost
  };
}
