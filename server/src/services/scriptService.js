import axios from "axios";
import { JobCancelledError } from "./jobManager.js";
import { reserveUsage } from './usage.service.js';

/**
 * Calculates optimal scene count and breakdown based on video duration in seconds.
 */
export function getSceneConfig(durationSeconds = 30) {
  const d = Number(durationSeconds) || 30;
  if (d <= 15) {
    return {
      sceneCount: 3,
      structure: [
        { sectionType: "hook", targetSeconds: 4 },
        { sectionType: "benefit", targetSeconds: 6 },
        { sectionType: "cta", targetSeconds: 5 },
      ],
    };
  }
  if (d <= 30) {
    return {
      sceneCount: 4,
      structure: [
        { sectionType: "hook", targetSeconds: 6 },
        { sectionType: "content", targetSeconds: 8 },
        { sectionType: "benefit", targetSeconds: 8 },
        { sectionType: "cta", targetSeconds: 8 },
      ],
    };
  }
  if (d <= 45) {
    return {
      sceneCount: 6,
      structure: [
        { sectionType: "hook", targetSeconds: 6 },
        { sectionType: "content", targetSeconds: 8 },
        { sectionType: "benefit", targetSeconds: 8 },
        { sectionType: "content", targetSeconds: 8 },
        { sectionType: "benefit", targetSeconds: 8 },
        { sectionType: "cta", targetSeconds: 7 },
      ],
    };
  }
  // 60 seconds
  return {
    sceneCount: 8,
    structure: [
      { sectionType: "hook", targetSeconds: 6 },
      { sectionType: "content", targetSeconds: 8 },
      { sectionType: "content", targetSeconds: 8 },
      { sectionType: "benefit", targetSeconds: 8 },
      { sectionType: "benefit", targetSeconds: 8 },
      { sectionType: "benefit", targetSeconds: 8 },
      { sectionType: "content", targetSeconds: 7 },
      { sectionType: "cta", targetSeconds: 7 },
    ],
  };
}

/**
 * Fallback script generator if Gemini text model is unavailable or rate limited.
 */
function generateFallbackScript(config) {
  const { sceneCount, structure } = getSceneConfig(config.duration);
  const name = config.productName || "our product";
  const cat = config.category || "General";
  const tone = config.tone || "Professional";
  const cta = config.ctaText || "Shop now";
  const facts = String(config.description || "").split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);

  const templates = {
    hook: [
      `Meet ${name}. Take a closer look.`,
      `Your next discovery: ${name}.`,
      `Get to know ${name}.`,
    ],
    content: [
      facts[0] || `Explore ${name} in detail.`,
      facts[1] || facts[0] || `Take a closer look at ${name}.`,
      facts[2] || facts[0] || `See whether ${name} is right for you.`,
    ],
    benefit: [
      facts[1] || facts[0] || `Discover what ${name} has to offer.`,
      facts[2] || facts[0] || `Explore the details of ${name}.`,
      facts[0] || `Make ${name} part of your next discovery.`,
    ],
    cta: [
      `${cta}. Discover ${name} today.`,
      `${name}. ${cta}.`,
      `${cta}.`,
    ],
  };

  return structure.map((st, idx) => {
    const list = templates[st.sectionType] || templates.content;
    const sceneText = list[idx % list.length];
    return {
      sceneNumber: idx + 1,
      sectionType: st.sectionType,
      sceneText,
      imagePrompt: `${['Wide three-quarter view', 'Close-up material detail', 'Eye-level view in a plausible use setting', 'Clean front-facing hero composition'][idx % 4]} of ${name}. Category: ${cat}; mood: ${tone}. Preserve reference shape and colors, use soft directional light, realistic surface texture and a restrained matching palette. Keep the subject above the lower caption area in ${config.aspectRatio || '9:16'} framing.`,
      duration: st.targetSeconds,
    };
  });
}

/**
 * Generates an advertising script split into structured scenes.
 * Structure includes Hook, Main Content, Benefits, and Call To Action (CTA).
 */
export async function generateScript(config, dependencies = {}) {
  const { sceneCount, structure } = getSceneConfig(config.duration);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    config.onWarning?.("Gemini is not configured. A local draft script was used.");
    console.warn("GEMINI_API_KEY is not set, generating intelligent fallback script.");
    return generateFallbackScript(config);
  }

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const prompt = `You are a world-class advertising creative director and scriptwriter.
Write an engaging commercial video script for an advertisement video of target duration: ${config.duration || 30} seconds.

Product Name: ${config.productName}
Product Category: ${config.category || "General Retail"}
Product Description & Selling Points: ${config.description}
Target Audience: ${config.audience}
Tone: ${config.tone || config.style || "Professional"}
Call To Action (CTA): ${config.ctaText}
Aspect Ratio: ${config.aspectRatio || "9:16"}
Narration language: ${config.language || "en"}

Requirements:
- Exactly ${sceneCount} scenes.
- The structure must clearly follow:
  1. Hook (grabs immediate attention in the first 3-5 seconds).
  2. Main Content / Problem & Solution presentation.
  3. Key Benefits / Value Proposition / Emotional appeal.
  4. Call To Action (the final scene must deliver the CTA: "${config.ctaText}").
- Use this ordered timing plan: ${JSON.stringify(structure)}. Keep total planned duration at ${config.duration || 30} seconds.
- Each "sceneText" is spoken narration only: no speaker labels, stage directions or pronunciation notes that would be read aloud. Aim for roughly 2 words per second of scene duration; use shorter sentences for reflective tones. Spell out ambiguous abbreviations when useful, without altering product names. Use natural punctuation for pauses.
- Each "imagePrompt" must be a vivid, photorealistic scene description for an image generator (no text or logos in the image prompt, describe camera angle, lighting, background, and product placement).
- Give each scene a distinct visual purpose: wide hero reveal, close-up detail, believable use context, then a clean product hero. Preserve the reference product's appearance. Reserve the bottom quarter for captions.
- Describe a single visible moment per image, not a montage or camera movement. Specify subject position, framing, environment, lighting and a consistent color palette. Repeat only essential identity details (product colors/materials; recurring person's appearance and wardrobe) across scenes. Each visual must demonstrate the same fact as its narration. Avoid introducing people unless useful to the brief.
- Lead with a concrete product-specific hook. Use only facts from the supplied description. Do not invent reviews, scarcity, discounts, specifications, or guarantees. Avoid generic hype and repeated claims.
- "sectionType" must be one of: "hook", "content", "benefit", "cta".
- "duration" is the target duration in seconds for that scene (around ${Math.round((config.duration || 30) / sceneCount)}s).

Output strictly valid JSON with this exact schema:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "sectionType": "hook",
      "sceneText": "...",
      "imagePrompt": "...",
      "duration": 5
    }
  ]
}`;

  try {
    config.abortSignal?.throwIfAborted();
    await (dependencies.reserve || reserveUsage)('script');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const { data } = await axios.post(
      url,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT", required: ["scenes"], properties: {
              scenes: { type: "ARRAY", minItems: sceneCount, maxItems: sceneCount,
                items: { type: "OBJECT", required: ["sceneText", "imagePrompt", "duration", "sectionType"], properties: {
                  sceneText: { type: "STRING" }, imagePrompt: { type: "STRING" },
                  duration: { type: "NUMBER" },
                  sectionType: { type: "STRING", enum: ["hook", "content", "benefit", "cta"] },
                } },
              },
            },
          },
          temperature: 0.7,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 }
        },
      },
      { timeout: 60000, headers: { "x-goog-api-key": apiKey }, signal: config.abortSignal }
    );

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    const cleanText = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const json = JSON.parse(cleanText);
    const scenes = json.scenes;

    if (!Array.isArray(scenes) || scenes.length !== sceneCount || scenes.some(s =>
      typeof s.sceneText !== "string" || !s.sceneText.trim() ||
      typeof s.imagePrompt !== "string" || !s.imagePrompt.trim() ||
      !Number.isFinite(s.duration) || s.duration <= 0 ||
      !["hook", "content", "benefit", "cta"].includes(s.sectionType))) {
      throw new Error("Gemini returned an incomplete scene plan");
    }

    return scenes.map((s, idx) => ({
      sceneNumber: idx + 1,
      sectionType: s.sectionType || structure[idx]?.sectionType || "content",
      sceneText: s.sceneText || "",
      imagePrompt: s.imagePrompt || `Showcase of ${config.productName} in modern setting`,
      duration: s.duration || structure[idx]?.targetSeconds || 5,
    }));
  } catch (err) {
    if (err.name === "CanceledError" || axios.isCancel(err) || config.abortSignal?.aborted) {
      throw new JobCancelledError();
    }
    config.onWarning?.(`Gemini script generation failed${err.response?.status ? ` (HTTP ${err.response.status})` : ""}. A local draft script was used; check the API key, model, and quota.`);
    console.warn("Gemini script generation error, using fallback template engine:", err?.response?.data || err.message);
    return generateFallbackScript(config);
  }
}

