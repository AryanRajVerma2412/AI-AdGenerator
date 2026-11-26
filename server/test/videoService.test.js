import test from "node:test";
import assert from "node:assert/strict";
import { captionPhrases, assembleVideo } from "../src/services/videoService.js";

test("captions retain punctuation and all narration within bounded phrases", () => {
  const text = "It's 20% off: sound, style & comfort. Find your rhythm today!";
  const phrases = captionPhrases(text, 24);
  assert.equal(phrases.join(" "), text);
  assert.ok(phrases.every(p => p.length <= 24 && p.split(" ").length <= 5));
});
test("long words fit and empty captions are supported", () => {
  const word = "a".repeat(100);
  assert.equal(captionPhrases(word, 20).join(""), word);
  assert.ok(captionPhrases(word, 20).every(p => p.length <= 20));
  assert.deepEqual(captionPhrases(""), []);
});
test("empty render fails before starting FFmpeg", async () => {
  await assert.rejects(assembleVideo({ scenes: [] }), /At least one scene/);
});
