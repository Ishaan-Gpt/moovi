# refine_en.py: the English dub's clock. (1) pins the English word starts (words_en.py) to the real pauses of the Titan
# take and divides by the tempo -> TIMING_CAP_EN (English words, for captions and subtitles). (2) re-times the film: every
# Hindi cue word of timing.js is moved onto the English clock through anchor pairs (a Hindi word and the English word that
# says the same thing), so each picture beat lands on its English phrase -> TIMING (same word keys, new times).
# python3 hi/audio/refine_en.py <words-en-raw.json> hi/timing.js hi/timing-en.js
import json, sys, subprocess, re
TEMPO = 1.4
d = json.load(open(sys.argv[1])); ws = d['words']
err = subprocess.run('ffmpeg -hide_banner -i audio/take-titan.mp3 -af silencedetect=noise=-35dB:d=0.2 -f null -'.split(), capture_output=True, text=True).stderr
sil = list(zip([float(x) for x in re.findall(r'silence_start: ([0-9.]+)', err)], [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', err)]))
cands = []
for k in range(len(ws) - 1):
    if re.search(r'[,.?:]$', ws[k]['word']) or ws[k]['line'] != ws[k + 1]['line']:
        mid = (ws[k]['end'] + ws[k + 1]['t']) / 2
        for si, (a, b) in enumerate(sil):
            if abs(mid - (a + b) / 2) < 0.7: cands.append((abs(mid - (a + b) / 2), k, si))
cands.sort(); uk = set(); us = set(); pairs = []
for dist, k, si in cands:
    if k in uk or si in us: continue
    uk.add(k); us.add(si); pairs.append((k, si))
pairs.sort(); mono = []
for k, si in pairs:
    if mono and si <= mono[-1][1]: continue
    mono.append((k, si))
src = [ws[0]['t']]; dst = [ws[0]['t']]
for k, si in mono: a, b = sil[si]; src += [ws[k]['end'], max(ws[k]['end'] + 1e-3, ws[k + 1]['t'])]; dst += [a, b]
src.append(ws[-1]['end'] + 1e-3); dst.append(min(d['dur'], max(ws[-1]['end'], dst[-1] + 0.2)))
def mp(t, last=False):
    for i in (range(len(src) - 2, -1, -1) if last else range(len(src) - 1)):
        if src[i] <= t <= src[i + 1]: return dst[i] + (t - src[i]) / max(1e-6, src[i + 1] - src[i]) * (dst[i + 1] - dst[i])
    return t
for w in ws: w['t2'] = mp(w['t'] + 2e-3, True); w['e2'] = mp(w['end'])
for i in range(len(ws) - 1):
    ws[i]['e2'] = min(ws[i]['e2'], ws[i + 1]['t2'])
    if ws[i]['e2'] - ws[i]['t2'] < 0.06: ws[i]['e2'] = min(ws[i + 1]['t2'], ws[i]['t2'] + 0.12)
EN = [[{'word': w['word'], 't': round(w['t2'] / TEMPO, 3), 'end': round(w['e2'] / TEMPO, 3)} for w in ws if w['line'] == li] for li in range(10)]
# ---- the film's cue words on the English clock
HI = json.loads(re.search(r'window\.TIMING = (\{.*\});', open(sys.argv[2], encoding='utf-8').read(), re.S).group(1))['lines']
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
def find(L, w, n=0):
    hits = [x for x in L if norm(x['word']) == norm(w)]
    if len(hits) <= n: raise SystemExit('anchor word missing: ' + w)
    return hits[n]
ANCH = {0: [('duniya', 'the'), ('aur', 'played'), ('kasam', 'sworn'), ('chot', 'hurt')], 1: [('aur', 'and'), ('mission', 'mission'), ('ye', 'steal')], 2: [('shaanti', 'looks'), ('aur', 'and'), ('chaabi', 'keys'), ('haath', 'shaking')],
        3: [('sunehra', 'golden'), ('jal', 'lights'), ('aur', 'and'), ('unke', 'starts')], 4: [('chaaron', 'closes'), ('sabki', 'with'), ('tani', 'raised'), ('aur', 'and'), ('hukum', 'only'), ('hathiyaar', 'pick')],
        5: [('jaan', 'run'), ('ya', 'or'), ('par', 'but'), ('kuch', 'does')], 6: [('paalthi', 'cross-legged'), ('aankhein', 'closes'), ('aur', ('and', 1)), ('saans', 'breathing')],
        7: [('leader', 'leader'), ('bandook', 'points'), ('taan', 'gun'), ('aur', ('and', 1)), ('koi', 'nobody'), ('nahi', 'pulls')], 8: [('neeche', 'come'), ('jab', 'until'), ('ruk', 'stopped'), ('dekhne', 'watch')], 9: [('toh', 'could'), ('Comment', 'Tell')]}
OUT = []; used = 0
for li in range(10):
    H, E = HI[li], EN[li]; a = [(H[0]['t'], E[0]['t'])]
    for hw, ew in ANCH[li]:
        e = find(E, *(ew if isinstance(ew, tuple) else (ew, 0))); h = find(H, hw); p = (h['t'], e['t'])
        if p[0] > a[-1][0] + 0.02 and p[1] > a[-1][1] + 0.02: a.append(p); used += 1
        else: print('anchor skipped (order)', li, hw, ew)
    a.append((H[-1]['end'], E[-1]['end']))
    def wp(t):
        for i in range(len(a) - 1):
            if t <= a[i + 1][0] or i == len(a) - 2: return a[i][1] + (t - a[i][0]) / max(1e-6, a[i + 1][0] - a[i][0]) * (a[i + 1][1] - a[i][1])
    OUT.append([{'word': w['word'], 't': round(wp(w['t']), 3), 'end': round(wp(w['end']), 3)} for w in H])
T = {'duration': round(d['dur'] / TEMPO, 3), 'tempo': TEMPO, 'dub': 'en', 'lines': OUT}
open(sys.argv[3], 'w', encoding='utf-8').write('// timing-en.js: the English dub (Titan take, atempo 1.4). TIMING keeps the film\'s Hindi cue words, moved onto the English clock through\n// anchor word pairs (audio/refine_en.py); TIMING_CAP_EN is the English words themselves, for captions and subtitles. Loaded by ?dub=en.\nwindow.TIMING = ' + json.dumps(T, ensure_ascii=False) + ';\nwindow.TIMING_CAP_EN = ' + json.dumps(EN, ensure_ascii=False) + ';\n')
print(len(mono), 'pause anchors of', len(sil), '| cue anchors used', used, '| duration', T['duration'])
for li in range(10): print(li, EN[li][0]['t'], EN[li][-1]['end'], '| hi was', HI[li][0]['t'], HI[li][-1]['end'])
