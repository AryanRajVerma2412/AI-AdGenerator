import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { generateScript } from '../src/services/scriptService.js';
import { generateSceneImage } from '../src/services/imageService.js';
import { generateVoiceOver } from '../src/services/ttsService.js';
import { assembleVideo } from '../src/services/videoService.js';
// Live provider smoke test. Gemini requests may consume quota or API credit.
fs.mkdirSync('uploads', {recursive:true});
const reference = fs.readdirSync('uploads').find(n => /\.(jpg|jpeg|jfif|webp)$/i.test(n));
const onWarning = message => console.log('Provider notice:', message);
const config = { productName:'Studio Headphones', description:'Black over-ear headphones for listening to music.', audience:'Music listeners', duration:15, ctaText:'Find your rhythm', aspectRatio:'1:1', onWarning };
const script = await generateScript(config);
console.log(`Script: ${script.length} scenes with narration, visual descriptions, and durations`);
const scenes = [];
for (let index = 0; index < script.length; index++) {
 const scene = script[index];
 const imagePath = await generateSceneImage({imagePrompt:scene.imagePrompt,referenceImagePath:reference ? path.resolve('uploads', reference) : undefined,aspectRatio:config.aspectRatio,index,onWarning});
 const audio = await generateVoiceOver({text:scene.sceneText,index});
 scenes.push({...scene,imagePath,audioPath:audio.filePath});
 console.log(`Scene ${index+1}: visual and voiceover ready`);
}
console.log('Video:', await assembleVideo({...config,scenes}));
