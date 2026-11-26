import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { writeAmbientMusic } from './musicService.js';
import { jobManager } from './jobManager.js';

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || ffprobeInstaller.path);
const uploadDir = path.resolve('uploads');
export const ASPECT_RATIO_CONFIGS = {
  '9:16': { w: 1080, h: 1920 }, '16:9': { w: 1920, h: 1080 },
  '1:1': { w: 1080, h: 1080 }, '4:5': { w: 1080, h: 1350 },
};
const probe = file => new Promise((resolve, reject) => ffmpeg.ffprobe(file, (e, d) => e ? reject(e) : resolve(d)));
const run = (cmd, projectId) => {
  let unregister = () => {};
  if (projectId) {
    jobManager.checkCancelled(projectId);
    unregister = jobManager.registerProcess(projectId, cmd);
  }
  return new Promise((resolve, reject) => {
    cmd.on('end', () => {
      unregister();
      resolve();
    }).on('error', (err) => {
      unregister();
      reject(err);
    }).run();
  });
};

export function captionPhrases(text, maxChars = 28) {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean)
    .flatMap(word => word.match(new RegExp(`.{1,${maxChars}}`, 'gu')) || []);
  const phrases = [];
  let current = '';
  for (const word of tokens) {
    if (current && (current.length + word.length + 1 > maxChars || current.split(' ').length >= 5)) {
      phrases.push(current); current = '';
    }
    current = current ? `${current} ${word}` : word;
  }
  if (current) phrases.push(current);
  return phrases;
}
const filterPath = file => file.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
function typography(workDir) {
  const font = [process.env.VIDEO_FONT_PATH, 'C:/Windows/Fonts/arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find(p => p && fs.existsSync(p));
  let fontOption = "font='sans-serif'";
  if (font) {
    const dest = path.join(workDir, 'font.ttf');
    fs.copyFileSync(font, dest);
    fontOption = `fontfile='${filterPath(dest)}'`;
  }
  let count = 0;
  return (text, options) => {
    const file = path.join(workDir, `text-${count++}.txt`);
    fs.writeFileSync(file, String(text), 'utf8');
    return `drawtext=${fontOption}:textfile='${filterPath(file)}':expansion=none:${options}`;
  };
}
async function buildClip({ scene, index, size, workDir, draw, productName, accent, closing = false, ctaText, projectId }) {
  if (projectId) jobManager.checkCancelled(projectId);
  const hasAudio = !closing && scene.audioPath && fs.existsSync(scene.audioPath);
  const spokenDuration = hasAudio ? Number((await probe(scene.audioPath)).format.duration) : Number(scene.duration) || 4;
  if (!Number.isFinite(spokenDuration) || spokenDuration <= 0) throw new Error('Invalid voiceover duration');
  const duration = closing ? 2.6 : Math.max(2.5, spokenDuration + 0.5);
  const frames = Math.ceil(duration * 30);
  const { w, h } = size;
  const unit = Math.min(w, h);
  const margin = Math.round(unit * 0.065);
  const fontSize = Math.round(unit * 0.047);
  const isVideo = /\.(mp4|webm|mov|mkv|avi|ogg)$/i.test(scene.imagePath);
  const cmd = ffmpeg().input(scene.imagePath);
  cmd.inputOptions(isVideo ? ['-stream_loop -1'] : ['-loop 1']);
  if (hasAudio) cmd.input(scene.audioPath);
  else cmd.input('anullsrc=channel_layout=stereo:sample_rate=48000').inputFormat('lavfi');
  const progress = `min(on/${frames},1)`;
  const zoom = index % 2 === 0 ? `1.02+0.10*${progress}` : `1.12-0.10*${progress}`;
  const x = index % 3 === 0 ? 'iw/2-iw/zoom/2' : index % 3 === 1 ? `(iw-iw/zoom)*${progress}` : `(iw-iw/zoom)*(1-${progress})`;
  const filters = isVideo
    ? [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`, 'fps=30', 'setsar=1']
    : [`scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`, `crop=${w * 2}:${h * 2}`,
      `zoompan=z='${zoom}':x='${x}':y='ih/2-ih/zoom/2':d=${frames}:s=${w}x${h}:fps=30`, 'setsar=1'];
  filters.push(`drawbox=x=0:y=0:w=iw:h=${Math.round(h * 0.16)}:color=0x090d16@0.55:t=fill`);
  const brand = captionPhrases(productName, Math.floor(w / (unit * 0.022)))[0] || '';
  filters.push(draw(brand, `fontsize=${Math.round(unit * 0.029)}:fontcolor=white:x=${margin}:y=${margin}`));
  filters.push(`drawbox=x=${margin}:y=${margin + Math.round(unit * 0.055)}:w=${Math.round(unit * 0.09)}:h=5:color=${accent}:t=fill`);
  if (closing) {
    filters.push('drawbox=x=0:y=0:w=iw:h=ih:color=0x090d16@0.65:t=fill');
    const lines = captionPhrases(ctaText || 'Shop now', Math.max(14, Math.floor(w / (unit * 0.044))));
    const ctaSize = Math.min(Math.round(unit * 0.065), Math.floor(h * 0.45 / (lines.length * 1.25)));
    const lineHeight = Math.round(ctaSize * 1.25);
    lines.forEach((line, i) => filters.push(draw(line,
      `fontsize=${ctaSize}:fontcolor=white:x=(w-text_w)/2:y=${Math.round(h * 0.48 - lines.length * lineHeight / 2 + i * lineHeight)}`)));
    filters.push(`drawbox=x=${margin}:y=${Math.round(h * 0.75)}:w=${w - margin * 2}:h=4:color=${accent}:t=fill`);
    filters.push(draw(brand, `fontsize=${Math.round(unit * 0.025)}:fontcolor=${accent}:x=(w-text_w)/2:y=${Math.round(h * 0.79)}`));
  } else {
    const phrases = captionPhrases(scene.sceneText, Math.floor((w - margin * 2) / (fontSize * 0.75)));
    const totalWeight = phrases.reduce((sum, phrase) => sum + phrase.length, 0) || 1;
    let elapsed = 0;
    filters.push(`drawbox=x=0:y=${Math.round(h * 0.77)}:w=iw:h=${Math.ceil(h * 0.23)}:color=0x090d16@0.72:t=fill`);
    phrases.forEach((phrase, i) => {
      const start = elapsed;
      elapsed += spokenDuration * phrase.length / totalWeight;
      const end = i === phrases.length - 1 ? duration : elapsed;
      filters.push(draw(phrase, `fontsize=${fontSize}:fontcolor=white:shadowcolor=black@0.4:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${Math.round(h * 0.83)}:enable='gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})'`));
    });
    filters.push(draw(String(index + 1).padStart(2, '0'), `fontsize=${Math.round(unit * 0.025)}:fontcolor=${accent}:x=w-text_w-${margin}:y=${margin}`));
  }
  filters.push('fade=t=in:st=0:d=0.16', `fade=t=out:st=${(duration - 0.18).toFixed(3)}:d=0.18`, 'format=yuv420p');
  const output = path.join(workDir, `clip-${index}.mp4`);
  await run(cmd.videoFilters(filters).audioFilters([
    ...(hasAudio ? ['loudnorm=I=-16:TP=-1.5:LRA=11'] : []),
    'aresample=48000', 'apad', `atrim=duration=${duration}`, 'asetpts=PTS-STARTPTS',
  ]).outputOptions(['-map 0:v:0', '-map 1:a:0', '-c:v libx264', '-preset fast', '-crf 19',
    '-c:a aac', '-b:a 192k', '-ac 2', `-t ${duration}`, '-r 30', '-movflags +faststart']).output(output), projectId);
  if (projectId) jobManager.checkCancelled(projectId);
  return { output, duration };
}
export async function assembleVideo({ scenes, ctaText, aspectRatio, productName = '', tone = 'Professional', projectId }) {
  if (!scenes?.length) throw new Error('At least one scene is required');
  if (projectId) jobManager.checkCancelled(projectId);
  fs.mkdirSync(uploadDir, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(uploadDir, 'render-'));
  if (projectId) jobManager.registerTempDir(projectId, workDir);
  const finalPath = path.join(uploadDir, `final-${randomUUID()}.mp4`);
  if (projectId) jobManager.registerTempFile(projectId, finalPath);
  const size = ASPECT_RATIO_CONFIGS[aspectRatio] || ASPECT_RATIO_CONFIGS['9:16'];
  const accent = tone === 'Luxury' ? '0xe7c789' : tone === 'Energetic' || tone === 'Funny' ? '0xc5f36b' : '0x67e8dc';
  try {
    const draw = typography(workDir);
    const clips = [];
    for (let index = 0; index < scenes.length; index++) {
      if (projectId) jobManager.checkCancelled(projectId);
      clips.push(await buildClip({ scene: scenes[index], index, size, workDir, draw, productName, accent, projectId }));
    }
    if (projectId) jobManager.checkCancelled(projectId);
    clips.push(await buildClip({ scene: scenes.at(-1), index: scenes.length, size, workDir, draw, productName, accent, closing: true, ctaText, projectId }));
    if (projectId) jobManager.checkCancelled(projectId);
    const list = path.join(workDir, 'clips.txt');
    fs.writeFileSync(list, clips.map(c => `file '${c.output.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    const joined = path.join(workDir, 'joined.mp4');
    await run(ffmpeg().input(list).inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy', '-movflags +faststart']).output(joined), projectId);
    if (projectId) jobManager.checkCancelled(projectId);
    let music = path.resolve(process.env.BACKGROUND_MUSIC || 'assets/music.mp3');
    if (!fs.existsSync(music) && process.env.BACKGROUND_MUSIC_MODE !== 'off') {
      music = writeAmbientMusic(path.join(workDir, 'ambient.wav'));
    }
    if (process.env.BACKGROUND_MUSIC_MODE !== 'off' && fs.existsSync(music)) {
      const duration = clips.reduce((sum, c) => sum + c.duration, 0);
      await run(ffmpeg().input(joined).input(music).inputOptions(['-stream_loop -1'])
        .complexFilter(`[1:a]loudnorm=I=-30:TP=-3:LRA=11,afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, duration - 1.5)}:d=1.5[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.95[a]`)
        .outputOptions(['-map 0:v', '-map [a]', '-c:v copy', '-c:a aac', '-b:a 192k', '-movflags +faststart']).output(finalPath), projectId);
    } else fs.copyFileSync(joined, finalPath);
    if (projectId) jobManager.checkCancelled(projectId);
    return finalPath;
  } catch (error) {
    fs.rmSync(finalPath, { force: true });
    throw error;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

