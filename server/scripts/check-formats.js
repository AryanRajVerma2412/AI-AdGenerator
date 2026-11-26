import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import probeInstaller from '@ffprobe-installer/ffprobe';
import { assembleVideo, ASPECT_RATIO_CONFIGS } from '../src/services/videoService.js';
ffmpeg.setFfprobePath(probeInstaller.path);
const image = fs.readdirSync('uploads').find(n => /^scene-.*\.png$/.test(n));
if (!image) throw new Error('Run check:generation first to create a scene image');
for (const [aspectRatio, size] of Object.entries(ASPECT_RATIO_CONFIGS)) {
 const video = await assembleVideo({productName:'Format verification',aspectRatio,ctaText:'Watch. Create. Share.',scenes:[{sceneText:"Playable MP4: picture, captions & music.",imagePath:path.resolve('uploads',image),duration:2}]});
 const data = await new Promise((r,j) => ffmpeg.ffprobe(video,(e,d)=>e?j(e):r(d)));
 const stream = data.streams.find(s=>s.codec_type==='video');
 if (stream.width!==size.w || stream.height!==size.h || !data.streams.some(s=>s.codec_type==='audio')) throw new Error('Invalid video streams');
 await new Promise((r,j)=>ffmpeg(video).outputOptions(['-v error']).format('null').output('-').on('end',r).on('error',j).run());
 console.log(`${aspectRatio} PASS: ${stream.width}x${stream.height}, H.264/AAC decoded; ${video}`);
}
