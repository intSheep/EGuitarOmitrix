#!/usr/bin/env python3
"""Read technique endpoints missed by alphaTab in our own monophonic/chord XML.
No arbitrary files, code execution, external entities or inferred pitches.
"""
import sys,json,xml.etree.ElementTree as E
r=E.fromstring(sys.stdin.read());out=[]
for pi,part in enumerate(r.findall('part')):
 for bi,bar in enumerate(part.findall('measure')):
  beat=-1;note_index=0
  for note in bar.findall('note'):
   if note.find('chord') is None:beat+=1;note_index=0
   else:note_index+=1
   if note.find('rest') is not None:continue
   tech=note.find('notations/technical');art=note.find('notations/articulations');patch={}
   if note.findtext('notehead') == 'x':patch['dead']=True
   if tech is not None:
    hp=list(tech.findall('hammer-on'))+list(tech.findall('pull-off'))
    if hp:patch['hammerPullOrigin']=any(n.get('type')=='start' for n in hp)
   if art is not None:
    if art.find('scoop') is not None:patch['slideInBelow']=True
    if art.find('falloff') is not None:patch['slideOutDown']=True
   if patch:out.append({'track':pi,'bar':bi,'beat':beat,'note':note_index,**patch})
print(json.dumps(out))
