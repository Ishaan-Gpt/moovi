import sys, json, re, numpy as np
sys.path.insert(0, sys.argv[1]); sys.argv=sys.argv[:1]+sys.argv[2:]
import align as A
script=open('SCRIPT.md',encoding='utf-8').read()
def sect(h):
    s=script.split(h)[1].split('\n## ')[0]; return [re.sub(r'^\d+\.\s*','',l).strip() for l in s.strip().split('\n') if re.match(r'^\d+\.',l)]
hi=sect('## Hindi: Devanagari (for the voice)'); ro=sect('## Hindi: Roman (for captions)'); en=sect('## English (for the voice and captions)')
SUB={'GTA':'जी टी ए','6':'सिक्स'}
x=A.load('audio/take-viraj.mp3'); X=A.mfcc(x)
ws=[]; wav=[]; off=0.0
for li,(h,r) in enumerate(zip(hi,ro)):
    toks=h.split(); rt=r.split(); text=''; spans=[]
    for t in toks:
        s=SUB.get(t,t); a=len(text)+1; text+=s+' '; spans.append((a,len(text)))
    w,ev=A.synth(text.strip(),'hi')
    st=[None]*len(toks)
    for p,l,a in ev:
        for k,(s0,s1) in enumerate(spans):
            if s0<=p<s1:
                if st[k] is None: st[k]=a
                break
    # fill missing by interpolation
    for k in range(len(st)):
        if st[k] is None: st[k]=st[k-1]+0.05 if k else 0.0
    for k in range(len(toks)): ws.append({'line':li,'word':rt[k],'hi':toks[k],'s':off+st[k]})
    wav.append(w); wav.append(np.zeros(int(0.3*A.SR),np.float32)+1e-4*np.random.RandomState(1).randn(int(0.3*A.SR)).astype(np.float32)); off+=len(w)/A.SR+0.3
    ws[-1]['lineEnd']=off-0.3
Y=A.mfcc(np.concatenate(wav)); c,path=A.dtw(Y,X); print('cost',c,len(X),len(Y))
path=np.array(path); # (synth frame, real frame)
def map_t(ts, first=True):
    f=int(round(ts*100)); idx=np.where(path[:,0]>=f)[0]
    if len(idx)==0: return len(X)/100
    return path[idx[0],1]/100
# energy of real for snapping ends
for w in ws: w['t']=float(map_t(w['s']))
for i,w in enumerate(ws):
    nxt=ws[i+1]['t'] if i+1<len(ws) else len(x)/A.SR
    if 'lineEnd' in w: w['end']=float(min(nxt,map_t(w['lineEnd'])))
    else: w['end']=float(nxt)
json.dump({'dur':len(x)/A.SR,'words':ws,'en':en},open(sys.argv[1],'w'),ensure_ascii=False,indent=0)
for li in range(len(hi)):
    L=[w for w in ws if w['line']==li]; print(li, round(L[0]['t'],2), round(L[-1]['end'],2), len(L))
