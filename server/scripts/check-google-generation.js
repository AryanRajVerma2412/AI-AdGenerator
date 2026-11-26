import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { checkModelAccess, interactions } from '../src/services/googleInteractions.js';
import { generateImage } from '../src/services/imageGeneration.service.js';
import { generateVideo } from '../src/services/videoGeneration.service.js';
import { reserveUsage, usageSummary } from '../src/services/usage.service.js';
import { connectDB } from '../src/config/db.js';
import { generateScript } from '../src/services/scriptService.js';
const mode = process.argv[2] || 'models';
try {
  if (mode === 'models') console.log(JSON.stringify(await checkModelAccess(), null, 2));
  else if (mode === 'inspect') {
    const result = await interactions.get(process.argv[3]);
    console.log(JSON.stringify(result, (key, value) => ['data', 'signature'].includes(key) ? '[omitted]' : value, 2));
  }
  else {
    await connectDB();
    let result;
    if (mode === 'script') {
      const warnings = [];
      result = { scenes: await generateScript({ productName: 'Cobalt Mug', description: 'A blue ceramic mug with a curved handle. Holds 300 ml. Dishwasher safe.', category: 'General Retail', audience: 'People who enjoy coffee at home', tone: 'Professional', duration: 15, ctaText: 'Explore the collection', aspectRatio: '9:16', language: 'en', onWarning: message => warnings.push(message) }), warnings };
    }
    else if (mode === 'image') result = await generateImage({
      prompt: 'A matte cobalt-blue ceramic mug on a pale oak table by a window. Three-quarter eye-level composition, handle on the right, soft morning light from the left, realistic ceramic texture, warm neutral background. No lettering.',
      aspectRatio: '1:1' });
    else if (mode === 'image-edit') result = await generateImage({
      prompt: 'Keep the mug identical. Place a single lemon to its left on the oak table. Use soft window light, preserve the blue ceramic color and right-facing handle.',
      aspectRatio: '4:5', reference: fs.readFileSync(process.argv[3]) });
    else if (mode === 'video' || mode === 'video-reference') {
      await reserveUsage('video', 3);
      result = await generateVideo({
        prompt: 'A matte cobalt-blue ceramic mug on a pale oak table, soft window light from the left. A slow continuous camera push toward the mug. The mug stays stationary and retains its shape. Quiet room ambience, no music or dialogue.',
        aspectRatio: '16:9', duration: 3,
        reference: mode === 'video-reference' ? fs.readFileSync(process.argv[3]) : undefined,
        onOperation: id => console.log('Interaction:', id), onStatus: status => console.log('Status:', status) });
    } else throw new Error('Use models, image, image-edit <path>, video or video-reference <path>');
    console.log(JSON.stringify({ ...result, usage: result.usage, budget: await usageSummary() }, null, 2));
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(path.join('reports', `live-${mode}.json`), JSON.stringify(result, null, 2));
  }
} catch (error) { console.log(JSON.stringify({ mode, error: error.message, status: error.status })); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
