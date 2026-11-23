// Synthesized WebAudio only — no audio files. Gunshots, siren, engine hum,
// mission jingle, crashes and explosions, all made from oscillators and noise.
export function createAudio() {
  let ctx = null, muted = false, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenT = 0;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(ctx.destination); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination); sirenOsc.start();
      return true;
    } catch { return false; }
  }
  function noise(dur, freq, gainVal) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gainVal;
    src.connect(filter); filter.connect(g); g.connect(ctx.destination); src.start();
  }
  function tone(freq, dur, type, gainVal, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gainVal, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; if (sirenGain) sirenGain.gain.value = 0; return muted; },
    isMuted() { return muted; },
    shoot() { noise(0.09, 3000, 0.25); tone(180, 0.07, 'square', 0.12, 60); },
    reload() { tone(420, 0.06, 'square', 0.08, 300); setTimeout(() => tone(520, 0.06, 'square', 0.08, 340), 90); },
    crash() { noise(0.25, 500, 0.3); },
    explode() { noise(0.7, 300, 0.5); tone(80, 0.6, 'sine', 0.3, 30); },
    hit() { tone(220, 0.08, 'square', 0.1, 140); },
    pickup() { tone(660, 0.12, 'sine', 0.18); setTimeout(() => tone(880, 0.15, 'sine', 0.18), 110); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.2), i * 120)); },
    update(dt, speed, wanted) {
      if (!ctx || muted) return;
      if (engineGain) engineGain.gain.value = speed > 10 ? 0.03 + Math.min(0.05, speed / 9000) : 0;
      if (engineOsc) engineOsc.frequency.value = 45 + speed * 0.18;
      if (sirenGain) {
        sirenGain.gain.value = wanted > 0 ? 0.035 : 0;
        if (wanted > 0) { sirenT += dt; sirenOsc.frequency.value = sirenT % 1 < 0.5 ? 750 : 950; }
      }
    },
  };
}
