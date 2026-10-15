/**
 * A minimal MP4 muxer for one H.264 video track, so a film can be written without ffmpeg: the browser's WebCodecs
 * encoder makes the samples (AVCC, length-prefixed, no B-frames) and this lays them out as a progressive-download file
 * (ftyp, moov, mdat). No audio, no edit lists, one chunk of samples; everything a player needs to seek and play.
 */
export interface Sample { data: Uint8Array; /** microseconds */ ts: number; dur: number; key: boolean }

const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const box = (type: string, ...parts: Buffer[]) => { const body = Buffer.concat(parts); return Buffer.concat([u32(8 + body.length), Buffer.from(type, 'latin1'), body]); };
const full = (type: string, version: number, flags: number, ...parts: Buffer[]) => box(type, Buffer.from([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts);
const zeros = (n: number) => Buffer.alloc(n);

const MATRIX = Buffer.concat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

/** @param avcC the decoder configuration record WebCodecs gives as `description` */
export function muxMp4(samples: Sample[], avcC: Uint8Array, width: number, height: number): Buffer {
  if (!samples.length) throw new Error('No samples to write');
  const TS = 90_000, ordered = [...samples].sort((a, b) => a.ts - b.ts);
  // durations in the movie's timescale, from the gaps between timestamps (the last one keeps its own duration)
  const t0 = ordered[0]!.ts, dts = ordered.map(s => Math.round(((s.ts - t0) * TS) / 1e6));
  const durs = ordered.map((s, i) => (i + 1 < ordered.length ? dts[i + 1]! - dts[i]! : Math.max(1, Math.round((s.dur * TS) / 1e6))));
  const total = durs.reduce((a, b) => a + b, 0);

  // time-to-sample: runs of equal durations
  const runs = (() => { const r: [number, number][] = []; for (const d of durs) { const l = r.at(-1); if (l && l[1] === d) l[0]++; else r.push([1, d]); } return r; })();
  const sttsBox = full('stts', 0, 0, u32(runs.length), ...runs.map(([c, d]) => Buffer.concat([u32(c), u32(d)])));
  const keys = ordered.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
  const stss = full('stss', 0, 0, u32(keys.length), ...keys.map(k => u32(k)));
  const stsz = full('stsz', 0, 0, u32(0), u32(ordered.length), ...ordered.map(s => u32(s.data.length)));
  const stsc = full('stsc', 0, 0, u32(1), u32(1), u32(ordered.length), u32(1));

  const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xffff), box('avcC', Buffer.from(avcC)));
  const stsd = full('stsd', 0, 0, u32(1), avc1);
  const build = (offset: number) => {
    const stco = full('stco', 0, 0, u32(1), u32(offset));
    const stbl = box('stbl', stsd, sttsBox, stss, stsc, stsz, stco);
    const minf = box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
    const mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(total), u16(0x55c4), u16(0)), full('hdlr', 0, 0, u32(0), Buffer.from('vide', 'latin1'), zeros(12), Buffer.from('VideoHandler\0', 'latin1')), minf);
    const trak = box('trak', full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(total), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width << 16), u32(height << 16)), mdia);
    return box('moov', full('mvhd', 0, 0, u32(0), u32(0), u32(TS), u32(total), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2)), trak);
  };
  const ftyp = box('ftyp', Buffer.from('isom', 'latin1'), u32(0x200), Buffer.from('isomiso2avc1mp41', 'latin1'));
  const mdatSize = ordered.reduce((a, s) => a + s.data.length, 0);
  // moov comes before the media data (the file plays while it downloads); its size does not depend on the offset it holds
  const moovLen = build(0).length, offset = ftyp.length + moovLen + 8;
  return Buffer.concat([ftyp, build(offset), u32(8 + mdatSize), Buffer.from('mdat', 'latin1'), ...ordered.map(s => Buffer.from(s.data))]);
}
