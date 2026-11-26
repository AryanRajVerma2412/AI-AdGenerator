import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeAmbientMusic } from '../src/services/musicService.js';
import { adjustSpeedIfNeeded, getAudioDuration } from '../src/services/ttsService.js';
test('speech speed conversion runs FFmpeg without an undefined projectId', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'adgen-speed-'));
  try {
    const source = writeAmbientMusic(path.join(directory, 'source.wav'), 4);
    const output = path.join(directory, 'fast.mp3');
    await adjustSpeedIfNeeded(source, output, 1.5);
    const duration = await getAudioDuration(output);
    assert.ok(duration > 2.4 && duration < 3.0, `Unexpected sped-up duration: ${duration}`);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
