#!/usr/bin/env python3
"""Serialize a reviewed monophonic guitar transcription, not image recognition.
JSON: title, tempo, fifths, tuning (MIDI high-to-low), source, bars[][]
Note: string, fret, quarters, optional tie=start/stop, finger, pick=up/down.
Only complete 4/4 measures are accepted by this first serializer.
"""
import argparse,json,xml.etree.ElementTree as E
from fractions import Fraction
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('transcription',type=Path);p.add_argument('output',type=Path);a=p.parse_args();x=json.loads(a.transcription.read_text())
if a.output.exists():p.error('output exists; preserve the original and choose a new filename')
if len(x['tuning'])!=6 or not 20<=x['tempo']<=300:raise ValueError('Invalid tuning or tempo')
if not x['bars']:raise ValueError('No measures')
def add(parent,name,text=None,**attrs):
 n=E.SubElement(parent,name,attrs)
 if text is not None:n.text=str(text)
 return n
pitch_names=[('C',0),('C',1),('D',0),('D',1),('E',0),('F',0),('F',1),('G',0),('G',1),('A',0),('A',1),('B',0)]
r=E.Element('score-partwise',version='4.0');add(add(r,'work'),'work-title',x['title']);add(add(r,'identification'),'source',x['source']);sp=add(add(r,'part-list'),'score-part',id='P1');add(sp,'part-name','Guitar');ins=add(sp,'score-instrument',id='I1');add(ins,'instrument-name','Electric guitar');mi=add(sp,'midi-instrument',id='I1');add(mi,'midi-channel',1);add(mi,'midi-program',28);part=add(r,'part',id='P1');pending=None
for index,bar in enumerate(x['bars'],1):
 if sum(Fraction(str(n['quarters'])) for n in bar)!=4:raise ValueError(f'Measure {index}: duration is not 4 quarters')
 m=add(part,'measure',number=str(index))
 if index==1:
  at=add(m,'attributes');add(at,'divisions',4);add(add(at,'key'),'fifths',x.get('fifths',0));ti=add(at,'time');add(ti,'beats',4);add(ti,'beat-type',4);clef=add(at,'clef');add(clef,'sign','TAB');add(clef,'line',5);details=add(at,'staff-details');add(details,'staff-lines',6)
  for line,midi in enumerate(reversed(x['tuning']),1):
   t=add(details,'staff-tuning',line=str(line));step,alter=pitch_names[midi%12];add(t,'tuning-step',step)
   if alter:add(t,'tuning-alter',alter)
   add(t,'tuning-octave',midi//12-1)
  dr=add(m,'direction');met=add(add(dr,'direction-type'),'metronome');add(met,'beat-unit','quarter');add(met,'per-minute',x['tempo']);add(dr,'sound',tempo=str(x['tempo']))
 for n in bar:
  if not 1<=n['string']<=6 or not 0<=n['fret']<=36:raise ValueError('Invalid string/fret')
  identity=(n['string'],n['fret']);tie=n.get('tie')
  if tie not in (None,'start','stop') or n.get('pick') not in (None,'up','down'):raise ValueError('Unsupported tie or pick direction')
  if pending and (tie!='stop' or pending!=identity):raise ValueError('Unmatched tie')
  if tie=='stop' and pending!=identity:raise ValueError('Orphan tie stop')
  pending=identity if tie=='start' else None
  q=Fraction(str(n['quarters']));duration=q*4
  if duration.denominator!=1:raise ValueError('Unsupported subdivision')
  types={Fraction(1,4):'16th',Fraction(1,2):'eighth',Fraction(1):'quarter',Fraction(2):'half',Fraction(4):'whole'}
  if q not in types:raise ValueError('Unsupported duration; do not approximate it')
  note=add(m,'note');pitch=add(note,'pitch');midi=x['tuning'][n['string']-1]+n['fret'];step,alter=pitch_names[midi%12];add(pitch,'step',step)
  if alter:add(pitch,'alter',alter)
  add(pitch,'octave',midi//12-1);add(note,'duration',int(duration))
  if tie:add(note,'tie',type=tie)
  add(note,'type',types[q]);notat=add(note,'notations')
  if tie:add(notat,'tied',type=tie)
  tech=add(notat,'technical')
  if n.get('pick'):add(tech,'down-bow' if n['pick']=='down' else 'up-bow')
  if n.get('finger'):add(tech,'fingering',n['finger'])
  add(tech,'string',n['string']);add(tech,'fret',n['fret'])
if pending:raise ValueError('Unclosed tie')
E.indent(r);E.ElementTree(r).write(a.output,encoding='utf-8',xml_declaration=True);print(f'{len(x["bars"])} measures written to {a.output}')
