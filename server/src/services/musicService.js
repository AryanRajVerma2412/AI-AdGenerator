import fs from "node:fs";

// Original, locally synthesized ambient bed. No API, download, or music licence needed.
export function writeAmbientMusic(outputPath, seconds = 8) {
  const rate = 24000;
  const samples = Math.ceil(seconds * rate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(samples * 2, 40);
  const chords = [[130.81, 164.81, 196], [110, 130.81, 164.81], [87.31, 130.81, 174.61], [98, 146.83, 196]];
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const phase = t % 2;
    const envelope = Math.min(1, phase / 0.2, (2 - phase) / 0.3);
    const notes = chords[Math.floor(t / 2) % chords.length];
    const pad = notes.reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t), 0) / 3;
    const pulse = Math.sin(2 * Math.PI * notes[0] * 2 * t) * Math.exp(-8 * (t % 0.5));
    buffer.writeInt16LE(Math.round((pad * 0.14 + pulse * 0.04) * envelope * 32767), 44 + i * 2);
  }
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
