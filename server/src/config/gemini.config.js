
export const IMAGE_RATIOS = [
  '1:1', '1:4', '1:8', '2:3', '3:2', '3:4',
  '4:1', '4:3', '4:5', '5:4', '8:1',
  '9:16', '16:9', '21:9'
];

export const VIDEO_RATIOS = ['16:9', '9:16'];

export const VIDEO_DURATIONS = [4, 6, 8];

export const PRICING = {
  imageOutputUSD: 0.0672,
  videoSecondUSD: 0.08,
  source: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
  checked: '2026-11-18'
};

export function problem(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function flag(env, key) {
  const value = env[key] ?? 'true';

  if (!['true', 'false'].includes(value)) {
    throw problem(`${key} must be true or false`, 503);
  }

  return value === 'true';
}

function positive(env, key, fallback) {
  const value = Number(env[key] ?? fallback);

  if (!Number.isFinite(value) || value <= 0) {
    throw problem(`${key} must be a positive number`, 503);
  }

  return value;
}

export function geminiConfig(env = process.env) {
  const config = {
    provider: env.GENERATION_PROVIDER || 'google',

    // Image generation: Gemini API
    apiKey: env.GEMINI_API_KEY,
    imageModel: env.IMAGE_MODEL || 'gemini-3.1-flash-image',

    // Video generation: Google Cloud Vertex AI
    videoModel: env.VIDEO_MODEL || 'veo-3.1-fast-generate-001',
    googleCloudProject: env.GOOGLE_CLOUD_PROJECT,
    googleCloudLocation: env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    videoOutputGcsUri: env.VIDEO_OUTPUT_GCS_URI,

    resolution: env.VIDEO_RESOLUTION || '720p',
    duration: positive(env, 'VIDEO_DEFAULT_DURATION', 8),

    imageEnabled: flag(env, 'IMAGE_GENERATION_ENABLED'),
    videoEnabled: flag(env, 'VIDEO_GENERATION_ENABLED'),

    budgetINR: positive(env, 'GENERATION_BUDGET_INR', 2500),
    usdToINR: positive(env, 'GENERATION_USD_TO_INR', 100),
    maxRequests: positive(env, 'GENERATION_MAX_REQUESTS', 100),
  };

  if (config.provider !== 'google') {
    throw problem('Only GENERATION_PROVIDER=google is supported', 503);
  }

  if (!config.imageModel?.trim() || !config.videoModel?.trim()) {
    throw problem('Image and video models must be configured', 503);
  }

  if (config.resolution !== '720p') {
    throw problem('VIDEO_RESOLUTION must be 720p', 503);
  }

  if (!VIDEO_DURATIONS.includes(config.duration)) {
    throw problem('VIDEO_DEFAULT_DURATION must be 4, 6, or 8 seconds', 503);
  }

  return config;
}

export function requireGeneration(kind) {
  const config = geminiConfig();

  if (!['image', 'video'].includes(kind)) {
    throw problem('Invalid generation type');
  }

  if (!config[`${kind}Enabled`]) {
    throw problem(`${kind} generation is disabled`, 503);
  }

  // Image generation uses Gemini API key.
  if (kind === 'image') {
    if (!config.apiKey || config.apiKey.startsWith('your_')) {
      throw problem('Set GEMINI_API_KEY in server/.env', 503);
    }
  }

  // Video generation uses Vertex AI + Application Default Credentials.
  if (kind === 'video') {
    if (!config.googleCloudProject) {
      throw problem('Set GOOGLE_CLOUD_PROJECT in server/.env', 503);
    }

    if (!config.googleCloudLocation) {
      throw problem('Set GOOGLE_CLOUD_LOCATION in server/.env', 503);
    }

    if (
      !config.videoOutputGcsUri ||
      !config.videoOutputGcsUri.startsWith('gs://')
    ) {
      throw problem('Set a valid VIDEO_OUTPUT_GCS_URI in server/.env', 503);
    }
  }

  return config;
}

export function validateGeneration(kind, body = {}) {
  const config = geminiConfig();

  if (!['image', 'video'].includes(kind)) {
    throw problem('Invalid generation type');
  }

  if (
    typeof body.prompt !== 'string' ||
    !body.prompt.trim() ||
    body.prompt.length > 6000
  ) {
    throw problem('Prompt must contain 1–6000 characters');
  }

  const aspectRatio =
    body.aspectRatio || (kind === 'image' ? '1:1' : '16:9');

  if (
    !(kind === 'image' ? IMAGE_RATIOS : VIDEO_RATIOS)
      .includes(aspectRatio)
  ) {
    throw problem('Unsupported aspect ratio');
  }

  const duration = Number(body.duration ?? config.duration);

  if (kind === 'video' && !VIDEO_DURATIONS.includes(duration)) {
    throw problem('Video duration must be 4, 6, or 8 seconds');
  }

  if (body.resolution && body.resolution !== '720p') {
    throw problem('Only 720p video is allowed');
  }

  return {
    prompt: body.prompt.trim(),
    aspectRatio,
    duration,
    resolution: '720p'
  };
}
