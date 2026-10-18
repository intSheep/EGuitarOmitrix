#!/usr/bin/env python3
"""Local-only bounded video sampling. Candidates are NOT verified score pages.
Requires ffmpeg/ffprobe and Pillow. Originals are never modified.
"""
import argparse, hashlib, json, subprocess
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('output',type=Path);p.add_argument('--samples',type=int,default=24);p.add_argument('--crop',help='left,top,right,bottom in source pixels');a=p.parse_args()
if not 2<=a.samples<=240:p.error('samples must be 2..240')
if a.output.exists() and any(a.output.iterdir()):p.error('output must be empty to avoid mixing runs')
a.output.mkdir(parents=True,exist_ok=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(a.video)]));duration=float(probe['format']['duration']);crop=tuple(map(int,a.crop.split(','))) if a.crop else None
if crop and (len(crop)!=4 or crop[2]<=crop[0] or crop[3]<=crop[1]):p.error('invalid crop')
frames=[];representatives=[]
for i in range(a.samples):
 t=duration*(i+.5)/a.samples;dest=a.output/f'frame-{i+1:03d}.png'
 subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(a.video),'-frames:v','1',str(dest)],check=True)
 with Image.open(dest) as im:
  if crop:
   if crop[2]>im.width or crop[3]>im.height:p.error('crop exceeds frame')
   im=im.crop(crop);im.save(dest)
  # Binary ink map reduces playback-highlight differences; still only a heuristic.
  signature=im.convert('L').point(lambda v:0 if v<100 else 255).resize((240,100))
  match=None
  for j,old in enumerate(representatives):
   if ImageStat.Stat(ImageChops.difference(signature,old)).mean[0]<2.0:match=j+1;break
  if match is None:representatives.append(signature.copy());match=len(representatives)
 frames.append({'file':dest.name,'seconds':round(t,3),'candidateGroup':match,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
manifest={'schemaVersion':1,'source':a.video.name,'sourceSha256':hashlib.file_digest(a.video.open('rb'),'sha256').hexdigest(),'durationSeconds':duration,'crop':crop,'method':'bounded uniform samples plus binary-image similarity; may miss short pages','reviewStatus':'unreviewed','frames':frames}
(a.output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps({'source':a.video.name,'frames':len(frames),'candidateGroups':len(representatives)}))
