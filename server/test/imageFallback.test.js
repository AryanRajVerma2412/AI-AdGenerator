import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateSceneImage } from "../src/services/imageService.js";

test("disabled image generation explicitly reports the existing local composition", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousEnabled = process.env.IMAGE_GENERATION_ENABLED;
  let image;
  const warnings = [];
  const reference = `uploads/test-reference-${Date.now()}.ppm`;
  fs.writeFileSync(reference, 'P3\n2 2\n255\n255 0 0 0 255 0 0 0 255 255 255 255\n');
  process.env.GEMINI_API_KEY = "test-key";
  process.env.IMAGE_GENERATION_ENABLED = 'false';
  try {
    image = await generateSceneImage({ imagePrompt: "Product", referenceImagePath: reference, aspectRatio: "1:1", onWarning: (message) => warnings.push(message) });
    assert.match(warnings[0], /disabled/);
    assert.ok(fs.statSync(image).size > 0);
  } finally {
    if (previousEnabled === undefined) delete process.env.IMAGE_GENERATION_ENABLED;
    else process.env.IMAGE_GENERATION_ENABLED = previousEnabled;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (image) fs.unlinkSync(image);
    fs.unlinkSync(reference);
  }
});
