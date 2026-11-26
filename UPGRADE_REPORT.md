# Google generation upgrade — implementation and verification

Date: 17 November 2026 (Asia/Kolkata).

## Outcome and limitations

Implemented in the existing application, without replacing its scene-based FFmpeg workflow. The standalone image path uses `gemini-3.1-flash-image`; the standalone video path uses `gemini-omni-1.2-flash` through the v1beta Interactions API, following the user's subsequent model selection. No retired video model is used by the implementation. No generated media was fabricated for live tests.

**End-to-end AI generation is not verified successfully.** Both selected models were visible with the existing API key, but real image generation was rejected by quota and the real video interaction failed with `RESOURCE_EXHAUSTED`. Prompt output quality, real generated-image downloads, video motion/audio quality, image-to-video output, and provider-confirmed cancellation remain unverified. This is not a claim of production readiness.

## Architecture analysis

- React 18, React Router, Vite and Tailwind form the client. `NewProject` prepares scripts and uploads; `ProjectDetail` edits scenes, polls real stages, previews and downloads renders. Existing olive/gold colors are retained.
- Express ES modules provide JWT-authenticated project routes. Mongoose stores users and projects. Multer stores source uploads; existing media resides in `server/uploads`.
- `scriptService` sends a structured JSON request to Gemini. It validates the scene schema and reports an explicit local draft when the provider fails.
- `pipeline` creates/reuses scene visuals and narration, then calls `videoService`. Uploaded moving footage is already supported.
- `ttsService` selects optional ElevenLabs or Edge speech, with Google speech fallback. Voice settings control voice/language/speed; there is no independent voice-directing LLM prompt.
- `musicService` synthesizes an ambient bed locally when a supplied music track is absent. It has no AI prompt.
- `videoService` handles four export ratios, pan/zoom for stills, moving footage, fades, captions, CTA closing card, speech normalization and background music. Captions are deterministic narration fragments, not generated text.
- `jobManager` tracks local abort controllers, FFmpeg commands and temporary files. The upgrade adds separate persistent media jobs and an application-wide reservation ledger in MongoDB.
- Standalone generated files live in `server/generation-output` and require owner authentication for preview/download. “Use in scene” copies a selected output into the existing uploads system, retaining the established scene/render conventions.

## Files created

| File | Purpose |
| --- | --- |
| `server/src/config/gemini.config.js` | Model/provider switches, strict 720p validation, ratios, duration, pricing and budget settings |
| `server/src/models/GenerationJob.js` | Persistent owner-bound jobs, request deduplication, provider IDs, outcomes and usage metadata |
| `server/src/services/generationPrompts.js` | Concise image and motion-specific video instruction wrappers |
| `server/src/services/googleInteractions.js` | v1beta create/get/cancel requests, final media extraction, safe provider errors and model access checks |
| `server/src/services/imageGeneration.service.js` | Official Google SDK image generation, references, MIME extraction and storage |
| `server/src/services/videoGeneration.service.js` | One submission, interaction polling, MP4 extraction, cancellation checks and ffprobe verification |
| `server/src/services/generationJobs.service.js` | Persistent orchestration, idempotency, local cancellation, guarded publication and restart recovery |
| `server/src/services/usage.service.js` | Atomic global budget/request reservations and estimates |
| `server/src/routes/generation.routes.js` | Authenticated generation, status, cancellation, media and scene-use endpoints |
| `client/src/pages/Generation.jsx` | Separate media tabs, real status, costs, preview/download and scene reuse |
| `server/scripts/check-google-generation.js` | Explicit, budget-reserved live checks; no automatic model substitution |
| `server/scripts/check-generation-api.js` | Real HTTP/MongoDB checks in an isolated temporary test database |
| `server/test/generation.test.js` | Validation, media parsing, API request contract, polling and output rejection regressions |
| `server/test/ttsSpeed.test.js` | Real FFmpeg speed-conversion regression |
| `UPGRADE_REPORT.md` | This implementation and prompt audit report |

## Files modified

- `server/package.json`, `server/package-lock.json`: official `@google/genai` SDK and compatible dependency security fixes.
- `server/src/index.js`: generation routes, config validation, job recovery and nosniff header.
- `server/src/services/scriptService.js`: timing-aware narration, visual continuity, output-token cap and usage reservations.
- `server/src/services/imageService.js`: existing scene workflow now calls the dedicated image service; provider errors are explicit; missing references no longer produce a blank fallback.
- `server/src/services/ttsService.js`, `speechStream.js`: fixed undefined `projectId` in speed conversion, cancellation of speech streams, cancellation checks between fallbacks, and early temporary-file tracking.
- `server/src/services/jobManager.js`: reject overlapping jobs rather than replacing a running job.
- `server/src/services/pipeline.js`: protect uploaded source footage from cancellation cleanup, validate scene indices, conditionally publish completed videos and discard cancelled output.
- `server/src/routes/projects.js`: ownership checks on image/audio regeneration, reject active re-render duplication, cancel work when deleting a project.
- `server/src/middleware/upload.js`, `error.js`: safe upload extensions/MIME allowlist and meaningful upload/validation HTTP errors.
- `server/.env.example`, `.gitignore`: documented settings and private-output exclusion. **Existing `server/.env` and its credentials were not overwritten.**
- `client/src/App.jsx`, `components/Navbar.jsx`: protected media page/navigation.
- `client/src/pages/NewProject.jsx`: remove an unsupported default discount and ungrounded voice-preview claims.
- Existing script, image-fallback, cancellation and speech tests updated for the preserved contracts and stricter cancellation behavior.
- `README.md`: new setup, routes, test commands and limitations. `client/dist` regenerated by production build.

## API endpoints

All new endpoints require the existing Bearer JWT. Job lookup and media access are scoped to the requesting user.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/generate/config` | Capabilities, selected models, output estimates and application reservations; no keys |
| GET | `/api/generate/jobs` | Last 30 jobs belonging to the user |
| POST | `/api/generate/image` | Queue real image generation; optional `referenceImage` multipart upload |
| GET | `/api/generate/image/:operationId` | Persisted image job state |
| POST | `/api/generate/image/:operationId/cancel` | Stop local image processing |
| POST | `/api/generate/video` | Queue an Omni interaction at 720p |
| GET | `/api/generate/video/:operationId` | Persisted state; never submits generation |
| POST | `/api/generate/video/:operationId/cancel` | Local cancellation and best-effort provider cancellation if its ID is known |
| GET | `/api/generate/media/:id` | Private preview of completed media |
| GET | `/api/generate/media/:id/download` | Private attachment download |
| POST | `/api/generate/media/:id/use-in-scene` | Copy media into an owned project's selected scene |

`operationId` is the application's UUID; Google's interaction ID is stored separately. POST generation requires an `Idempotency-Key` header. Reusing it with identical input returns the same job; changing input with that key is rejected. A unique active-user index prevents concurrent standalone submissions for one user. A network-lost submission is not automatically submitted again with a new key.

Omni request: `background: true`, `store: true`, `response_format: { type: 'video', resolution: '720p', aspect_ratio, duration: '8s' }`. Durations are whole seconds from 3–15; portrait and landscape are supported. Reference images are typed image input blocks. Output is extracted from `steps` of type `model_output`, not an invented REST `output_video` field. Polling uses only GET, with bounded retry/backoff for transient retrieval failures. Failed create requests are not automatically retried.

## Prompt audit

Scores below assess the **original instructions**, not generated quality. Criteria: clarity/context, schema/workflow compatibility, specificity, continuity, timing, factual restraint and avoidance of generic repetition. No numerical score is invented for a prompt that did not exist.

| Prompt | Original score /10 | Problems in actual original content | Improvements |
| --- | --- | --- | --- |
| Script generation | 7 | Good JSON schema and factual restraint; fixed 10–20 words per scene ignores scene length; tone and pronunciation do not guide spoken text sufficiently | Approximately 2 words/second, ordered timing plan, natural punctuation, no spoken stage directions, grounded claims retained |
| Scene planning (same request) | 6 | Distinct shot purposes already present, but palette/recurring-character descriptions weak; duration instruction was only an approximate average | Ordered scene timing, persistent identity/material/wardrobe details, palette consistency, visual/narration alignment, single still moment per scene |
| Image generation wrapper | 4 | Appended generic “hyper-realistic, 8k resolution” regardless of user style; ratio only in prompt; limited reference identity protection | Actual aspect-ratio API parameter and 1K output; requested style respected, scale/perspective/materials/lighting/positioning made coherent; scene-only caption safe area |
| Local fallback visual template | 3 | Repeated “cinematic commercial photography…studio lighting, 8k” and abstract section names | Varied framing, realistic surfaces, reference color/shape and caption space; remains explicitly a local draft |
| Video generation | N/A | No AI video generation prompt existed; moving footage and FFmpeg are not generative video models | New Omni-specific action, camera, motion continuity, identity and ambient audio wrapper |
| Voice-over | N/A | No instruction prompt: providers read `sceneText` directly. Preview text contained unsupported superlatives; speed processing had an undefined variable | Improve narration upstream and neutralize preview sample; retain voice/language controls; fix speed and cancellation. No unsupported emotion/pronunciation API parameter invented |
| Captions | N/A | No AI prompt: phrases are derived from narration | Preserve wording and punctuation; retain phrase-length tests. Timing remains estimated, not forced alignment |

The voice catalogue's hardcoded sample strings are preview copy, not instructions to a model. Music is synthesized signal processing, and the FFmpeg camera/transition expressions are deterministic code. These were inspected rather than incorrectly counted as AI prompts.

### Old versus revised examples

**Narration:** Original: `natural, punchy spoken narration ... (10-20 words per scene)`.
Revised: `Aim for roughly 2 words per second of scene duration; use shorter sentences for reflective tones` and require spoken narration only, without stage directions.

**Scene continuity:** Original: `Preserve the reference product's appearance. Reserve the bottom quarter for captions.`
Revised: preserve these constraints, explicitly repeat essential product/character identity details, maintain the color palette, and make each image demonstrate the same fact as its narration.

**Image:** Original appended `studio lighting, hyper-realistic, 8k resolution, crisp product detail`.
Revised: follow the requested style and use coherent lighting, natural materials, restrained grading and clear subject framing only where unspecified. Resolution is now configured in the API, not implied through “8k” prose.

**Preview narration:** Original: `Experience the game changing [product]. Built for unmatched performance and style.`
Revised: `Meet [product]. Take a closer look and discover the details.`

These changes address instruction weaknesses. They have **not** been demonstrated to improve model outputs: paid image/video quota and text-model availability prevented a valid old/new visual or narration A/B comparison. Revised output-quality scores are therefore pending, not presented as measured improvements.

## Actual live results

1. **Model catalogue:** the user's existing key listed both `gemini-3.1-flash-image` and `gemini-omni-1.2-flash`. This verifies visibility, not successful paid generation.
2. **Image, cobalt mug, 1:1:** real SDK request returned **HTTP 429 / RESOURCE_EXHAUSTED**. Google reported `generate_content_free_tier_input_token_count` and `generate_content_free_tier_requests`, each with **limit 0** for the selected image model. No image was returned. Image edits and visual comparisons were not retried against the known zero quota.
3. **Video, cobalt mug, 3 seconds, 16:9, 720p:** real Interactions POST accepted and returned ID `v1_Chd0aVA4YXBEMk0tT2JqdU1QaF92SnFBdxIXdGlQOGFwRDJNLU9ianVNUGhfdkpxQXc`. GET polling retrieved `status: failed`; exact provider error code **RESOURCE_EXHAUSTED** and message: **“There was a problem processing your request. You will only be charged for tokens successfully generated.”** No MP4 was returned. This verifies submission/ID/polling and the requested response format, not video generation success.
4. **Script, cobalt mug, 15 seconds:** configured `gemini-2.5-flash` returned **HTTP 503 / UNAVAILABLE**, reporting high demand. The application returned three explicit local-draft scenes and a warning. This is not a successful AI script test. The local result is in `server/reports/live-script.json`.
5. No alternative model, fake URL or fake live media was used. Unit-test response fixtures are confined to tests and are not application fallback outputs.

## Cost controls

Official pricing checked on 17 November 2026: image output at 1K is $0.0672; Omni 720p output is 5,792 tokens/second at $12/million video tokens (about $0.069504/second). Input and thinking may add charges. Sources: [Google pricing](https://aistudio.google.com/docs/pricing), [image model](https://aistudio.google.com/docs/models/gemini-3.1-flash-image), [Omni](https://aistudio.google.com/docs/omni).

The default lifetime reservation ceiling is ₹2,500, leaving headroom within the requested approximate ₹3,000 testing budget. A ₹100/USD planning conversion and additional per-request allowance are used, clearly labelled as estimates rather than current exchange rates/invoices. The cap is shared by standalone images/videos, scene image requests and script requests. Failed/cancelled attempts retain their reservations. The recorded reservation after these live diagnostics was ₹134.30 across four attempts, including a sandbox-blocked image attempt; this is **not actual billed spend**. Reservations are not automatically reset daily or refunded.

The ledger does not cover other applications using the same API key, taxes, optional ElevenLabs charges, or pre-existing provider usage. Google billing/quota settings remain necessary. Do not raise/reset the ledger without checking provider usage. Output-token caps constrain image/script responses; video reserves a conservative extra allowance but provider billing remains authoritative.

## Cancellation and reliability evidence

- Existing cancellation tests verify ownership, duplicate cancellation, network abort, process termination callbacks, temporary-file removal and prevention of completion after cancellation.
- Added speech-stream cancellation regression and a real FFmpeg speech-speed regression.
- Standalone completion uses an atomic status predicate; a cancelled job cannot publish a completed result. MP4s with incorrect dimensions are rejected and removed.
- Real MongoDB/HTTP checks verified authentication, cross-user rejection, same-key deduplication, cancellation, no cancelled-media access, and exact-byte attachment downloads using an existing real MP4 fixture.
- Concurrent budget reservations were tested against a ₹100 isolated-test ceiling: only two image reservations succeeded; the ceiling was not exceeded.
- On restart, known video interaction IDs resume retrieval; jobs without a recoverable provider ID become interrupted rather than being submitted again.
- Remote cancellation is reported as confirmed only when Google responds `cancelled`. Live confirmation was not exercised because the paid video operation had already failed. Local cancellation never promises that remote billing stopped.

## Build and rendering checks

- Backend tests: **21/21 passed** (includes API contract fixtures, cancellation, captions, fallback disclosure, downloads and speech handling; see latest `npm test` output).
- `node scripts/check-generation-api.js`: passed against real MongoDB/HTTP in a disposable, randomly named isolated database; no paid generation calls.
- Frontend `npm run build`: passed.
- `node scripts/check-formats.js`: rendered, probed and fully decoded all four formats: 1080×1920, 1920×1080, 1080×1080 and 1080×1350, with H.264 video and AAC audio. This validates the existing compositor, not Google-generated footage.
- Browser: confirmed `/generate` redirects unauthenticated users to login. Authenticated desktop/mobile visual checks were not completed. Responsive classes are implemented, but a production build is not evidence of visual QA.
- Compatible `npm audit fix` updates removed the initial critical advisory. Remaining audit findings: six (four moderate, two high), including the old Axios dependency inside `google-tts-api`, plus qs/Express and minimatch/nodemon. No forced breaking downgrade was applied. These need resolution before claiming production readiness.

## Remaining issues and manual steps

1. Enable/verify paid Gemini API quota for the project associated with the existing key. Image quota is explicitly zero; inspect Omni quota/billing for its `RESOURCE_EXHAUSTED` result. Do not replace a key in frontend code.
2. Restart the backend and frontend. Existing `.env` values are preserved; new variables fall back to the documented defaults. Add desired limits/settings from `.env.example` without replacing credentials.
3. Retry one image and one 3-second video first, then reference editing/image-to-video after successful quota checks. Inspect their actual output before spending on a larger test set. Commands are documented below.
4. Finish old/new prompt A/B checks, cross-scene identity/composition/motion evaluation, generated-media preview/download testing, provider cancellation and authenticated mobile/desktop browser checks.
5. The existing pipeline and restart recovery assume **one backend process**. A distributed worker lease/queue and worker deployment tests are required before scaling to multiple backend instances. Legacy public `/uploads` behavior is preserved; standalone outputs are private until explicitly copied into a project.
6. Resolve remaining dependency advisories and validate the free speech fallback providers for the intended production workload. These providers do not provide guaranteed uptime.
7. Scene regeneration is owner-checked, but the existing per-scene regeneration operations do not yet have the same persistent job/duplicate-submission contract as standalone generation. This remains a concurrency-hardening limitation.
8. Google generation jobs without an operation ID after a timeout/restart cannot be recovered safely. They are not automatically retried; check provider usage before starting a new job.

### Reproducible commands (from `server`)

```text
npm test
node scripts/check-generation-api.js
node scripts/check-formats.js
node scripts/check-google-generation.js models
node scripts/check-google-generation.js image
node scripts/check-google-generation.js image-edit <absolute-image-path>
node scripts/check-google-generation.js video
node scripts/check-google-generation.js video-reference <absolute-image-path>
node scripts/check-google-generation.js script
```

The last five commands can consume quota/credit and reserve application budget. `video` uses three seconds for testing; the application default remains eight seconds. Run `npm run build` from `client`.

Schema references: [Interactions API](https://aistudio.google.com/api-reference/interactions-api), [background execution](https://aistudio.google.com/docs/background-execution), [image generation](https://aistudio.google.com/docs/image-generation). API keys remain backend-only.
