import fs from "node:fs";
import { pipeline } from "node:stream/promises";

// Bound both the WebSocket handshake and audio transfer. Stream errors must
// reject the request so the caller can try the next speech provider.
export async function saveSpeechStream(tts, voice, format, text, outputPath, timeoutMs = 30000, signal) {
  let timer;
  let audioStream;
  let expired = false;
  const controller = new AbortController();
  let onAbort;
  try {
    await Promise.race([
      new Promise((_, reject) => {
        onAbort = () => { expired = true; controller.abort(); reject(new Error('Speech generation cancelled')); };
        if (signal?.aborted) onAbort();
        else signal?.addEventListener('abort', onAbort, { once: true });
      }),
      (async () => {
        await tts.setMetadata(voice, format);
        if (expired) return;
        ({ audioStream } = tts.toStream(text));
        await pipeline(audioStream, fs.createWriteStream(outputPath), { signal: controller.signal });
        if (!fs.statSync(outputPath).size) throw new Error("Speech provider returned empty audio");
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("Speech generation timed out"));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    clearTimeout(timer);
    audioStream?.destroy();
    tts.close();
  }
}
