# MP26 AI Lab — Multiple Product Reference Images

This is a patch to the uploaded MP26 project, not a replacement application.

## Architecture
`client/src/pages/NewProject.jsx` -> `POST /api/projects` -> Multer disk uploads
-> MongoDB `Project.productImageUrls` -> `runPipeline()` -> all per-scene Gemini
still images -> original Vertex AI Veo video service + Google Cloud Storage
-> existing TTS and FFmpeg assembly -> final advertisement.

`Project.productImageUrl` remains as the legacy primary image for old
projects. The new `productImageUrls` array is ordered; every scene receives
the full set in the same order. Optional model image, auth, cancellation,
MongoDB, Veo, GCS, and existing 15/30/45/60-second selections are retained.

## Modified source files
- client/src/pages/NewProject.jsx
- client/src/pages/ProjectDetail.jsx
- server/src/middleware/upload.js
- server/src/routes/projects.js
- server/src/routes/generation.routes.js
- server/src/models/Project.js
- server/src/services/pipeline.js
- server/src/services/imageService.js
- server/src/services/generationJobs.service.js
- server/src/config/gemini.config.js
- server/src/services/videoGeneration.service.js (removed unused hardcoded constant)
- server/test/multiReferences.test.js (new)

## API
New projects: `POST /api/projects` (multipart):
- `productImages`: 3 to 5 uploaded images, repeated multipart field
- `modelImage`: optional
- other existing project properties unchanged

Legacy calls with `productImage` (single image or video) remain accepted.
New reference images must be JPEG/PNG/WebP, max 8 MiB each. Existing legacy
video uploads retain their 100 MiB file limit. Old projects with no
`productImageUrls` fall back to `productImageUrl`.

Direct image generation: `POST /api/generate/image` supports a repeated
`referenceImages` field (up to five) and still accepts `referenceImage`.
Direct video generation retains its one-image Veo starting-frame constraint.

## Deployment
1. Back up your original project and MongoDB database.
2. Apply the modified source to your original MP26 folder.
3. Retain your ORIGINAL `server/.env` and `client/.env` locally. They are
   intentionally excluded from this ZIP. Keep original Google Cloud
   service credentials private; do not publish any API keys.
4. In both `client` and `server`, run `npm ci` on the target machine,
   then start the application with the existing scripts.
5. Existing model environment settings remain in effect. No new model
   name is required. Existing Google Cloud/Gemini quotas and billing
   must be configured for live generation.

## Verification
- New dedicated `server/test/multiReferences.test.js`: 3/3 passed.
- React NewProject and ProjectDetail parsed successfully with Babel JSX.
- JavaScript server modules passed `node --check`.
- Full existing backend test suite: 20/23 passed in the isolated test
  environment; three Veo-related tests need real/mock Google Cloud setup.
- Full frontend Vite build was not verifiable in Linux because the uploaded
  node_modules bundle comes from Windows and lacks Linux Rollup binary.
  Run `npm ci` in your Windows project and `npm run build` locally.
- Live Gemini/Veo/GCS end-to-end generation was not executed.

## Identity fidelity
Product identity is strongly prompted using all reference photographs,
but exact logos/textures across independently generated scenes cannot be
guaranteed by any generative image model. Review/edit scene stills in the
existing project detail UI before final render.
