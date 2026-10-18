import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setupSh } from '../src/index';

/**
 * Windows readiness, Oct 18 (Vignesh tests the one prompt on his Windows laptop): Claude Code's shell there is Git Bash,
 * where uname says MINGW64_NT. The sh script must hand over to powershell.exe with the .ps1 URL and TLS 1.2 on, and do
 * nothing else itself (no claim, no claude call), so the code is used once, by the PowerShell script.
 */
function rig(unameOut: string, withPowershell: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'moovi win '));
  const bin = join(dir, 'bin x'); spawnSync('mkdir', ['-p', bin]);
  const rec = join(dir, 'calls.txt');
  const stub = (name: string, body: string) => { const p = join(bin, name); writeFileSync(p, `#!/bin/sh\n${body}\n`); chmodSync(p, 0o755); };
  stub('uname', `echo ${unameOut}`);
  if (withPowershell) stub('powershell.exe', `for a in "$@"; do printf '%s\\n' "$a" >> "${rec}"; done; echo PS_RAN`);
  stub('curl', `echo "curl $*" >> "${rec}.curl"; exit 7`);
  stub('claude', `echo "claude $*" >> "${rec}.claude"`);
  const script = join(dir, 'setup.sh');
  writeFileSync(script, setupSh('http://localhost:3200', 'mvs_0123456789abcdef0123456789abcdef'));
  const sysPath = '/usr/bin:/bin';
  const r = spawnSync('sh', [script], { env: { PATH: `${bin}:${sysPath}`, HOME: dir }, encoding: 'utf8', timeout: 20_000 });
  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const out = { r, args: read(rec), curl: read(`${rec}.curl`), claude: read(`${rec}.claude`) };
  rmSync(dir, { recursive: true, force: true });
  return out;
}

for (const u of ['MINGW64_NT-10.0-22631', 'MSYS_NT-10.0-22631', 'CYGWIN_NT-10.0']) {
  test(`windows: under ${u.split('_')[0]} the sh script hands over to powershell.exe and claims nothing itself`, () => {
    const { r, args, curl, claude } = rig(u, true);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /PS_RAN/);
    const a = args.split('\n');
    assert.ok(a.includes('-NoProfile') && a.includes('-ExecutionPolicy') && a.includes('Bypass') && a.includes('-Command'), args);
    const cmd = a[a.indexOf('-Command') + 1]!;
    assert.match(cmd, /SecurityProtocol -bor 3072/, 'TLS 1.2 on for Windows PowerShell 5.1');
    assert.match(cmd, /irm 'http:\/\/localhost:3200\/api\/brain\/setup\/mvs_0123456789abcdef0123456789abcdef\.ps1' \| iex/);
    assert.equal(curl, '', 'no claim from sh: the code is used once, by PowerShell');
    assert.equal(claude, '', 'no claude call from sh');
  });
}

test('windows: Git Bash with no powershell.exe on PATH falls through to the sh path (one clear line, no hang)', () => {
  const { r, curl } = rig('MINGW64_NT-10.0-22631', false);
  assert.match(r.stdout, /^MOOVI: (FAILED|connected)/m, r.stdout + r.stderr);
  assert.match(curl, /\/claim/, 'the sh path tried the claim itself');
});
