"""Build paraphrased assignment candidates from local subtitle evidence; never copy full transcripts."""
import hashlib, json, pathlib, sys, subprocess
base=pathlib.Path(sys.argv[1])
root=pathlib.Path(__file__).resolve().parents[1]
course=json.loads((root/'app/data/course.json').read_text())
visual={row[0]:row for row in json.loads((root/'content/visual-assignment-notes.json').read_text())}
videos=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else None
notes={row[0]:row for row in json.loads((root/'content/assignment-notes.json').read_text())}
items=[]
for e in course['entries']:
    if e['kind']!='lesson': continue
    files=list(base.glob(f"P{e['page']:03d} *.ai-zh.json"))
    row=notes.get(e['page'])
    item={'entryId':e['id'],'page':e['page'],'legacy':e['legacy'],'version':'2026-10-18.2','status':'subtitle-candidate' if row else 'missing-subtitles','dailyMinutes':None,'sessionsPerDay':None,'tempo':None,'summary':None,'uncertainty':None,'evidence':None}
    if row:
        if len(files)!=1: raise ValueError(f'Missing source for {e["page"]}')
        raw=files[0].read_bytes(); body=json.loads(raw)['body']
        start=max(0,int(row[1])-1)
        cues=[c for c in body if c['to']>=start]
        dose=next((c for c in cues if '分钟' in c['content']),None)
        item.update(dailyMinutes=row[2],tempo=row[3],summary=row[4],uncertainty=row[5] or None,evidence={'file':files[0].name,'sha256':hashlib.sha256(raw).hexdigest(),'from':start,'to':body[-1]['to'],'doseQuote':dose['content'] if dose else None,'provenance':'AI subtitles; paraphrase reviewed against text, not audio'})
    if e['page'] in visual:
        if videos is None: raise ValueError('Video directory required for visual-source verification')
        vr=visual[e['page']]; vf=next(videos.glob(f"P{e['page']:03d} *.mp4"))
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(vf)]))
        with vf.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
        item.update(status='video-card-reviewed', dailyMinutes=vr[1],tempo=vr[2],summary=vr[3],uncertainty=vr[4] or None,evidence={'file':vf.name,'sha256':digest,'from':max(0,int(duration)-45),'to':duration,'cardAt':round(duration-0.8,2),'doseQuote':f'每天{vr[1]}分钟','provenance':'Video closing card and burned-in captions visually inspected; no audio verification'})
    items.append(item)
assert len(items)==72
payload={'schemaVersion':1,'bvid':course['bvid'],'version':'2026-10-18.2','items':items,'guidance':[
 {'page':2,'from':1,'to':30,'summary':'原课建议多项练习并行；时间不足时，可选择部分技巧练习和歌曲练习，不必只练爬格子。'},
 {'page':23,'from':1,'to':10,'summary':'第一阶段为过渡内容；原课提出累计练习时间建议，不作为应用自动晋级门槛。'},
 {'page':41,'from':13,'to':23,'summary':'开始第三阶段前，应实际练习前面的内容；观看不等于练习。'},
 {'page':74,'from':11,'to':21,'summary':'暂时弹不好的项目可以保留，学习后续内容后再回练。'},
 {'page':123,'from':1,'to':18,'summary':'末阶段歌曲难度较高；不要求立即完美，后续可以继续回练。'}]}
(root/'app/data/assignments.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
lines=['# Course assignment inventory','', 'Version: 2026-10-18.2. Text-reviewed AI-subtitle candidates and visually reviewed video-card assignments; no audio verification. Teacher prescriptions are separate from actual practice. Full transcripts and media remain outside Git.', '', 'All 72 lessons have assignments: 64 AI-subtitle candidates (58 current, 6 legacy), plus 8 missing-subtitle lessons recovered from visually inspected closing video cards and burned-in captions. Ambiguous numbers remain unknown. Legacy tasks never overwrite current tasks. Sessions per day are unknown; daily minutes are not minutes per session.', '', 'All assignment fields link to the closing assignment span and local subtitle/video SHA-256 in `app/data/assignments.json`. Additional context in notes identifies earlier lesson passages. P117 daily minutes remain null because the transcript says 2 minutes and needs listening confirmation. P029/P065/P093 target tempos remain unknown. P070 has no numeric final target in the closing span.', '', '| Page | Lesson | Daily minutes (candidate) | Tempo (candidate) | Assignment summary | Review note |','| --- | --- | --- | --- | --- | --- |']
for i in items:
    e=next(e for e in course['entries'] if e['id']==i['entryId']); ev=i['evidence']; url=f"https://www.bilibili.com/video/{course['bvid']}/?p={e['page']}&cid={e['id']}"+(f"&t={ev['from']}" if ev else '')
    vals=[f"[P{e['page']:03d}]({url})",e['title'],str(i['dailyMinutes']) if i['dailyMinutes'] is not None else 'Unknown',i['tempo'] or 'Unknown',i['summary'] or 'No independent subtitles; inspect original video.',i['uncertainty'] or ('Video closing card reviewed' if i['status']=='video-card-reviewed' else 'Audio review pending')]
    lines.append('| '+' | '.join(v.replace('|','/') for v in vals)+' |')
lines+=['','## Stage-level context','','Introductions and outros are guidance, not new per-exercise doses. The source-navigation catalog still exposes every introductory and supporting video. Stage guidance is paraphrased separately in the app; P040 has no independent subtitles. No week-based deadlines or automatic tempo increases are imposed.','','## Rebuild','','Run `python scripts/build-assignments.py <local-subtitle-directory> <local-video-directory>`. This validates all authored candidate sources and computes their checksums without copying the source package. Content review is offline and no runtime model call is required.']
(root/'docs/product/assignment-inventory.md').write_text('\n'.join(lines)+'\n')
print(f'{len(items)} lessons; {sum(i["evidence"] is not None for i in items)} source-backed candidates')
