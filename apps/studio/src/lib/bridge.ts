/** The bridge's address for the browser: MOOVI_BRIDGE_PUBLIC_URL, else this site's own /studio on a server (the proxy
 * sends /studio/api/brain/* to the bridge, so it also works through a site that rewrites /studio here), else the dev bridge.
 * Shared by Your model (the Connect Claude Code card) and the rail's Claude Code pill. */
export const bridgeBase = () => (process.env.MOOVI_BRIDGE_PUBLIC_URL?.trim().replace(/\/+$/, '') ?? (process.env.NODE_ENV === 'production' ? '/studio' : 'http://localhost:3200'));
