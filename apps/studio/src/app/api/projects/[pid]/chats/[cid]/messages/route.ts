import { LEGACY_AGENT, MENTIONABLE, newId, PRESETS, sendCommand, userSay, type Preset } from '@moovi/engine';
import { styleOf } from '@moovi/engine/styles';
import { apiProject, fail, offline } from '@/lib/session';
import { chat } from '@/lib/project';

export const runtime = 'nodejs';

/**
 * Everything the user says to the crew. The studio writes the user's message into the chat, then sends the engine a
 * command; the engine owns every decision (a first brief starts a run; later messages go to Moovi or an @agent).
 */
type Body = { kind: 'brief' | 'message' | 'answer' | 'stop'; text?: string; uploads?: string[]; ratio?: 'auto' | '9:16' | '16:9' | '1:1' | '4:5'; question?: string; choice?: string; label?: string;
  /** one of the four live-preview styles (the brief box's picker): its pipeline runs as one engine job */
  style?: { id?: string; url?: string; script?: string; brand?: string };
  /** decision 19: the preset picked first (the engine refuses a brief without one), and Edit's part of the clip */
  preset?: string; trim?: { upload?: string; in?: number; out?: number } };

/** FalkorDB down: the composer shows "Moovi's memory is offline" (decision 13). */
export const POST = (req: Request, ctx: { params: Promise<{ pid: string; cid: string }> }) => send(req, ctx).catch(offline);

async function send(req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const r = await apiProject(req, pid, { write: true });
  if ('error' in r) return r.error;
  const c = await chat(pid, cid);
  if (!c) return fail(404, 'No such chat.');
  const b = await req.json().catch(() => null) as Body | null;
  if (!b) return fail(400, 'Nothing to send.');
  const text = (b.text ?? '').trim().slice(0, 4000);
  const uploads = (b.uploads ?? []).filter(u => /^f[0-9a-f]{14}$/.test(u)).slice(0, 6);
  const base = { user: r.user.id, project: pid, chat: cid };
  if (b.kind === 'stop') { await sendCommand({ type: 'stop', ...base }); return Response.json({ ok: true }); }
  if (b.kind === 'answer') {
    if (!b.question || !b.choice) return fail(400, 'Which answer?');
    await userSay(pid, cid, b.label ?? b.choice, { answer: b.choice, question: b.question });
    await sendCommand({ type: 'answer', ...base, question: b.question, choice: b.choice });
    return Response.json({ ok: true });
  }
  if (b.kind === 'brief' && b.style?.id) {
    const info = styleOf(b.style.id);
    if (!info) return fail(400, 'Pick one of the styles.');
    let url = (b.style.url ?? '').trim() || (text.match(/https?:\/\/[^\s]+/)?.[0] ?? '');
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    try { if (url) { const u = new URL(url); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error(); url = u.toString(); } } catch { return fail(400, 'That link doesn’t look like a website.'); }
    const script = info.inputs.includes('script') ? (b.style.script ?? '').trim().slice(0, 4000) : '';
    if (!url && !script) return fail(400, info.inputs.includes('script') ? 'Paste a site link or your script.' : 'Paste the site link.');
    const brand = (b.style.brand ?? '').trim().slice(0, 60) || undefined;
    const said = text || `${info.name} reel ${url ? `for ${url}` : 'from my script'}`;
    const msg = await userSay(pid, cid, said, { style: info.id, ...(url ? { url } : {}), ...(script ? { script: true } : {}) });
    await sendCommand({ type: 'brief', ...base, text: said, ratio: '9:16', uploads: [], message: msg.id, style: { id: info.id, ...(url ? { url } : {}), ...(script ? { script } : {}), ...(brand ? { brand } : {}) } });
    return Response.json({ message: msg, id: newId('ok') });
  }
  if (!text && !uploads.length) return fail(400, 'Write something, or add a file.');
  const mentions = [...new Set([...text.matchAll(/@([a-z]+)/gi)].map(m => m[1]!.toLowerCase()).map(m => ({ ...LEGACY_AGENT, art: 'designer', artdirector: 'designer', assets: 'researcher', shot: 'designer', shotbuilder: 'designer', research: 'researcher' } as Record<string, string>)[m] ?? m))].filter(m => MENTIONABLE.includes(m as never) || m === 'video');
  const msg = await userSay(pid, cid, text, { ...(uploads.length ? { uploads } : {}), ...(mentions.length ? { mentions } : {}) });
  const first = b.kind === 'brief' || (c.videoStatus === 'none' && c.status === 'new');
  const preset = (PRESETS as readonly string[]).includes(b.preset ?? '') ? b.preset as Preset : undefined;
  const t = b.trim, trim = preset === 'edit' && t?.upload && uploads.includes(t.upload) && Number.isFinite(t.in) && Number.isFinite(t.out) && t.out! > t.in! ? { upload: t.upload, in: t.in!, out: t.out! } : undefined;
  if (first) await sendCommand({ type: 'brief', ...base, text, ratio: b.ratio ?? 'auto', uploads, message: msg.id, ...(preset ? { preset } : {}), ...(trim ? { trim } : {}) });
  else await sendCommand({ type: 'message', ...base, text, mentions, uploads, message: msg.id });
  return Response.json({ message: msg, id: newId('ok') });
}
