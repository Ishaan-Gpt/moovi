// The library's sound design for live previews: plays the engine's sfx map (packages/engine/assets/sfx/map.json:
// events → sounds with level, alternates, align and layered "then" hits) by EVENT NAME, never by file. And it can
// listen to a reference's own audio first: `nativeHas(t)` is true when the reference already has a hit there, so a
// clone only ADDS sound design where the original has none (enhancement, not doubling).
//   const S = await sfxKit(audioContext, { base: '/packages/engine/assets/sfx/' });
//   await S.analyse('../voice.mp3');           // optional: find the reference's own hits
//   S.play('card-in', { when: AC.currentTime }); // or S.cue('scene', t) from a timeline
'use strict';
async function sfxKit(AC, o = {}) {
  const base = o.base ?? '/packages/engine/assets/sfx/', out = AC.createGain(); out.gain.value = o.gain ?? 1.6; out.connect(o.dest ?? AC.destination);
  const map = await (await fetch(base + 'map.json')).json(), buf = {}, turn = {};
  await Promise.all(Object.entries(map.sounds).map(async ([id, s]) => {
    try { buf[id] = await AC.decodeAudioData(await (await fetch(base + s.file)).arrayBuffer()); } catch (e) { console.warn('sfx', id, e); }
  }));
  const peakOf = id => { // where the loudest moment sits in a sound (for align: 'peak'), measured once
    const b = buf[id]; if (!b) return 0; if (b._peak != null) return b._peak;
    const d = b.getChannelData(0); let m = 0, at = 0; for (let i = 0; i < d.length; i += 32) { const v = Math.abs(d[i]); if (v > m) { m = v; at = i; } }
    return (b._peak = at / b.sampleRate);
  };
  const db = v => Math.pow(10, v / 20) * 4; // level_db is the RMS target in the SFX stem; ×4 lifts it to sit under a voice
  function playSound(id, when, levelDb, align, maxLen) {
    const b = buf[id]; if (!b) return;
    const n = AC.createBufferSource(), g = AC.createGain(); n.buffer = b; g.gain.value = db(levelDb);
    let start = when; if (align === 'peak') start = when - peakOf(id); if (align === 'end') start = when - b.duration;
    n.connect(g); g.connect(out); n.start(Math.max(AC.currentTime, start), Math.max(0, AC.currentTime - start)); if (maxLen) n.stop(Math.max(AC.currentTime, start) + maxLen);
  }
  /** play an EVENT (map.events): rotates its alternates so repeats never sound identical, layers its "then" sound */
  function play(event, { when = AC.currentTime, gainDb = 0 } = {}) {
    const e = map.events[event]; if (!e) return console.warn('sfx: no event', event);
    const i = (turn[event] = ((turn[event] ?? -1) + 1)), id = e.sounds[i % e.sounds.length], s = map.sounds[id] ?? {};
    playSound(id, when, (e.level_db ?? -25) + gainDb + (e.every && i % e.every ? (e.fade_db ?? 0) : 0), s.align, e.max_len ?? s.slice_len);
    if (e.then) playSound(e.then.sound, when + (e.then.after ?? 0), e.then.level_db ?? e.level_db, map.sounds[e.then.sound]?.align);
  }
  // the reference's own hits: an envelope of its high band (> 3.5 kHz, where whooshes, pops and hits live and speech is thin)
  let env = null, hop = 0.01;
  async function analyse(url) {
    const raw = await (await fetch(url)).arrayBuffer(), src = await AC.decodeAudioData(raw);
    const off = new OfflineAudioContext(1, src.length, src.sampleRate), n = off.createBufferSource(), hp = off.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3500; n.buffer = src; n.connect(hp); hp.connect(off.destination); n.start();
    const d = (await off.startRendering()).getChannelData(0), step = Math.round(src.sampleRate * hop);
    env = new Float32Array(Math.floor(d.length / step));
    for (let i = 0; i < env.length; i++) { let s = 0; for (let j = 0; j < step; j++) { const v = d[i * step + j]; s += v * v; } env[i] = Math.sqrt(s / step); }
    return env.length;
  }
  /** true when the reference already has a hit near t (peak in [t-0.08, t+0.15] well above the local median) */
  function nativeHas(t, ratio = o.ratio ?? 3.2) {
    if (!env) return false;
    const i0 = Math.max(0, Math.floor((t - 0.08) / hop)), i1 = Math.min(env.length - 1, Math.floor((t + 0.15) / hop));
    let pk = 0; for (let i = i0; i <= i1; i++) pk = Math.max(pk, env[i]);
    const w0 = Math.max(0, Math.floor((t - 1.5) / hop)), w1 = Math.min(env.length - 1, Math.floor((t + 1.5) / hop)), win = Array.from(env.slice(w0, w1)).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)] || 1e-6;
    return pk / med > ratio;
  }
  /** a timeline cue: play `event` at timeline time t unless the reference already has a hit there (when enhance is on) */
  function cue(event, t, o2 = {}) { if (o2.enhanceOnly !== false && o.enhanceOnly !== false && nativeHas(t)) return false; play(event, o2); return true; }
  return { play, cue, analyse, nativeHas, events: Object.keys(map.events), out };
}
