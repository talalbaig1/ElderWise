/** Generate a short calm demo tone as a WAV blob URL (no external assets). */

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export function createDemoWavUrl(durationSeconds: number, seed = 1): string {
  const sampleRate = 22050;
  const duration = Math.min(Math.max(durationSeconds, 3), 30);
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  const base = 196 + (seed % 5) * 12; // soft low tones
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 3) * Math.min(1, (duration - t) * 2);
    const wobble = Math.sin(2 * Math.PI * (0.35 + (seed % 3) * 0.1) * t) * 0.15;
    const sample =
      Math.sin(2 * Math.PI * base * t) * 0.22 * env +
      Math.sin(2 * Math.PI * (base * 1.5) * t) * 0.08 * env +
      wobble * 0.05 * env;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped * 0x7fff, true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}
