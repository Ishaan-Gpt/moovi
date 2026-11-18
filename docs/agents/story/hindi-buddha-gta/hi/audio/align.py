import ctypes, sys, json, re, subprocess, numpy as np, os
import espeakng_loader as el
from scipy.fftpack import dct
SR=16000
def load(path):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),'-f','s16le','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.int16).astype(np.float32)/32768
lib=ctypes.CDLL(el.get_library_path())
class EV(ctypes.Structure):
    _fields_=[('type',ctypes.c_int),('uid',ctypes.c_uint),('text_position',ctypes.c_int),('length',ctypes.c_int),('audio_position',ctypes.c_int),('sample',ctypes.c_int),('user_data',ctypes.c_void_p),('id',ctypes.c_char*8)]
CB=ctypes.CFUNCTYPE(ctypes.c_int,ctypes.POINTER(ctypes.c_short),ctypes.c_int,ctypes.POINTER(EV))
buf=[];evs=[]
def cb(wav,n,ev):
    if wav and n>0: buf.append(np.ctypeslib.as_array(wav,shape=(n,)).copy())
    i=0
    while ev[i].type!=0:
        if ev[i].type==1: evs.append((ev[i].text_position,ev[i].length,ev[i].audio_position))
        i+=1
    return 0
cbf=CB(cb)
esr=lib.espeak_Initialize(2,0,os.path.dirname(el.get_data_path()).encode(),0)
lib.espeak_SetSynthCallback(cbf)
def synth(text,voice):
    global buf,evs
    buf=[];evs=[]
    lib.espeak_SetVoiceByName(voice.encode())
    lib.espeak_SetParameter(1,150,0)
    b=text.encode('utf-8')
    lib.espeak_Synth(b,len(b)+1,0,1,0,1,None,None)
    lib.espeak_Synchronize()
    w=np.concatenate(buf).astype(np.float32)/32768
    # resample to SR
    n=int(len(w)*SR/esr); w=np.interp(np.arange(n)*esr/SR,np.arange(len(w)),w).astype(np.float32)
    return w,[(p,l,a/1000) for p,l,a in evs]
def mfcc(x):
    x=np.append(x[0],x[1:]-0.97*x[:-1]); N=400;H=160
    nf=1+(len(x)-N)//H; idx=np.arange(N)[None,:]+H*np.arange(nf)[:,None]
    fr=x[idx]*np.hamming(N); P=np.abs(np.fft.rfft(fr,512))**2
    nm=40; mel=lambda f:2595*np.log10(1+f/700); imel=lambda m:700*(10**(m/2595)-1)
    pts=imel(np.linspace(mel(80),mel(7600),nm+2)); bins=np.floor(256*pts/(SR/2)).astype(int)
    fb=np.zeros((nm,257))
    for m in range(1,nm+1):
        a,b,c=bins[m-1],bins[m],bins[m+1]
        for k in range(a,b): fb[m-1,k]=(k-a)/max(1,b-a)
        for k in range(b,c): fb[m-1,k]=(c-k)/max(1,c-b)
    E=np.log(P@fb.T+1e-8); C=dct(E,type=2,axis=1,norm='ortho')[:,:13]
    C=(C-C.mean(0))/(C.std(0)+1e-6)
    d=np.gradient(C,axis=0); return np.hstack([C,d])
def dtw(A,B):
    # cosine distance matrix, anti-diagonal DP
    An=A/np.linalg.norm(A,axis=1,keepdims=True); Bn=B/np.linalg.norm(B,axis=1,keepdims=True)
    D=1-An@Bn.T; n,m=D.shape
    acc=np.full((n+1,m+1),np.inf,np.float32); acc[0,0]=0
    for i in range(1,n+1):
        row=D[i-1]; prev=acc[i-1]
        best=np.minimum(prev[1:],prev[:-1])+row   # from up or diag
        # left moves: sequential dependency -> do cumulative min trick
        cur=acc[i]; cur[0]=np.inf
        # cur[j]=min(best[j-1], cur[j-1]+row[j-1]); solve via loop in chunks (vectorized prefix): use numpy minimum.accumulate on (best - cumsum)
        cs=np.cumsum(row)
        cur[1:]=np.minimum.accumulate(best-cs)+cs
    # backtrack
    i,j=n,m; path=[]
    while i>0 and j>0:
        path.append((i-1,j-1))
        c=[acc[i-1,j-1],acc[i-1,j],acc[i,j-1]]; k=int(np.argmin(c))
        if k==0: i-=1;j-=1
        elif k==1: i-=1
        else: j-=1
    return acc[n,m]/(n+m), path[::-1]
if __name__=='__main__':
    script=open('SCRIPT.md',encoding='utf-8').read()
    def sect(h):
        s=script.split(h)[1].split('\n## ')[0]; return [re.sub(r'^\d+\.\s*','',l).strip() for l in s.strip().split('\n') if re.match(r'^\d+\.',l)]
    hi=sect('## Hindi: Devanagari (for the voice)'); ro=sect('## Hindi: Roman (for captions)'); en=sect('## English (for the voice and captions)')
    for a,b in zip(hi,ro): assert len(a.split())==len(b.split()),(a,b)
    res={}
    for take in ['viraj','titan']:
        x=load(f'audio/take-{take}.mp3'); X=mfcc(x)[::2]
        for lang,lines,voice in [('hi',hi,'hi'),('en',en,'en-us')]:
            w,_=synth(' '.join(lines).replace('GTA 6','जी टी ए सिक्स' if lang=='hi' else 'G T A six'),voice); Y=mfcc(w)[::2]
            c,_=dtw(Y,X); res[(take,lang)]=float(c); print(take,lang,round(float(c),4),len(X),len(Y),flush=True)
    json.dump({f'{a}-{b}':v for (a,b),v in res.items()},open(sys.argv[1],'w'))
