#!/usr/bin/env python3
"""Package canonical local score artifacts, provenance and explicit coverage limits."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
base = root / 'app/local-scores'
course = json.loads((root / 'app/data/course.json').read_text())['entries']
index = json.loads((base / 'index.json').read_text())['items']
by_page = {e['page']: e for e in course}
items = []
for directory in sorted(base.iterdir()):
    if not directory.is_dir() or not re.fullmatch(r'p\d{3}(?:-ex\d+)?', directory.name):
        continue
    manifest = directory / 'manifest.json'
    if not manifest.exists():
        raise ValueError(f'Missing provenance: {directory.name}')
    metadata = json.loads(manifest.read_text())
    gp, xml, audio = (directory / n for n in ('score.gp', 'score.musicxml', 'backing.mp3'))
    if not any(p.exists() for p in (gp, xml, audio)) and not metadata.get('referenceOnly'):
        continue
    page = int(directory.name[1:4])
    kind = ('reference-images' if metadata.get('referenceOnly') else
            'embedded-backing' if gp.exists() and metadata.get('audioKind') == 'backing' else
            'separate-backing' if audio.exists() else 'notation-gp' if gp.exists() else 'notation-xml')
    files = sorted(p for p in directory.iterdir() if p.is_file() and
                   (p.name in {'score.gp', 'score.musicxml', 'manifest.json', 'alignment.json', 'backing.mp3'} or
                    re.fullmatch(r'(?:source(?:-\d+)?|page-\d+)\.(?:png|jpg)', p.name)))
    items.append({'id': directory.name, 'page': page, 'title': metadata.get('title') or by_page[page]['title'],
                  'kind': kind, 'review': metadata.get('syncReview', metadata.get('review', 'Native GP8 not tested')),
                  'files': [{'path': f'{directory.name}/{p.name}',
                             'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]})
counts = {kind: sum(i['kind'] == kind for i in items) for kind in sorted({i['kind'] for i in items})}
coverage = []
for entry in course:
    associated = [i['id'] for i in index if entry['id'] in i['entryIds']]
    if entry['page'] in range(9, 15):
        associated.append(f"p{entry['page']:03}")
    coverage.append({'page': entry['page'], 'title': entry['title'], 'artifacts': associated,
                     'reviewScope': 'Sampled source frames plus targeted notation review; not exhaustive frame-by-frame inspection',
                     'exception': 'Random note-recall exercise; no fixed rhythmic score' if entry['page'] == 85 else
                     'No independent rhythmic exercise identified' if not associated else None})
(base / 'coverage.json').write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n')
(base / 'collection.json').write_text(json.dumps({'schemaVersion': 2, 'counts': counts, 'items': items}, ensure_ascii=False, indent=2) + '\n')
lines = ['# Local course score collection', '', 'Prepared 2026-10-18.', '',
         'Counts: ' + ', '.join(f'{v} {k}' for k, v in counts.items()) + '.', '',
         'Open GP files in Guitar Pro 8 or the application. P049 and P067 retain MusicXML only: their short final measures cannot currently be exported losslessly to GP. Reference images have no invented rhythm. P085 is a random note-recall task, not a fixed score.', '',
         'P018, P020, P021 and P072 retain prior owner acceptance. Other audio alignments remain candidates. New notation passed automated parsing/export checks; native GP8 rendering and listening were not tested. The collection covers identified examples, not a guarantee that every frame of every lesson was inspected.', '',
         'Unspecified source tempos use a documented playback default, not an instructor prescription. Staff-only examples do not assign invented string/fret positions. Course payloads remain local and excluded from Git.', '',
         '| ID | Title | Delivery |', '| --- | --- | --- |']
for item in items:
    target = next((f['path'] for f in item['files'] if f['path'].endswith('/score.gp')), None)
    target = target or next((f['path'] for f in item['files'] if f['path'].endswith(('.musicxml', '.mp3', '.jpg', '.png'))), None)
    lines.append(f"| {item['id']} | {item['title']} | [{item['kind']}]({target}) |")
(base / 'COLLECTION.md').write_text('\n'.join(lines) + '\n')
with zipfile.ZipFile(base / 'course-scores.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for item in items:
        for file in item['files']:
            archive.write(base / file['path'], file['path'])
    for name in ['COLLECTION.md', 'collection.json', 'coverage.json', 'index.json']:
        archive.write(base / name, name)
with zipfile.ZipFile(base / 'course-scores.zip') as archive:
    if archive.testzip():
        raise ValueError('Archive integrity failure')
print(json.dumps({'counts': counts, 'entries': len(items), 'bytes': (base / 'course-scores.zip').stat().st_size}))
