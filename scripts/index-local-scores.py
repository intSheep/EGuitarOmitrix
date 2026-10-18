#!/usr/bin/env python3
"""Index local-only reviewed scores against the course; exclude trial directories."""
import argparse,json,re
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
root=parser.parse_args().root
base=root/'app/local-scores'
course=json.loads((root/'app/data/course.json').read_text())['entries']
by_page={e['page']:e for e in course}
items=[]
for directory in sorted(base.iterdir()):
 if not directory.is_dir() or not re.fullmatch(r'p\d{3}(?:-ex\d+)?',directory.name):continue
 manifest=directory/'manifest.json'
 if not manifest.exists():continue
 metadata=json.loads(manifest.read_text())
 page=int(directory.name[1:4]);entry=by_page.get(page)
 if not entry:raise ValueError(f'Unknown source page {page}')
 gp=directory/'score.gp';xml=directory/'score.musicxml'
 if not gp.exists() and not xml.exists() and not metadata.get('referenceOnly'):continue
 # Match edition, stage and exercise; retain the exact source entry as well.
 ids=[e['id'] for e in course if e['id']==entry['id'] or (e['stage']==entry['stage'] and e['legacy']==entry['legacy'] and set(e['exercises']) & set(entry['exercises']))]
 images=sorted((p for p in directory.iterdir() if re.fullmatch(r'(?:source(?:-\d+)?|page-\d+)\.(?:png|jpg)',p.name)),key=lambda p:(re.sub(r'\d+', '', p.name),int(re.search(r'\d+',p.name)[0]) if re.search(r'\d+',p.name) else 0))
 if any(p.name.startswith('source-') for p in images):images=[p for p in images if p.name!='source.jpg']
 item={'id':directory.name,'entryId':entry['id'],'entryIds':ids,'sourcePage':page,'title':metadata.get('title',entry['title']),'images':[f'{directory.name}/{p.name}' for p in images],'referenceOnly':bool(metadata.get('referenceOnly'))}
 if gp.exists():item['gp']=f'{directory.name}/score.gp'
 if xml.exists():item['xml']=f'{directory.name}/score.musicxml'
 if metadata.get('playbackBpm'):item['practiceBpm']=metadata['playbackBpm']
 items.append(item)
output={'schemaVersion':1,'items':items}
(base/'index.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(f'Indexed {len(items)} local scores and reference sets; no course payload copied into tracked files.')
