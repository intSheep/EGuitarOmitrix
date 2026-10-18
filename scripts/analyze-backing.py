#!/usr/bin/env python3
"""Local spectral evidence for an explicit candidate score/audio alignment.
Requires FFmpeg, NumPy and SciPy. Does not infer melody, downbeat or acceptance.
"""
import argparse, hashlib, json, subprocess
from pathlib import Path
import numpy as np
from scipy.signal import stft, find_peaks
p = argparse.ArgumentParser()
p.add_argument('source', type=Path)
p.add_argument('output', type=Path)
p.add_argument('--bpm', type=float, required=True)
p.add_argument('--anchor', type=float, required=True, help='Candidate first score bar in source seconds')
p.add_argument('--bars', type=int, required=True)
a = p.parse_args()
if a.output.exists(): p.error('output exists')
if not 20 <= a.bpm <= 300 or a.anchor < 0 or a.bars < 1: p.error('invalid timing')
raw = subprocess.check_output(['ffmpeg','-v','error','-nostdin','-i',str(a.source.resolve()),'-vn','-ac','1','-ar','22050','-f','f32le','-'])
x = np.frombuffer(raw,dtype='<f4'); sr=22050
f,t,z = stft(x,sr,nperseg=1024,noverlap=914)
m = abs(z); flux = np.maximum(np.diff(m,axis=1),0).sum(axis=0)
peaks,_=find_peaks(flux,distance=12,prominence=.015)
onsets=[{'seconds':round(float(t[i+1]),5),'strength':round(float(flux[i]),5)} for i in peaks]
period = 60/a.bpm
matches=[]
for beat in range(a.bars*4):
 expected=a.anchor+beat*period
 candidates=[q for q in onsets if abs(q['seconds']-expected)<min(.12,period*.2)]
 if not candidates: continue
 best=max(candidates,key=lambda q:q['strength'])
 matches.append({'beat':beat,'expectedSeconds':round(expected,5),'onsetSeconds':best['seconds'],'residualMs':round((best['seconds']-expected)*1000,2)})
summary={}
for label,lo,hi in [('early',0,a.bars*4/3),('middle',a.bars*4/3,a.bars*8/3),('late',a.bars*8/3,a.bars*4)]:
 residual=[m['residualMs'] for m in matches if lo<=m['beat']<hi]
 summary[label]={'matchedBeats':len(residual),'medianResidualMs':round(float(np.median(residual)),2) if residual else None}
low=np.sqrt(np.sum(m[(f>=70)&(f<=600)]**2,axis=0))
report={'source':a.source.name,'sha256':hashlib.file_digest(a.source.open('rb'),'sha256').hexdigest(),'durationSeconds':len(x)/sr,'candidateBpm':a.bpm,'candidateFirstBarSeconds':a.anchor,'bars':a.bars,'method':'1024-point STFT, 110-sample hop; positive spectral flux; strongest nearby transient per proposed quarter beat','limitations':'Nearby transient agreement is not downbeat/melody proof. Sparse/sustained passages can lack transients. This does not grant listening acceptance.','onsets':onsets,'beatMatches':matches,'segments':summary,'lowBandRmsNearEntry':[{'seconds':round(float(t[i]),4),'rms':round(float(low[i]),6)} for i in range(len(t)) if a.anchor-.4<=t[i]<=a.anchor+.4]}
a.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'source':a.source.name,'anchor':a.anchor,'bpm':a.bpm,'segments':summary}))
