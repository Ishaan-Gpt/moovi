# words_en.py: word starts of the English take (Titan) by the same local method as words.py (espeak-ng en-us + MFCC DTW).
import sys, json, re, numpy as np
sys.path.insert(0, sys.argv[1]); out = sys.argv[2]
import align as A
script = open('SCRIPT.md', encoding='utf-8').read()
s = script.split('## English (for the voice and captions)')[1].split('\n## ')[0]
en = [re.sub(r'^\d+\.\s*', '', l).strip() for l in s.strip().split('\n') if re.match(r'^\d+\.', l)]
SUB = {'GTA': 'G T A', '6': 'six'}
x = A.load('audio/take-titan.mp3'); X = A.mfcc(x)
ws = []; wav = []; off = 0.0
for li, line in enumerate(en):
    toks = line.split(); text = ''; spans = []
    for t in toks:
        core = re.sub(r'[^\w-]', '', t); sub = SUB.get(core, None); a = len(text) + 1; text += (sub + t[len(core):] if sub else t) + ' '; spans.append((a, len(text)))
    w, ev = A.synth(text.strip(), 'en-us'); st = [None] * len(toks)
    for p, l, a in ev:
        for k, (s0, s1) in enumerate(spans):
            if s0 <= p < s1:
                if st[k] is None: st[k] = a
                break
    for k in range(len(st)):
        if st[k] is None: st[k] = st[k - 1] + 0.05 if k else 0.0
    for k in range(len(toks)): ws.append({'line': li, 'word': toks[k], 's': off + st[k]})
    sil = np.zeros(int(0.3 * A.SR), np.float32) + 1e-4 * np.random.RandomState(1).randn(int(0.3 * A.SR)).astype(np.float32)
    wav += [w, sil]; off += len(w) / A.SR + 0.3; ws[-1]['lineEnd'] = off - 0.3
Y = A.mfcc(np.concatenate(wav)); c, path = A.dtw(Y, X); path = np.array(path); print('cost', c)
def mp(ts):
    idx = np.where(path[:, 0] >= int(round(ts * 100)))[0]; return len(X) / 100 if len(idx) == 0 else path[idx[0], 1] / 100
for w in ws: w['t'] = float(mp(w['s']))
for i, w in enumerate(ws):
    nxt = ws[i + 1]['t'] if i + 1 < len(ws) else len(x) / A.SR
    w['end'] = float(min(nxt, mp(w['lineEnd']))) if 'lineEnd' in w else float(nxt)
json.dump({'dur': len(x) / A.SR, 'words': ws}, open(out, 'w'))
for li in range(len(en)):
    L = [w for w in ws if w['line'] == li]; print(li, round(L[0]['t'], 2), round(L[-1]['end'], 2), len(L))
