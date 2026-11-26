import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { saveSpeechStream } from "../src/services/speechStream.js";

for (const scenario of ["success", "error", "stalled", "handshake", "empty", "cancelled"]) {
  test(`speech stream: ${scenario}`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "adgen-speech-"));
    const file = path.join(dir, "audio.mp3");
    let closed = false;
    const tts = {
      setMetadata: () => scenario === "handshake" ? new Promise(() => {}) : Promise.resolve(),
      toStream: () => ({ audioStream: scenario === "success" ? Readable.from([Buffer.from("audio")])
        : scenario === "empty" ? Readable.from([])
        : new Readable({ read() { if (scenario === "error") this.destroy(new Error("provider disconnected")); } }) }),
      close: () => { closed = true; },
    };
    try {
      const controller = new AbortController();
      const result = saveSpeechStream(tts, "voice", "format", "hello", file, 100, controller.signal);
      if (scenario === 'cancelled') controller.abort();
      if (scenario === "success") {
        await result;
        assert.equal(await fs.readFile(file, "utf8"), "audio");
      } else {
        await assert.rejects(result, /disconnected|timed out|empty audio|cancelled/);
      }
      assert.equal(closed, true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}
