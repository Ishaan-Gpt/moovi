import json, sys, subprocess, re
TEMPO=1.4
d=json.load(open(sys.argv[1])); ws=d['words']
out=subprocess.run('ffmpeg -hide_banner -i audio/take-viraj.mp3 -af silencedetect=noise=-35dB:d=0.2 -f null -'.split(),capture_output=True,text=True).stderr
ss=[float(x) for x in re.findall(r'silence_start: ([0-9.]+)',out)]; se=[float(x) for x in re.findall(r'silence_end: ([0-9.]+)',out)]
sil=list(zip(ss,se))
# punctuated boundaries
cands=[]
for k in range(len(ws)-1):
    if re.search(r'[,.?:]$',ws[k]['word']) or ws[k]['line']!=ws[k+1]['line']:
        mid=(ws[k]['end']+ws[k+1]['t'])/2
        for si,(a,b) in enumerate(sil):
            dist=abs(mid-(a+b)/2)
            if dist<0.7: cands.append((dist,k,si))
cands.sort(); usedk=set(); useds=set(); anchors=[(0.0,0.0)]
pairs=[]
for dist,k,si in cands:
    if k in usedk or si in useds: continue
    usedk.add(k); useds.add(si); pairs.append((k,si))
pairs.sort()
# enforce monotonic
mono=[]; 
for k,si in pairs:
    if mono and si<=mono[-1][1]: continue
    mono.append((k,si))
src=[0.0]; dst=[min(ws[0]['t'],0.05)]
src=[ws[0]['t']]; dst=[ws[0]['t']]
for k,si in mono:
    a,b=sil[si]; src+= [ws[k]['end'], max(ws[k]['end']+1e-3,ws[k+1]['t'])]; dst+=[a,b]
src.append(ws[-1]['end']+1e-3); dst.append(min(d['dur'],max(ws[-1]['end'],dst[-1]+0.2)))
def mp(t,last=False):
    for i in (range(len(src)-2,-1,-1) if last else range(len(src)-1)):
        if src[i]<=t<=src[i+1]:
            u=(t-src[i])/max(1e-6,src[i+1]-src[i]); return dst[i]+u*(dst[i+1]-dst[i])
    return t
for w in ws: w['t2']=mp(w['t']+2e-3,True); w['e2']=mp(w['end'])
for i in range(len(ws)-1):
    ws[i]['e2']=min(ws[i]['e2'],ws[i+1]['t2']); 
    if ws[i]['e2']-ws[i]['t2']<0.06: ws[i]['e2']=min(ws[i+1]['t2'],ws[i]['t2']+0.12)
lines=[]
for li in range(10):
    lines.append([{'word':w['word'],'t':round(w['t2']/TEMPO,3),'end':round(w['e2']/TEMPO,3)} for w in ws if w['line']==li])
T={'duration':round(d['dur']/TEMPO,3),'tempo':TEMPO,'lines':lines}
open(sys.argv[2],'w').write('// timing.js: Viraj Hindi take sped up 1.4x (atempo), word times from a local forced alignment (espeak-ng synth of the script + MFCC DTW, pause-anchored); see audio/ALIGN.md\nwindow.TIMING = '+json.dumps(T,ensure_ascii=False)+';\n')
print(len(mono),'anchors of',len(sil),'silences')
for L in lines: print(round(L[0]['t'],2),round(L[-1]['end'],2),' '.join(w['word'] for w in L)[:60])
print(' '.join(f"{w['word']}@{w['t']}" for w in lines[0]))
