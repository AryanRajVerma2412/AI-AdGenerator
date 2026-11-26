import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateImage, referencePart } from '../src/services/imageGeneration.service.js';
import { geminiConfig } from '../src/config/gemini.config.js';

const png = Buffer.from('89504e470d0a1a0a', 'hex');
const jpg = Buffer.from('ffd8ff', 'hex');
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

test('Gemini sends all five distinct product references to each image request', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only-key';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp26-refs-'));
  let sent;
  try {
    const references = [png, jpg, webp, png, jpg];
    const output = await generateImage({
      prompt: 'Product scene', aspectRatio: '9:16', references, directory
    }, {
      reserve: async () => ({}),
      client: { models: { generateContent: async request => {
        sent = request;
        return { candidates: [{ content: { parts: [
          { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }
        ] } }] };
      } } }
    });
    const parts = sent.contents[0].parts;
    assert.equal(parts.length, 6);
    assert.deepEqual(parts.slice(1).map(p => p.inlineData.mimeType),
      ['image/png', 'image/jpeg', 'image/webp', 'image/png', 'image/jpeg']);
    assert.equal(sent.model, geminiConfig().imageModel);
    assert.ok(fs.existsSync(output.filePath));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('invalid signatures and oversize references are rejected', () => {
  assert.throws(() => referencePart(Buffer.from('not an image')), /JPEG, PNG or WebP/);
  assert.throws(() => referencePart(Buffer.alloc(8 * 1024 * 1024 + 1)), /under 8 MB/);
});

test('model selection remains environment-controlled', () => {
  const config = geminiConfig({
    IMAGE_MODEL: 'existing-image-model-config',
    VIDEO_MODEL: 'existing-video-model-config',
  });
  assert.equal(config.imageModel, 'existing-image-model-config');
  assert.equal(config.videoModel, 'existing-video-model-config');
});
