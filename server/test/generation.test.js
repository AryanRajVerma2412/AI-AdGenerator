import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { geminiConfig, validateGeneration } from '../src/config/gemini.config.js';
import { generateImage, referencePart } from '../src/services/imageGeneration.service.js';
import { generateVideo, videoRequest } from '../src/services/videoGeneration.service.js';
import { outputMedia, providerError } from '../src/services/googleInteractions.js';
import { estimateCost } from '../src/services/usage.service.js';
test('zero free-tier quota errors produce stable actionable warnings', () => {
  const messages = ['20h56m49s', '20h56m40s'].map(delay => providerError({
    status: 429,
    message: JSON.stringify({ error: { message: `Quota exceeded for generate_content_free_tier_requests, limit: 0. Please retry in ${delay}.` } }),
  }));
  assert.equal(messages[0].message, messages[1].message);
  assert.match(messages[0].message, /zero free-tier quota/);
  assert.match(messages[0].message, /Enable billing/);
  assert.equal(messages[0].providerHTTPStatus, 429);
  assert.equal(providerError({ response: { status: 403, data: { error: { message: 'Access denied' } } } }).message, 'Google API (403): Access denied');
});
test('configuration fails closed on unsupported resolution, model, flags and durations', () => {
  for (const env of [{ VIDEO_RESOLUTION: '1080p' }, { VIDEO_MODEL: 'unknown' }, { IMAGE_GENERATION_ENABLED: 'yes' }, { VIDEO_DEFAULT_DURATION: '2' }]) assert.throws(() => geminiConfig(env));
  assert.equal(geminiConfig({}).duration, 8);
  assert.throws(() => validateGeneration('video', { prompt: 'x', aspectRatio: '1:1' }));
  assert.throws(() => validateGeneration('video', { prompt: 'x', duration: 3.5 }));
  assert.throws(() => validateGeneration('image', { prompt: '' }));
  assert.ok(estimateCost('video', 8).reservedINR > estimateCost('video', 3).reservedINR);
});
test('reference validation rejects claimed images containing other data', () => {
  assert.throws(() => referencePart(Buffer.from('<svg>bad</svg>')), /JPEG/);
});
test('REST extraction only reads final model video blocks', () => {
  const good = { type: 'video', mime_type: 'video/mp4', data: 'abc' };
  assert.equal(outputMedia({ steps: [{ type: 'user_input', content: [good] }] }, 'video'), undefined);
  assert.equal(outputMedia({ steps: [{ type: 'model_output', content: [good] }] }, 'video'), good);
});
test('image service sends model and aspect config, saves MIME correctly, and rejects empty output', async () => {
  const key = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'unit-test';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'generation-image-'));
  let received;
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  const client = { models: { generateContent: async args => { received = args; return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }; } } };
  try {
    const result = await generateImage({ prompt: 'Mug', aspectRatio: '4:5', directory }, { client, reserve: async () => ({}) });
    assert.equal(received.model, 'gemini-3.1-flash-image'); assert.equal(received.config.imageConfig.aspectRatio, '4:5');
    assert.ok(fs.existsSync(result.filePath)); assert.equal(result.mimeType, 'image/png');
    client.models.generateContent = async () => ({});
    await assert.rejects(generateImage({ prompt: 'Mug', directory }, { client, reserve: async () => ({}) }), /no image/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key; }
});
test('video polls one interaction, enforces 720p and cleans rejected outputs', async () => {
  const key = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'unit-test';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'generation-video-'));
  let posts = 0, gets = 0;
  const api = { create: async body => { posts++; assert.equal(body.response_format.resolution, '720p'); assert.equal(body.response_format.duration, '3s'); return { id: 'test-id', status: 'in_progress' }; },
    get: async id => { gets++; assert.equal(id, 'test-id'); return { id, status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: Buffer.from('test-only-bytes').toString('base64') }] }] }; } };
  try {
    await assert.rejects(generateVideo({ prompt: 'Mug', duration: 3, aspectRatio: '16:9', directory }, { api, delay: async () => {}, verify: async () => { throw new Error('wrong resolution'); } }), /wrong resolution/);
    assert.equal(posts, 1); assert.equal(gets, 1); assert.deepEqual(fs.readdirSync(directory), []);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(generateVideo({ prompt: 'Mug', signal: controller.signal }, { api })); assert.equal(posts, 1);
    const body = videoRequest({ prompt: 'Mug', duration: 8, aspectRatio: '9:16', reference: Buffer.from([137,80,78,71,13,10,26,10]) });
    assert.equal(body.input[1].type, 'image'); assert.equal(body.model, 'gemini-omni-1.2-flash');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key; }
});
test('video reports asynchronous quota failures and verifies the default landscape ratio', async () => {
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'unit-test';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'video-default-'));
  try {
    const api = { create: async () => ({ id: 'quota', status: 'failed', errors: [{ code: 'RESOURCE_EXHAUSTED', message: 'Capacity exhausted' }] }) };
    await assert.rejects(generateVideo({ prompt: 'Mug' }, { api }), error => error.status === 429 && error.providerHTTPStatus === 429);
    api.create = async () => ({ id: 'done', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: Buffer.from('fixture').toString('base64') }] }] });
    await generateVideo({ prompt: 'Mug', directory }, { api, verify: async (_file, ratio) => { assert.equal(ratio, '16:9'); return {}; } });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  }
});
