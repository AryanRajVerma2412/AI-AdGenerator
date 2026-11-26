import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { generateScript } from "../src/services/scriptService.js";

test("Gemini scene contract rejects incomplete output and reports fallback", async () => {
  const oldPost = axios.post;
  const oldKey = process.env.GEMINI_API_KEY;
  const warnings = [];
  process.env.GEMINI_API_KEY = "test-key";
  axios.post = async (url, body, options) => {
    assert.equal(body.generationConfig.responseSchema.properties.scenes.minItems, 3);
    assert.equal(options.headers["x-goog-api-key"], "test-key");
    assert.ok(!url.includes("test-key"));
    return { data: { candidates: [{ content: { parts: [{ text: JSON.stringify({ scenes: [{ sceneText: "" }] }) }] } }] } };
  };
  try {
    const scenes = await generateScript({ productName: "Test", description: "Blue cotton shirt", duration: 15, onWarning: w => warnings.push(w) }, { reserve: async () => ({}) });
    assert.equal(scenes.length, 3);
    assert.ok(scenes.every(s => s.sceneText && s.imagePrompt && s.duration > 0));
    assert.match(warnings[0], /local draft/);
  } finally {
    axios.post = oldPost;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
