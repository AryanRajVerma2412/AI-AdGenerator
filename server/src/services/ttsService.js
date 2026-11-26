import axios from "axios";
import fs from "fs";
import path from "path";
import googleTTS from "google-tts-api";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { saveSpeechStream } from "./speechStream.js";
import { jobManager, JobCancelledError } from "./jobManager.js";

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || ffprobeInstaller.path);

const uploadDir = path.resolve("uploads");

/**
 * Catalog of available voice profiles with distinct neural models.
 */
export const AVAILABLE_VOICES = [
  {
    id: "adam",
    name: "Adam",
    gender: "male",
    style: "Deep & Confident",
    description: "Deep, commanding voice ideal for electronics, luxury, and tech.",
    sampleText: "Experience peak performance and precision. Built for those who demand the best.",
    elevenLabsId: "pNInz6obpgDQGcFmaJgB",
    neuralVoice: "en-US-GuyNeural",
  },
  {
    id: "rachel",
    name: "Rachel",
    gender: "female",
    style: "Warm & Engaging",
    description: "Friendly, inviting voice suited for fashion, food, and lifestyle.",
    sampleText: "Discover everyday comfort and effortless style that brings a smile to your life.",
    elevenLabsId: "21m00Tcm4TlvDq8ikWAM",
    neuralVoice: "en-US-JennyNeural",
  },
  {
    id: "marcus",
    name: "Marcus",
    gender: "male",
    style: "Energetic & Modern",
    description: "High-energy, punchy voice perfect for fitness, retail, and sales.",
    sampleText: "Level up your game right now! High energy, fast results, and zero excuses!",
    elevenLabsId: "ErXwobaYiN019PkySvjV",
    neuralVoice: "en-US-ChristopherNeural",
  },
  {
    id: "bella",
    name: "Bella",
    gender: "female",
    style: "Luxury & Elegant",
    description: "Soft, sophisticated tone for jewellery, beauty, and real estate.",
    sampleText: "Indulge in timeless elegance, exquisite craftsmanship, and radiant perfection.",
    elevenLabsId: "EXAVITQu4vr4xnSDxMaL",
    neuralVoice: "en-US-AriaNeural",
  },
  {
    id: "josh",
    name: "Josh",
    gender: "male",
    style: "Professional & Corporate",
    description: "Articulate, trustworthy narrator for B2B, SaaS, and education.",
    sampleText: "Drive measurable impact with data-backed efficiency and enterprise-grade reliability.",
    elevenLabsId: "TxGEqnHWrfWFTfGW9XjX",
    neuralVoice: "en-US-EricNeural",
  },
  {
    id: "sophia",
    name: "Sophia",
    gender: "female",
    style: "Upbeat & Viral",
    description: "Dynamic, modern delivery ideal for TikTok and Instagram Reels.",
    sampleText: "Hey! You won't believe how incredible this is—check it out before it sells out!",
    elevenLabsId: "ThT5KcBeYPX3keUQqHPh",
    neuralVoice: "en-US-MichelleNeural",
  },
];

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English (US/Global)" },
  { code: "es", name: "Spanish (Español)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "hi", name: "Hindi (हिंदी)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "pt", name: "Portuguese (Português)" },
];

const MULTILINGUAL_NEURAL_VOICES = {
  es: {
    adam: "es-ES-AlvaroNeural",
    rachel: "es-ES-ElviraNeural",
    marcus: "es-MX-JorgeNeural",
    bella: "es-MX-DaliaNeural",
    josh: "es-US-AlonsoNeural",
    sophia: "es-US-PalomaNeural",
    male: "es-ES-AlvaroNeural",
    female: "es-ES-ElviraNeural",
  },
  fr: {
    adam: "fr-FR-HenriNeural",
    rachel: "fr-FR-DeniseNeural",
    marcus: "fr-CA-AntoineNeural",
    bella: "fr-CA-SylvieNeural",
    josh: "fr-BE-GerardNeural",
    sophia: "fr-FR-EloiseNeural",
    male: "fr-FR-HenriNeural",
    female: "fr-FR-DeniseNeural",
  },
  de: {
    adam: "de-DE-ConradNeural",
    rachel: "de-DE-KatjaNeural",
    marcus: "de-DE-KillianNeural",
    bella: "de-DE-AmalaNeural",
    josh: "de-AT-JonasNeural",
    sophia: "de-CH-LeniNeural",
    male: "de-DE-ConradNeural",
    female: "de-DE-KatjaNeural",
  },
  hi: {
    adam: "hi-IN-MadhurNeural",
    rachel: "hi-IN-SwaraNeural",
    marcus: "hi-IN-MadhurNeural",
    bella: "hi-IN-SwaraNeural",
    josh: "hi-IN-MadhurNeural",
    sophia: "hi-IN-SwaraNeural",
    male: "hi-IN-MadhurNeural",
    female: "hi-IN-SwaraNeural",
  },
  it: {
    adam: "it-IT-DiegoNeural",
    rachel: "it-IT-ElsaNeural",
    marcus: "it-IT-GiuseppeNeural",
    bella: "it-IT-IsabellaNeural",
    josh: "it-IT-DiegoNeural",
    sophia: "it-IT-ElsaNeural",
    male: "it-IT-DiegoNeural",
    female: "it-IT-ElsaNeural",
  },
  ja: {
    adam: "ja-JP-KeitaNeural",
    rachel: "ja-JP-NanamiNeural",
    marcus: "ja-JP-DaichiNeural",
    bella: "ja-JP-AoiNeural",
    josh: "ja-JP-NaokiNeural",
    sophia: "ja-JP-MayuNeural",
    male: "ja-JP-KeitaNeural",
    female: "ja-JP-NanamiNeural",
  },
  pt: {
    adam: "pt-BR-AntonioNeural",
    rachel: "pt-BR-FranciscaNeural",
    marcus: "pt-BR-DonatoNeural",
    bella: "pt-BR-ElzaNeural",
    josh: "pt-PT-DuarteNeural",
    sophia: "pt-PT-RaquelNeural",
    male: "pt-BR-AntonioNeural",
    female: "pt-BR-FranciscaNeural",
  },
};

/**
 * Measure audio duration using ffprobe.
 */
export function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        resolve(5.0);
      } else {
        resolve(Number(metadata.format.duration));
      }
    });
  });
}

/**
 * Checks if ElevenLabs API key is configured and valid.
 */
function isElevenLabsConfigured() {
  const key = process.env.ELEVENLABS_API_KEY;
  return key && key.length > 10 && !key.includes("yahan") && !key.includes("your_");
}

/**
 * Apply audio speed adjustment if needed using FFmpeg.
 */
export async function adjustSpeedIfNeeded(inputPath, outputPath, speed = 1.0, projectId) {
  if (projectId) jobManager.checkCancelled(projectId);
  const s = Math.max(0.7, Math.min(1.6, Number(speed) || 1.0));
  if (Math.abs(s - 1.0) <= 0.03) {
    if (inputPath !== outputPath) fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      .audioFilters([`atempo=${s}`])
      .audioCodec("libmp3lame")
      .audioBitrate(128);
    let unregister = () => {};
    if (projectId) unregister = jobManager.registerProcess(projectId, cmd);

    cmd.on("end", () => { unregister(); resolve(outputPath); })
      .on("error", (err) => {
        unregister();
        if (projectId && jobManager.isCancelled(projectId)) return reject(new JobCancelledError());
        console.warn("Speed adjustment warning, using original audio:", err.message);
        if (inputPath !== outputPath) fs.copyFileSync(inputPath, outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

/**
 * Generates an MP3 voiceover for scene text or preview.
 * 1. Checks ElevenLabs (if configured)
 * 2. Uses Microsoft Edge Neural Speech with distinct Male/Female voice models
 * 3. Falls back to Google TTS + acoustic pitch adjustment if offline
 */
export async function generateVoiceOver({ 
  text, 
  voiceSettings = {}, 
  index = 0,
  isTemporaryPreview = false,
  abortSignal,
  projectId
}) {
  if (abortSignal?.aborted || (projectId && jobManager.isCancelled(projectId))) {
    throw new JobCancelledError();
  }
  const cleanText = (text || "").trim();
  if (!cleanText) throw new Error("No text provided for voiceover");

  const gender = voiceSettings.gender || "male";
  const speed = Number(voiceSettings.speed) || 1.0;
  const language = voiceSettings.language || "en";
  const voiceId = voiceSettings.voiceId || "adam";

  const voiceProfile = AVAILABLE_VOICES.find((v) => v.id === voiceId) || AVAILABLE_VOICES[0];
  
  // Use unique cache-busting filename for previews and scenes
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const prefix = isTemporaryPreview ? `preview-${voiceId}-${uniqueId}` : `voice-${uniqueId}-${index}`;
  const rawPath = path.join(uploadDir, `${prefix}-raw.mp3`);
  const finalPath = path.join(uploadDir, `${prefix}.mp3`);
  fs.mkdirSync(uploadDir, { recursive: true });
  if (projectId) {
    jobManager.registerTempFile(projectId, rawPath);
    jobManager.registerTempFile(projectId, finalPath);
  }
  const checkCancelled = () => {
    if (abortSignal?.aborted || (projectId && jobManager.isCancelled(projectId))) {
      fs.rmSync(rawPath, { force: true });
      fs.rmSync(finalPath, { force: true });
      throw new JobCancelledError();
    }
  };

  let generated = false;

  // 1. Try ElevenLabs if configured with real key
  if (process.env.TTS_PROVIDER === "elevenlabs" && isElevenLabsConfigured()) {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const elVoiceId = voiceProfile.elevenLabsId || process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}?output_format=mp3_44100_128`;

      const response = await axios.post(
        url,
        {
          text: cleanText,
          model_id: "eleven_multilingual_v2",
          voice_settings: { 
            stability: 0.5, 
            similarity_boost: 0.75,
            speed: speed 
          },
        },
        {
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          responseType: "arraybuffer",
          timeout: 15000,
          signal: abortSignal,
        }
      );

      fs.writeFileSync(finalPath, Buffer.from(response.data));
      checkCancelled();
      generated = true;
    } catch (err) {
      if (err.name === "CanceledError" || axios.isCancel(err) || abortSignal?.aborted || (projectId && jobManager.isCancelled(projectId))) {
        throw new JobCancelledError();
      }
      console.warn("ElevenLabs TTS failed, switching to Microsoft Neural TTS:", err?.response?.data || err.message);
    }
  }

  // 2. High-Quality Neural Voices (Microsoft Edge Neural Speech)
  if (!generated) {
    try {
      let neuralVoiceName = voiceProfile.neuralVoice || "en-US-GuyNeural";
      if (language !== "en" && MULTILINGUAL_NEURAL_VOICES[language]) {
        neuralVoiceName = MULTILINGUAL_NEURAL_VOICES[language][gender] || neuralVoiceName;
      }

      const tts = new MsEdgeTTS();
      await saveSpeechStream(tts, neuralVoiceName,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, cleanText, rawPath, 30000, abortSignal);

      // Apply speed adjustment if speed is not 1.0
      checkCancelled();
      await adjustSpeedIfNeeded(rawPath, finalPath, speed, projectId);
      if (fs.existsSync(rawPath) && rawPath !== finalPath) fs.unlinkSync(rawPath);
      generated = true;
    } catch (err) {
      checkCancelled();
      console.warn("Neural TTS unavailable, attempting Google TTS fallback:", err.message);
    }
  }

  // 3. Fallback: Google TTS + FFmpeg pitch & tempo adjustment
  if (!generated) {
    try {
      const chunks = await googleTTS.getAllAudioBase64(cleanText, {
        lang: language,
        slow: speed < 0.9,
        host: "https://translate.google.com",
        timeout: 10000,
      });
      checkCancelled();

      fs.writeFileSync(rawPath, Buffer.concat(chunks.map(chunk => Buffer.from(chunk.base64, "base64"))));
      
      // Fine-tune tone and speed through FFmpeg
      await new Promise((resolve, reject) => {
        const filters = ["aresample=44100"];
        if (gender === "male") {
          filters.push("asetrate=44100*0.90,atempo=1.11");
        } else {
          filters.push("asetrate=44100*1.08,atempo=0.92");
        }
        if (Math.abs(speed - 1.0) > 0.03) {
          filters.push(`atempo=${speed}`);
        }

        const cmd = ffmpeg(rawPath)
          .audioFilters(filters)
          .audioCodec("libmp3lame");
        let unregister = () => {};
        if (projectId) unregister = jobManager.registerProcess(projectId, cmd);
        cmd.on("end", () => { unregister(); resolve(); })
          .on("error", () => {
            unregister();
            if (abortSignal?.aborted || (projectId && jobManager.isCancelled(projectId))) return reject(new JobCancelledError());
            fs.copyFileSync(rawPath, finalPath);
            resolve();
          }).save(finalPath);
      });

      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      generated = true;
    } catch (err) {
      checkCancelled();
      console.error("All TTS engines failed:", err.message);
      throw new Error(`Voiceover generation failed: ${err.message}`);
    }
  }

  // Calculate actual duration with ffprobe for accurate synchronization
  const duration = await getAudioDuration(finalPath);
  checkCancelled();

  return {
    filePath: finalPath,
    duration,
  };
}


