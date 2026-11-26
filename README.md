# AdGen — AI-Powered Product Video Generator (MERN)

Upload a product image, fill a short config form, and choose a 15–60 second target for an
AI advertisement video: LLM script → AI scene images → TTS voice-over → FFmpeg assembly.

## Tech stack

- **Client:** React (Vite), React Router, Tailwind CSS, Axios
- **Server:** Node.js, Express, MongoDB + Mongoose, JWT + bcrypt, Multer
- **AI:** Gemini (structured scene plan + scene images); free Edge/Google speech, optional ElevenLabs
- **Video:** FFmpeg via fluent-ffmpeg

## Prerequisites

- Node.js 20+ (required by the Google Gen AI SDK)
- MongoDB running locally (or a MongoDB Atlas URI)
- FFmpeg and FFprobe are bundled through npm; custom binary paths are optional

## Setup

### 1. Server

```bash
cd server
npm install
cp .env.example .env      # fill in MONGODB_URI, JWT_SECRET and the AI keys
npm run dev               # http://localhost:5000
```

Optionally drop your licensed `music.mp3` into `server/assets/`. Otherwise an original
ambient bed is synthesized locally at no API cost. Set `BACKGROUND_MUSIC_MODE=off`
to disable music.

### 2. Client

```bash
cd client
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000
npm run dev               # http://localhost:5173
```

## Environment variables (server/.env)

| Key | Purpose |
| --- | --- |
| `PORT` | Server port (default 5000) |
| `CLIENT_ORIGIN` | Allowed CORS origin |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `GEMINI_API_KEY` | LLM script generation + image generation |
| `GEMINI_TEXT_MODEL` / `GEMINI_IMAGE_MODEL` | Model names |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | Text-to-speech |
| `TTS_PROVIDER` | `edge` (default, free online speech) or `elevenlabs` (optional API) |
| `FFMPEG_PATH` / `FFPROBE_PATH` | Only if FFmpeg is not on PATH |
| `BACKGROUND_MUSIC` | Path to the background track |
| `BACKGROUND_MUSIC_MODE` | `auto` (default) or `off` |

## API

```
POST   /api/auth/signup
POST   /api/auth/login

POST   /api/projects        create project (images + config) and run the pipeline
GET    /api/projects        list the current user's projects
GET    /api/projects/:id    one project (status + final video URL)
GET    /api/projects/:id/download    authenticated MP4 attachment
DELETE /api/projects/:id    delete a project and its files
```

All `/api/projects` routes require `Authorization: Bearer <token>`.

## Data models

**User** `{ name, email, passwordHash, createdAt }`

**Project**
```js
{
  userId, productName, description, audience, style, ctaText, aspectRatio,
  productImageUrl, modelImageUrl,
  script: [{ sceneText, imageUrl, audioUrl }],
  finalVideoUrl,
  status: 'processing' | 'completed' | 'failed',
  createdAt
}
```

## Generation pipeline

`server/src/services/pipeline.js` runs after project creation:

1. **Script** — Gemini returns a validated JSON plan with 3–8 scenes depending on
   target duration, including visual descriptions, narration, and estimated duration.
2. **Scene images** — one AI image per scene, using the uploaded product image as reference.
3. **Voice-over** — Free online Edge speech with Google speech fallback; ElevenLabs
   is used first only when explicitly configured with `TTS_PROVIDER=elevenlabs`.
4. **Assembly** — FFmpeg builds a Ken-Burns clip per scene with burned-in captions, adds a
   CTA end card, concatenates everything and mixes in background music.
5. Project `status` flips to `completed` or `failed`.

The client shows a spinner and polls `GET /api/projects/:id` until the status changes.
It displays the current generation stage, plays the resulting MP4, and downloads it
through an authenticated endpoint. Actual duration follows narration length plus
transitions and the closing card; target duration is an estimate.

API credentials belong only in `server/.env`; `.gitignore` excludes environment
files, generated media, and source archives. Never put provider keys in a `VITE_*`
variable. Gemini image models can require paid quota even when text generation is
free: the app explicitly warns and composes the uploaded product image when image
generation is unavailable. Free speech services require network access and may be
rate-limited; they are not an offline or guaranteed service.

Verification: `npm test` runs regressions, `npm run check:generation` exercises the
live providers and renders a complete sample, and `node scripts/check-formats.js`
renders and fully decodes all four output formats locally.

## Video presentation

New renders include alternating pan/zoom directions, short fade transitions,
product-name branding, tone-based accent colors, and a product-backed closing card.
Captions appear in short phrases timed proportionally to the narration length
(estimated timing, not word-level speech alignment). Voiceovers are normalized,
and longer narration is no longer cut off at 15 seconds. Optional background music
is mixed quietly with a fade-in/out. Exports use H.264/AAC and fast-start MP4.

Uploaded video files remain moving footage. With an image upload and no Gemini
image quota, the app uses varied product framing and motion graphics; it does not
create new AI-generated action footage. New scripts use product facts instead of
inventing reviews or scarcity. Existing saved scripts/audio are retained on re-render.

Restart the backend and re-render existing projects to apply the new presentation.
Regenerate scene images to apply the new product framing to existing stills.
Set `VIDEO_FONT_PATH` to a TrueType font with the needed language glyphs if desired.
`node preview-quality.mjs` from `server` creates an offline preview from the most
recent completed project, reusing narration without changing its database record.

## Troubleshooting generation

- A valid Gemini key does not guarantee image-model quota. A 429 with a limit of
  zero requires checking that model's billing/quota in Google AI Studio. The app
  falls back to framing the uploaded product image and displays a warning.
- Speech requests have a 30-second deadline before trying the next provider;
  provider disconnects are handled instead of leaving the project processing.
- Restart the server after changing code or `.env`. Re-render a failed or stalled
  project from its detail page to retry generation.
- Run `npm test` in `server` for speech failure regression tests. Run
  `npm run check:generation` there for a live text/image/voice/video diagnostic
  (uses configured API credentials and may consume credits). Keys stay on the server.

## Project structure

```
client/   React + Vite + Tailwind frontend
server/   Express + Mongoose API, AI services and FFmpeg pipeline
  src/config      MongoDB connection
  src/models      User, Project
  src/middleware  auth, uploads, error handling
  src/routes      auth, projects
  src/services    scriptService, imageService, ttsService, videoService, pipeline
  uploads/        uploaded and generated media (served at /uploads)
```

## Standalone Google image and video generation

See [UPGRADE_REPORT.md](UPGRADE_REPORT.md) for the architecture, complete prompt audit,
modified files, exact live provider errors, test evidence and remaining limitations.

Open **Generate media** in the navigation. Images use `gemini-3.1-flash-image` at 1K.
Videos use `gemini-omni-1.2-flash` via v1beta Interactions at 720p, 3–15 seconds
(default 8), in 16:9 or 9:16. Optional PNG/JPEG/WebP references are supported.
Finished media can be downloaded or copied into an existing scene before re-rendering.
The existing four-format FFmpeg ad builder remains available through **Create Ad**.

New settings are in `server/.env.example`: `GENERATION_PROVIDER`, `IMAGE_MODEL`,
`VIDEO_MODEL`, `VIDEO_RESOLUTION`, `VIDEO_DEFAULT_DURATION`, generation enable flags,
`GENERATION_BUDGET_INR`, `GENERATION_MAX_REQUESTS`, and `GENERATION_USD_TO_INR`.
The legacy `GEMINI_IMAGE_MODEL` is superseded by `IMAGE_MODEL`; `GEMINI_TEXT_MODEL`
continues to control scripts. Keep your existing `.env` and credentials.

The application reserves estimated costs in MongoDB before provider submission.
Defaults are a lifetime ₹2,500 ceiling, 100 requests and a conservative planning
conversion of ₹100/USD. Reservations include an allowance for input/thinking and
are retained on failure/cancellation; they are not invoices. External key usage,
taxes and optional ElevenLabs charges are not covered. Google billing controls
are still needed. Run one backend process; distributed worker execution is not supported.

The `/api/generate` routes require authentication. Generation POSTs require a unique
`Idempotency-Key`; status requests never submit another generation. Standalone media
is stored privately in `server/generation-output`, while scene reuse copies it into
the established uploads system. Local cancellation does not promise remote termination.

Validation commands:

```bash
cd server
npm test
node scripts/check-generation-api.js  # isolated real DB/HTTP checks, no paid calls
node scripts/check-google-generation.js models
# Paid/quota-consuming checks, after billing/quota is ready:
node scripts/check-google-generation.js image
node scripts/check-google-generation.js video
```

Live tests on 17 November 2026: image returned HTTP 429 (free-tier quota limit zero);
Omni accepted an interaction and then failed with RESOURCE_EXHAUSTED; text generation
returned HTTP 503. Successful AI output and visual quality are not yet verified.
