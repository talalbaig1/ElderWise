/** Object key inside the private `voice-notes` bucket. Never a URL. */
export function objectKeyFromAudioPath(audioPath: string): string | null {
  const trimmed = audioPath.trim().replace(/^\/+/, "");
  if (!trimmed) return null;
  return trimmed.replace(/^voice-notes\//, "");
}
