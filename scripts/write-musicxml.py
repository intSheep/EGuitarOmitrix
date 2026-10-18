#!/usr/bin/env python3
"""Serialize reviewed notation, chords and guitar techniques, not image recognition.
Default tablature: explicit tuning/string/fret. notation='staff': explicit MIDI pitch,
without invented guitar fingering. Both support rests, tuplets, repeats and complete 2/4, 3/4 or 4/4 bars.
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
meter = x.get('meter', [4, 4])
if meter not in ([4, 4], [3, 4], [2, 4]):
    raise ValueError('Unsupported meter')
if not x['bars']:
    raise ValueError('No measures')
incomplete_measures = x.get('incompleteMeasures', [])
if (not isinstance(incomplete_measures, list)
        or any(type(i) is not int or not 1 <= i <= len(x['bars']) for i in incomplete_measures)
        or len(set(incomplete_measures)) != len(incomplete_measures)):
    raise ValueError('Invalid incomplete measure indices')


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
ident = add(r, 'identification')
add(add(ident, 'encoding'), 'software', 'EGuitarOmitrix reviewed writer')
add(ident, 'source', x['source'])
sp = add(add(r, 'part-list'), 'score-part', id='P1')
add(sp, 'part-name', 'Guitar')
ins = add(sp, 'score-instrument', id='I1')
add(ins, 'instrument-name', 'Electric guitar')
mi = add(sp, 'midi-instrument', id='I1')
add(mi, 'midi-channel', 1)
add(mi, 'midi-program', 28)
part = add(r, 'part', id='P1')
pending = {}
cursor = Fraction(0)
beat_start = Fraction(0)
for index, bar in enumerate(x['bars'], 1):
    duration = sum(Fraction(str(n['quarters'])) for n in bar if not n.get('chord'))
    incomplete = index in x.get('incompleteMeasures', [])
    if (incomplete and not 0 < duration < meter[0]) or (not incomplete and duration != meter[0]):
        raise ValueError(f'Measure {index}: duration does not match meter')
    m = add(part, 'measure', number=str(index), **({'implicit': 'yes'} if incomplete else {}))
    if index == 1:
        at = add(m, 'attributes')
        add(at, 'divisions', 960)
        add(add(at, 'key'), 'fifths', x.get('fifths', 0))
        ti = add(at, 'time')
        add(ti, 'beats', meter[0])
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
    if index in x.get('repeatStarts', []):
        add(add(m, 'barline', location='left'), 'repeat', direction='forward')
    for ni, n in enumerate(bar):
        if n.get('chord') and (ni == 0 or n.get('rest') or bar[ni-1].get('rest') or n['quarters'] != bar[ni-1]['quarters']):
            raise ValueError('Invalid chord continuation')
        unknown = set(n) - {'quarters','rest','midi','string','fret','tie','pick','finger','tuplet','accent','slide','legato','chord','palmMute','letRing','dead','arpeggio','hammer','pull','slideIn','slideOut','vibrato','bend','grace','staccato'}
        if unknown:
            raise ValueError(f'Unsupported note fields: {sorted(unknown)}')
        for field, allowed in [('slide', (None, 'start', 'stop', 'continue')), ('hammer', (None, 'start', 'stop', 'continue')), ('pull', (None, 'start', 'stop', 'continue')), ('slideIn', (None, 'below')), ('slideOut', (None, 'down')), ('arpeggio', (None, 'up', 'down'))]:
            if n.get(field) not in allowed:
                raise ValueError(f'Unsupported {field}')
        rest = n.get('rest', False)
        tie = n.get('tie')
        if tie not in (None, 'start', 'stop', 'continue') or n.get('pick') not in (None, 'up', 'down'):
            raise ValueError('Unsupported tie or pick direction')
        if rest:
            if set(n) - {'rest', 'quarters', 'tuplet'}:
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
        q = Fraction(str(n['quarters']))
        if not n.get('chord'):
            beat_start = cursor
            cursor += q
        if any(t < beat_start for t in pending.values()):
            raise ValueError('Interrupted tie')
        if tie in ('stop', 'continue'):
            if pending.pop(identity, None) != beat_start:
                raise ValueError('Orphan tie stop')
        elif identity in pending:
            raise ValueError('Missing tie stop')
        if tie in ('start', 'continue'):
            pending[identity] = beat_start + q
        tuplet = n.get('tuplet')
        written_q = Fraction(1, 4) if n.get('grace') else q
        if n.get('grace') and (q != 0 or rest or n.get('chord')):
            raise ValueError('Grace note must have zero metrical duration')
        if tuplet is not None:
            if tuplet not in ([3, 2], [6, 4]) or n.get('grace'):
                raise ValueError('Unsupported tuplet ratio')
            written_q = q * Fraction(*tuplet)
        if written_q not in types:
            raise ValueError('Unsupported duration; do not approximate it')
        kind, dots = types[written_q]
        if not n.get('chord'):
            for key, label in [('palmMute', 'P.M.'), ('letRing', 'LetRing')]:
                dr = add(m, 'direction')
                add(add(dr, 'direction-type'), 'words', label)
                add(add(dr, 'direction-type'), 'dashes', type='start' if n.get(key) else 'stop')
        note = add(m, 'note')
        if n.get('grace'):
            add(note, 'grace', slash='yes')
        if n.get('chord'):
            add(note, 'chord')
        if rest:
            add(note, 'rest', **({'measure': 'yes'} if q == 4 else {}))
        else:
            pitch = add(note, 'pitch')
            step, alter = pitch_names[midi % 12]
            add(pitch, 'step', step)
            if alter:
                add(pitch, 'alter', alter)
            add(pitch, 'octave', midi // 12 - 1)
        if (q * 960).denominator != 1:
            raise ValueError('Duration cannot be represented exactly')
        if not n.get('grace'):
            add(note, 'duration', int(q * 960))
        if tie:
            for endpoint in (['stop', 'start'] if tie == 'continue' else [tie]):
                add(note, 'tie', type=endpoint)
        add(note, 'type', kind)
        for _ in range(dots):
            add(note, 'dot')
        if tuplet:
            tm = add(note, 'time-modification')
            add(tm, 'actual-notes', tuplet[0])
            add(tm, 'normal-notes', tuplet[1])
        if n.get('dead'):
            add(note, 'notehead', 'x')
        if tie or n.get('accent') or n.get('slide') or (mode == 'tab' and not rest):
            notat = add(note, 'notations')
            if n.get('arpeggio'):
                add(notat, 'arpeggiate', direction=n['arpeggio'])
            if n.get('slide'):
                if n['slide'] not in ('start', 'stop', 'continue'):
                    raise ValueError('Invalid slide endpoint')
                for endpoint in (['stop', 'start'] if n['slide']=='continue' else [n['slide']]):
                    add(notat, 'slide', type=endpoint, number='1')
                    if n.get('legato'):
                        add(notat, 'slur', type=endpoint, number='1')
            if n.get('accent') or n.get('slideIn') or n.get('slideOut') or n.get('staccato'):
                art = add(notat, 'articulations')
                if n.get('accent'):
                    add(art, 'accent')
                if n.get('staccato'):
                    add(art, 'staccato')
                if n.get('slideIn') == 'below':
                    add(art, 'scoop')
                if n.get('slideOut') == 'down':
                    add(art, 'falloff')
            if n.get('vibrato'):
                add(add(notat, 'ornaments'), 'wavy-line', type='start')
            if tie:
                for endpoint in (['stop', 'start'] if tie == 'continue' else [tie]):
                    add(notat, 'tied', type=endpoint)
            if mode == 'tab' and not rest:
                tech = add(notat, 'technical')
                for key, tag in [('hammer', 'hammer-on'), ('pull', 'pull-off')]:
                    if n.get(key):
                        for endpoint in ([ 'stop', 'start'] if n[key] == 'continue' else [n[key]]):
                            if endpoint not in ('start', 'stop'):
                                raise ValueError('Invalid hammer/pull endpoint')
                            add(tech, tag, type=endpoint, number='1')
                if n.get('bend'):
                    for segment in n['bend']:
                        bend = add(tech, 'bend')
                        add(bend, 'bend-alter', segment['semitones'])
                        if segment.get('release'):
                            add(bend, 'release')
                if n.get('pick'):
                    add(tech, 'down-bow' if n['pick'] == 'down' else 'up-bow')
                if n.get('finger'):
                    add(tech, 'fingering', n['finger'])
                add(tech, 'string', n['string'])
                add(tech, 'fret', n['fret'])
    if str(index) in x.get('repeatEnds', {}):
        count = x['repeatEnds'][str(index)]
        if type(count) is not int or not 2 <= count <= 32:
            raise ValueError('Invalid repeat count')
        add(add(m, 'barline', location='right'), 'repeat', direction='backward', times=str(count))
if pending:
    raise ValueError('Unclosed tie')
E.indent(r)
E.ElementTree(r).write(a.output, encoding='utf-8', xml_declaration=True)
print(f'{len(x["bars"])} measures written to {a.output}')
