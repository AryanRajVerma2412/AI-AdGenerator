import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'node:path';
import { assembleVideo } from './src/services/videoService.js';
import { generateSceneImage } from './src/services/imageService.js';
await mongoose.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS: 4000});
const project = await mongoose.connection.collection('projects').findOne({status:'completed'}, {sort:{createdAt:-1}});
await mongoose.disconnect();
if (!project?.script?.length) throw new Error('No completed project for preview');
// Offline preview: reuse existing narration and rebuild product compositions, without API charges.
process.env.GEMINI_API_KEY = '';
const scenes = [];
for (let i = 0; i < project.script.length; i++) {
 const s = project.script[i];
 scenes.push({...s, imagePath: await generateSceneImage({referenceImagePath:path.resolve('uploads',path.basename(project.productImageUrl)),aspectRatio:'9:16',index:i}),audioPath:path.resolve('uploads',path.basename(s.audioUrl))});
}
console.log(await assembleVideo({scenes,productName:project.productName,ctaText:project.ctaText,tone:project.tone,aspectRatio:'9:16'}));
