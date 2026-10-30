let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call once from a user gesture (iOS needs it to unlock audio). */
export function unlockAudio() {
  try { audio(); } catch { /* ignore */ }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine") {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.35, a.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export function successFeedback() {
  try { tone(880, 0, 0.15); tone(1320, 0.15, 0.25); } catch { /* ignore */ }
  navigator.vibrate?.(120);
}

export function errorFeedback() {
  try { tone(220, 0, 0.25, "square"); tone(180, 0.28, 0.35, "square"); } catch { /* ignore */ }
  navigator.vibrate?.([200, 100, 200, 100, 300]);
}
