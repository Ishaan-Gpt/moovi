/**
 * Connect Claude Code tokens (bridge item 15). One token per user: minted on the website (shown once, inside the copy
 * and paste `claude mcp add` command), stored only as its sha256, revocable, with a last seen time. Minting again
 * replaces the old token, and a token counts only while it is the user's current one, so a revoke or a re-mint cuts
 * off every Claude Code that still has the old one on its next request.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { KEY, type BrainStore } from './store';
import type { Verified } from './http';

export const TOKEN_PREFIX = 'mvk_';
const TOKEN_RE = /^mvk_[A-Za-z0-9_-]{43}$/;
export const SEEN_EVERY_MS = 30_000;

export interface TokenRecord { id: string; user: string; label: string; createdAt: number; last4: string; lastSeen: number | null }
export interface LinkStatus { linked: boolean; label: string | null; token_last4: string | null; created_at: number | null; last_seen: number | null }

export const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');
export const isTokenShape = (token: string) => TOKEN_RE.test(token);

/** The one command the website shows: user scope, so it works from every folder (plan 21b). */
export function connectCommand(mcpUrl: string, token: string): string {
  return `claude mcp add --scope user --transport http moovi ${mcpUrl} --header "Authorization: Bearer ${token}"`;
}

export class TokenStore {
  constructor(readonly store: BrainStore, readonly now: () => number = Date.now) {}

  private async current(user: string): Promise<{ hash: string; id: string } | null> {
    const v = await this.store.get(KEY.link(user)); return v ? JSON.parse(v) as { hash: string; id: string } : null;
  }

  /** true while this token id is still the user's current one (not removed, not replaced by a newer one) */
  async isCurrent(user: string, id: string): Promise<boolean> { return (await this.current(user))?.id === id; }

  /** A new token for the user (the old one stops working). The token itself is returned once and never stored. */
  async mint(user: string, label = 'Claude Code'): Promise<{ token: string; record: TokenRecord }> {
    if (!user) throw new Error('mint needs a user');
    const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
    const hash = hashToken(token);
    const record: TokenRecord = { id: `tk_${randomUUID().slice(0, 8)}`, user, label: label.slice(0, 60), createdAt: this.now(), last4: token.slice(-4), lastSeen: null };
    const old = await this.current(user);
    await this.store.set(KEY.token(hash), JSON.stringify(record));
    await this.store.set(KEY.link(user), JSON.stringify({ hash, id: record.id }));
    if (old && old.hash !== hash) await this.store.del(KEY.token(old.hash));
    return { token, record };
  }

  /** The user and token id a bearer token stands for, or null (wrong shape, unknown, revoked or replaced). */
  async verify(token: string): Promise<Verified | null> {
    if (!isTokenShape(token)) return null;
    const hash = hashToken(token);
    const raw = await this.store.get(KEY.token(hash)); if (!raw) return null;
    const rec = JSON.parse(raw) as TokenRecord;
    const cur = await this.current(rec.user);
    if (!cur || cur.hash !== hash) return null;
    const t = this.now();
    if (rec.lastSeen === null || t - rec.lastSeen >= SEEN_EVERY_MS) await this.store.set(KEY.token(hash), JSON.stringify({ ...rec, lastSeen: t }));
    return { user: rec.user, tokenId: rec.id };
  }

  /** Disconnect: the user's token stops working at once. True when there was one. */
  async revoke(user: string): Promise<boolean> {
    const cur = await this.current(user); if (!cur) return false;
    await this.store.del(KEY.token(cur.hash));
    await this.store.del(KEY.link(user));
    return true;
  }

  async status(user: string): Promise<LinkStatus> {
    const cur = await this.current(user);
    const raw = cur ? await this.store.get(KEY.token(cur.hash)) : null;
    if (!raw) return { linked: false, label: null, token_last4: null, created_at: null, last_seen: null };
    const r = JSON.parse(raw) as TokenRecord;
    return { linked: true, label: r.label, token_last4: r.last4, created_at: r.createdAt, last_seen: r.lastSeen };
  }
}
