#!/usr/bin/env python3
"""Map local video availability to lessons without claiming score coverage."""
import json, argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('videos',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
c=json.loads(Path('app/data/course.json').read_text());files={int(f.name[1:4]):f.name for f in a.videos.glob('P[0-9][0-9][0-9] *.mp4')}
rows=[]
for e in c['entries']:
 if e['kind']!='lesson':continue
 sources=[s for s in c['entries'] if s['page'] in files and s['legacy']==e['legacy'] and (s['id']==e['id'] or (s['stage']==e['stage'] and set(s['exercises'])&set(e['exercises'])))]
 rows.append({'entryId':e['id'],'page':e['page'],'title':e['title'],'localSources':[{'page':s['page'],'kind':s['kind'],'file':files[s['page']]} for s in sources],'status':'needs-frame-review' if sources else 'source-video-missing'})
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps({'schemaVersion':1,'lessons':rows},ensure_ascii=False,indent=2));print(json.dumps({'lessons':len(rows),'withLocalVideo':sum(bool(r['localSources']) for r in rows),'missingVideo':sum(not r['localSources'] for r in rows)}))
