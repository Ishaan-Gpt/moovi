/**
 * The voice, in TypeScript: Microsoft Edge's online text-to-speech (free, no key) with word timings in the same pass
 * (WordBoundary events), so no speech-to-text step is needed. A port of the edge-tts Python package's protocol
 * (WebSocket, SSML, the Sec-MS-GEC token); its token hash is checked against that package's output in
 * test/tts.test.ts. Writes <dir>/vo.wav (44.1 kHz mono, via ffmpeg) and <dir>/words.json ([{word, t, end}]).
 */
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_FULL = '143.0.3650.75', CHROMIUM_MAJOR = CHROMIUM_FULL.split('.')[0];
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL}`;
const HEADERS = {
  'Pragma': 'no-cache', 'Cache-Control': 'no-cache', 'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br, zstd', 'Accept-Language': 'en-US,en;q=0.9',
};

/* ───────── the Sec-MS-GEC token (v2): a salted SHA-256 variant and a 64-bit checksum, in BigInt for exactness ───────── */
const M32 = 0xffffffffn;
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2].map(BigInt);
const INITIAL = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19].map(BigInt);
const STATE = [0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2].map(BigInt);
const SCHEDULE = [0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6, 0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564].map(BigInt);
const ADJ = 0xc9dc06a7n, SIG0_ADJ = 0x059c0b80n, SIG1_ADJ = 0x000b92c0n;
const BLOCK_K = [...K.slice(0, 14), ADJ, ...K.slice(15)];
const CS64 = [[0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf], [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c], [0xe92491b1, 0x607801c6],
  [0xf0a5b9d5, 0x82b2c1fb], [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61], [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167]].map(([a, b]) => [BigInt(a!), BigInt(b!)] as const);
const CS64_FACTOR = 0x82893933n, CS64_ADJ0 = 0xf2f90b1an, CS64_ADJ1 = 0x0b1a0000n;

const rol16 = (v: bigint) => { v &= M32; return ((v << 16n) | (v >> 16n)) & M32; };
const sigma0 = (v: bigint) => ((v >> 7n) ^ (v << 25n) ^ (v >> 18n) ^ (v << 14n) ^ (v >> 3n)) & M32;
const sigma1 = (v: bigint) => ((v >> 17n) ^ (v << 15n) ^ (v >> 19n) ^ (v << 13n) ^ (v >> 10n)) & M32;
const beInt = (b: Uint8Array) => b.reduce((a, x) => (a << 8n) | BigInt(x), 0n);

function rounds(state: bigint[], w: bigint[], first = 0): bigint[] {
  let [a, b, c, d, e, f, g, h] = state as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  const k = first === 14 ? BLOCK_K : K;
  for (let i = first; i < 64; i++) {
    const re = e * 0x100000001n, ra = a * 0x100000001n;
    const t1 = h + ((re >> 6n) ^ (re >> 11n) ^ (re >> 25n)) + (g ^ (e & (f ^ g))) + k[i]! + w[i]!;
    const t2 = ((ra >> 2n) ^ (ra >> 13n) ^ (ra >> 22n)) + ((a & b) | (c & (a | b)));
    [a, b, c, d, e, f, g, h] = [(t1 + t2) & M32, a, b, c, (d + t1) & M32, e, f, g];
  }
  return [a, b, c, d, e, f, g, h];
}
function expand(w: bigint[], first = 16) {
  for (let i = first; i < 64; i++) {
    const x = w[i - 2]!, y = w[i - 15]!;
    const s1 = (x >> 17n) ^ (x << 15n) ^ (x >> 19n) ^ (x << 13n) ^ (x >> 10n), s0 = (y >> 7n) ^ (y << 25n) ^ (y >> 18n) ^ (y << 14n) ^ (y >> 3n);
    w.push((s1 + w[i - 7]! + s0 + w[i - 16]!) & M32);
  }
}
function init(salt: Uint8Array): bigint[] {
  const w: bigint[] = [...Array(14).fill(0n), beInt(salt.subarray(0, 3)), beInt(salt.subarray(3, 7))];
  for (let i = 16; i < 30; i++) {
    let v = SCHEDULE[i - 16]!;
    if (i - 2 >= 14) v += i === 16 ? (sigma1(w[i - 2]!) ^ SIG1_ADJ) : sigma1(w[i - 2]!);
    if (i - 7 >= 14) v += w[i - 7]!;
    if (i - 15 >= 14) v += i === 29 ? (sigma0(w[i - 15]!) ^ SIG0_ADJ) : sigma0(w[i - 15]!);
    w.push(v & M32);
  }
  w.push((sigma1(w[28]!) + w[23]! + sigma0(w[15]!) + w[14]! + ADJ - K[14]!) & M32);
  expand(w, 31);
  const working = rounds(STATE, w, 14);
  return INITIAL.map((x, i) => (x + working[i]!) & M32);
}
function digest(data: Uint8Array): Uint8Array {
  const len = 57 + data.length, pad = ((55 - len) % 64 + 64) % 64;
  const p = new Uint8Array(data.length - 7 + 1 + pad + 8);
  p.set(data.subarray(7)); p[data.length - 7] = 0x80;
  new DataView(p.buffer).setBigUint64(p.length - 8, BigInt(len * 8));
  let st = init(data);
  for (let o = 0; o < p.length; o += 64) {
    const w: bigint[] = []; for (let i = 0; i < 16; i++) w.push(BigInt(new DataView(p.buffer, o + i * 4, 4).getUint32(0)));
    expand(w);
    const working = rounds(st, w);
    st = st.map((x, i) => (x + working[i]!) & M32);
  }
  const out = new Uint8Array(32); st.forEach((x, i) => new DataView(out.buffer).setUint32(i * 4, Number(x)));
  return out;
}
function cs64(data: Uint8Array, dg: Uint8Array): [bigint, bigint] {
  const dv = new DataView(dg.buffer, dg.byteOffset);
  const ka = BigInt(dv.getUint32(0, true)) | 1n, kb = BigInt(dv.getUint32(4, true)) | 1n;
  const factors = [(ka * CS64_FACTOR) & M32, (kb * CS64_FACTOR) & M32];
  const terms = CS64.map(([c], i) => (c * factors[i % 2]!) & M32), offsets = CS64.map(([, o]) => o);
  const src = new Uint8Array(1 + data.length); src.set(data, 1);
  const padded = new Uint8Array(Math.ceil(src.length / 4) * 4); padded.set(src);
  const words: bigint[] = []; for (let i = 0; i < padded.length; i += 4) words.push(BigInt(new DataView(padded.buffer).getUint32(i, true)));
  if (words.length % 2) words.push(0n);
  words.forEach((word, i) => {
    let term = word * (i % 2 === 0 ? ka : kb), off = rol16(word) * (i % 2 === 0 ? 0xef0569fbn : 0xc31713dbn);
    if (i === 0) { term += CS64_ADJ0 * factors[0]!; off += CS64_ADJ1; }
    terms.push(term & M32); offsets.push(off & M32);
  });
  let swapAcc = 0n, swapLast = 0n, state = 0n, acc = 0n;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i]!, y = terms[i + 1]!;
    let t = rol16((offsets[i]! + x) & M32), q = (t * 0x76f50f34n) & M32;
    swapAcc += (rol16(q) * 0xc3efea97n + q) & M32;
    t = rol16((offsets[i + 1]! + y) & M32); q = (t * 0x1881ce3cn) & M32;
    swapLast = (rol16(q) * 0x35bd1ec9n + q) & M32;
    swapAcc = (swapAcc + swapLast) & M32;
    state = (state * ka + x) & M32;
    state = (rol16(state) * 0xcf98b111n) & M32; state = (rol16(state) * 0x87085b9fn) & M32;
    state = (rol16(state) * 0x12ceb96dn) & M32; state = (rol16(state) * 0x257e1d83n) & M32;
    acc += state;
    t = (state * kb + y) & M32; t = (rol16(t) * 0xa27416f5n) & M32; t = (rol16(t) * 0xd38396ffn) & M32;
    state = (rol16((rol16(t) * 0x7c932b89n) & M32) * 0xbfa49f69n) & M32;
    acc = (acc + state) & M32;
  }
  return [swapLast ^ state, swapAcc ^ acc];
}
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex').toUpperCase();
/** The Sec-MS-GEC v2 token for a Unix time (5-minute windows). */
export function secMsGec(unix = Date.now() / 1000 + skew): string {
  let ticks = Math.floor(unix + 11644473600); ticks -= ticks % 300;
  const data = new TextEncoder().encode(`${BigInt(ticks) * 10_000_000n}${TRUSTED_CLIENT_TOKEN}`);
  const dg = digest(data), [lo, hi] = cs64(data, dg);
  const c = new Uint8Array(8), dv = new DataView(c.buffer); dv.setUint32(0, Number(lo), true); dv.setUint32(4, Number(hi), true);
  return `${hex(c)}-${hex(dg)}`;
}
let skew = 0;

/* ───────── the protocol ───────── */
const xml = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsDate = () => new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) (.*) GMT$/, '$1 $3 $2 $4 $5 GMT+0000 (Coordinated Universal Time)');
const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export interface Word { word: string; t: number; end: number }

/** Speak `text`; resolves with the mp3 bytes and the word timings. */
export function synthesize(text: string, o: { voice: string; rate?: string; pitch?: string; volume?: string; signal?: AbortSignal; timeoutMs?: number }): Promise<{ mp3: Buffer; words: Word[] }> {
  return new Promise((resolve, reject) => {
    const url = `${WSS_URL}&ConnectionId=${randomUUID().replace(/-/g, '')}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
    const ws = new WebSocket(url, { headers: { ...HEADERS, Cookie: `muid=${randomBytes(16).toString('hex').toUpperCase()};` } } as unknown as string[]);
    ws.binaryType = 'arraybuffer';
    const audio: Buffer[] = [], words: Word[] = [];
    let done = false;
    const end = (e?: Error) => { if (done) return; done = true; clearTimeout(timer); o.signal?.removeEventListener('abort', onAbort); try { ws.close(); } catch { /* closed */ } if (e) reject(e); else resolve({ mp3: Buffer.concat(audio), words }); };
    const onAbort = () => end(Object.assign(new Error('cancelled'), { name: 'Cancelled' }));
    const timer = setTimeout(() => end(new Error(`the voice service did not finish in ${(o.timeoutMs ?? 60_000) / 1000} s`)), o.timeoutMs ?? 60_000);
    o.signal?.addEventListener('abort', onAbort, { once: true });
    ws.onopen = () => {
      ws.send(`X-Timestamp:${jsDate()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${o.voice}'><prosody pitch='${o.pitch ?? '+0Hz'}' rate='${o.rate ?? '+0%'}' volume='${o.volume ?? '+0%'}'>${xml(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${jsDate()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    };
    ws.onmessage = ev => {
      if (typeof ev.data === 'string') {
        const sep = ev.data.indexOf('\r\n\r\n'), head = ev.data.slice(0, sep), body = ev.data.slice(sep + 4);
        const path = /Path:([^\r\n]+)/.exec(head)?.[1]?.trim();
        if (path === 'audio.metadata') {
          for (const m of (JSON.parse(body) as { Metadata: { Type: string; Data: { Offset: number; Duration: number; text: { Text: string } } }[] }).Metadata) {
            if (m.Type !== 'WordBoundary') continue;
            const t = m.Data.Offset / 1e7;
            words.push({ word: unxml(m.Data.text.Text), t: +t.toFixed(3), end: +(t + m.Data.Duration / 1e7).toFixed(3) });
          }
        } else if (path === 'turn.end') end();
        return;
      }
      const b = Buffer.from(ev.data as ArrayBuffer), hl = b.readUInt16BE(0), head = b.subarray(2, 2 + hl).toString('utf8');
      if (/Path:audio/.test(head)) audio.push(b.subarray(2 + hl));
    };
    ws.onerror = () => end(new Error('the voice service refused the connection (Microsoft Edge TTS)'));
    ws.onclose = ev => { if (!done) end(ev.code === 1000 && audio.length ? undefined : new Error(`the voice service closed the connection (${ev.code})`)); };
  });
}

/**
 * Script → voice with word timings, the way every style needs it: reads <dir>/script.txt (lines starting with # are
 * notes), writes vo.wav (44.1 kHz mono) and words.json, with each word's punctuation given back from the script.
 */
export async function speak(dir: string, o: { voice: string; rate: string; signal?: AbortSignal; timeoutMs?: number }) {
  const text = readFileSync(join(dir, 'script.txt'), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).join(' ');
  const { mp3, words } = await synthesize(text, o);
  if (!mp3.length || !words.length) throw new Error('the voice service sent no audio');
  const mp3File = join(dir, 'vo.mp3'); writeFileSync(mp3File, mp3);
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', mp3File, '-ar', '44100', '-ac', '1', join(dir, 'vo.wav')]);
  rmSync(mp3File, { force: true });
  // the service reports words without their punctuation; give it back from the script so line text matches
  const toks = text.split(/\s+/), norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  let j = 0;
  for (const w of words) for (let k = j; k < Math.min(j + 4, toks.length); k++) if (norm(toks[k]!) === norm(w.word)) { w.word = toks[k]!; j = k + 1; break; }
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words, null, 1));
  return { words: words.length, seconds: words.at(-1)!.end };
}
