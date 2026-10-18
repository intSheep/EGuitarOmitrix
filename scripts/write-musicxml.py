#!/usr/bin/env python3
"""Serialize reviewed monophonic notation, not image recognition.
Default tablature: explicit tuning/string/fret. notation='staff': explicit MIDI pitch,
without invented guitar fingering. Both support rests and complete 4/4 bars.
"""
import argparse
import json
import xml.etree.ElementTree as E
from fractions import Fraction
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('transcription', type=Path)
p.add_argument('output', type=Path)
a = p.parse_args()
x = json.loads(a.transcription.read_text())
if a.output.exists():
    p.error('output exists; preserve the original and choose a new filename')
mode = x.get('notation', 'tab')
if mode not in ('tab', 'staff') or not 20 <= x['tempo'] <= 300:
    raise ValueError('Invalid notation or tempo')
if mode == 'tab' and (len(x['tuning']) != 6 or any(type(v) is not int for v in x['tuning'])):
    raise ValueError('Invalid tuning')
if not x['bars']:
    raise ValueError('No measures')


def add(parent, name, text=None, **attrs):
    n = E.SubElement(parent, name, attrs)
    if text is not None:
        n.text = str(text)
    return n


pitch_names = [('C', 0), ('C', 1), ('D', 0), ('D', 1), ('E', 0), ('F', 0),
               ('F', 1), ('G', 0), ('G', 1), ('A', 0), ('A', 1), ('B', 0)]
types = {Fraction(1, 4): ('16th', 0), Fraction(1, 2): ('eighth', 0),
         Fraction(3, 4): ('eighth', 1), Fraction(1): ('quarter', 0),
         Fraction(3, 2): ('quarter', 1), Fraction(2): ('half', 0),
         Fraction(3): ('half', 1), Fraction(4): ('whole', 0)}
r = E.Element('score-partwise', version='4.0')
add(add(r, 'work'), 'work-title', x['title'])
add(add(r, 'identification'), 'source', x['source'])
sp = add(add(r, 'part-list'), 'score-part', id='P1')
add(sp, 'part-name', 'Guitar')
ins = add(sp, 'score-instrument', id='I1')
add(ins, 'instrument-name', 'Electric guitar')
mi = add(sp, 'midi-instrument', id='I1')
add(mi, 'midi-channel', 1)
add(mi, 'midi-program', 28)
part = add(r, 'part', id='P1')
pending = None
for index, bar in enumerate(x['bars'], 1):
    if sum(Fraction(str(n['quarters'])) for n in bar) != 4:
        raise ValueError(f'Measure {index}: duration is not 4 quarters')
    m = add(part, 'measure', number=str(index))
    if index == 1:
        at = add(m, 'attributes')
        add(at, 'divisions', 4)
        add(add(at, 'key'), 'fifths', x.get('fifths', 0))
        ti = add(at, 'time')
        add(ti, 'beats', 4)
        add(ti, 'beat-type', 4)
        clef = add(at, 'clef')
        add(clef, 'sign', 'TAB' if mode == 'tab' else 'G')
        add(clef, 'line', 5 if mode == 'tab' else 2)
        if mode == 'tab':
            details = add(at, 'staff-details')
            add(details, 'staff-lines', 6)
            for line, midi in enumerate(reversed(x['tuning']), 1):
                t = add(details, 'staff-tuning', line=str(line))
                step, alter = pitch_names[midi % 12]
                add(t, 'tuning-step', step)
                if alter:
                    add(t, 'tuning-alter', alter)
                add(t, 'tuning-octave', midi // 12 - 1)
        dr = add(m, 'direction')
        met = add(add(dr, 'direction-type'), 'metronome')
        add(met, 'beat-unit', 'quarter')
        add(met, 'per-minute', x['tempo'])
        add(dr, 'sound', tempo=str(x['tempo']))
    for n in bar:
        rest = n.get('rest', False)
        tie = n.get('tie')
        if tie not in (None, 'start', 'stop') or n.get('pick') not in (None, 'up', 'down'):
            raise ValueError('Unsupported tie or pick direction')
        if rest:
            if any(k in n for k in ('midi', 'string', 'fret', 'tie', 'finger', 'pick')):
                raise ValueError('Rest cannot have a pitch or technical annotations')
            identity = None
        elif mode == 'tab':
            if type(n['string']) is not int or type(n['fret']) is not int or not 1 <= n['string'] <= 6 or not 0 <= n['fret'] <= 36:
                raise ValueError('Invalid string/fret')
            identity = (n['string'], n['fret'])
            midi = x['tuning'][n['string'] - 1] + n['fret']
        else:
            if any(k in n for k in ('string', 'fret', 'finger', 'pick')):
                raise ValueError('Staff mode must not imply undocumented fingering')
            midi = n['midi']
            if type(midi) is not int or not 0 <= midi <= 127:
                raise ValueError('Invalid MIDI pitch')
            identity = midi
        if pending is not None and (tie != 'stop' or pending != identity):
            raise ValueError('Unmatched tie')
        if tie == 'stop' and pending != identity:
            raise ValueError('Orphan tie stop')
        pending = identity if tie == 'start' else None
        q = Fraction(str(n['quarters']))
        if q not in types:
            raise ValueError('Unsupported duration; do not approximate it')
        kind, dots = types[q]
        note = add(m, 'note')
        if rest:
            add(note, 'rest', **({'measure': 'yes'} if q == 4 else {}))
        else:
            pitch = add(note, 'pitch')
            step, alter = pitch_names[midi % 12]
            add(pitch, 'step', step)
            if alter:
                add(pitch, 'alter', alter)
            add(pitch, 'octave', midi // 12 - 1)
        add(note, 'duration', int(q * 4))
        if tie:
            add(note, 'tie', type=tie)
        add(note, 'type', kind)
        for _ in range(dots):
            add(note, 'dot')
        if tie or (mode == 'tab' and not rest):
            notat = add(note, 'notations')
            if tie:
                add(notat, 'tied', type=tie)
            if mode == 'tab' and not rest:
                tech = add(notat, 'technical')
                if n.get('pick'):
                    add(tech, 'down-bow' if n['pick'] == 'down' else 'up-bow')
                if n.get('finger'):
                    add(tech, 'fingering', n['finger'])
                add(tech, 'string', n['string'])
                add(tech, 'fret', n['fret'])
if pending is not None:
    raise ValueError('Unclosed tie')
E.indent(r)
E.ElementTree(r).write(a.output, encoding='utf-8', xml_declaration=True)
print(f'{len(x["bars"])} measures written to {a.output}')
