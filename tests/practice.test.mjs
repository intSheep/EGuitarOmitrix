import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateLog, activeLogs, latestLog, validateBackup, mergePreview } from '../app/practice-store.js';
// Synthetic records only. No real learner history.
const log=(id='synthetic-1',extra={})=>({id,entryId:'123',assignmentVersion:'test',minutes:5,outcome:'learning',bpm:null,practicedAt:'2026-01-01T00:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',note:'Synthetic fixture',nextFocus:'Synthetic next step',deletedAt:null,...extra});
test('actual duration and self-report reject invalid values without assigning defaults',()=>{
  for(const changes of [{minutes:0},{minutes:-1},{minutes:Infinity},{bpm:0},{bpm:40.5},{outcome:'invented'},{practicedAt:'bad'},{practicedAt:'2999-01-01'},{note:1}])assert.throws(()=>validateLog(log('x',changes)));
  assert.equal(validateLog(log()).bpm,null);
});
test('resume uses actual practice date, excludes deleted records, and keeps course identities separate',()=>{
  const a=log(), b=log('b',{entryId:'456',practicedAt:'2026-01-03',createdAt:'2026-01-03'}),c=log('c',{practicedAt:'2026-01-04',deletedAt:'2026-01-05'});
  assert.equal(latestLog([a,b,c]).entryId,'456'); assert.equal(latestLog([a,b,c],'123').id,a.id);assert.equal(activeLogs([a,b,c]).length,2);
});
test('backup validation rejects future schemas, duplicate ids and foreign lessons before merge',()=>{
  const backup={app:'EGuitarOmitrix',schemaVersion:1,logs:[log()]};
  assert.equal(validateBackup(backup,new Set(['123'])).length,1);
  assert.throws(()=>validateBackup({...backup,schemaVersion:3},new Set(['123'])));
  assert.throws(()=>validateBackup({...backup,logs:[log(),log()]},new Set(['123'])));
  assert.throws(()=>validateBackup(backup,new Set(['456'])));
});
test('merge is idempotent and refuses conflicting versions without modifying existing history',()=>{
  const existing=[log()];assert.equal(mergePreview(existing,[log()]).duplicates,1);
  assert.equal(mergePreview(existing,[log('new')]).additions.length,1);
  assert.throws(()=>mergePreview(existing,[log('synthetic-1',{minutes:10})]));assert.equal(existing[0].minutes,5);
});
test('assignment inventory covers every lesson with uncertainty and evidence intact',async()=>{
  const course=JSON.parse(await readFile(new URL('../app/data/course.json',import.meta.url)));
  const a=JSON.parse(await readFile(new URL('../app/data/assignments.json',import.meta.url)));
  const lessons=course.entries.filter(e=>e.kind==='lesson'); assert.equal(a.items.length,lessons.length);
  assert.equal(new Set(a.items.map(i=>i.entryId)).size,72);
  assert.equal(a.items.filter(i=>i.evidence&&!i.legacy).length,66);
  assert.equal(a.items.filter(i=>!i.evidence).length,0);
  for(const i of a.items) { const e=lessons.find(e=>e.id===i.entryId);assert.equal(i.page,e.page);assert.equal(i.legacy,e.legacy);assert.equal(i.sessionsPerDay,null);if(i.evidence){assert.match(i.evidence.sha256,/^[a-f0-9]{64}$/);assert.ok(i.evidence.from>=0&&i.evidence.from<i.evidence.to&&i.evidence.to<=e.durationSeconds+2);assert.ok(['subtitle-candidate','video-card-reviewed'].includes(i.status));} }
  assert.equal(a.items.find(i=>i.page===117).dailyMinutes,null);
  assert.match(a.items.find(i=>i.page===3).tempo,/固定 40.*不加速/);
  assert.match(a.items.find(i=>i.page===70).tempo,/未明确/);
});

test('video cards recover fixed-tempo and daily-dose requirements without inferring sessions', async()=>{const a=JSON.parse(await readFile(new URL('../app/data/assignments.json',import.meta.url)));assert.equal(a.items.filter(i=>i.status==='video-card-reviewed').length,8);assert.equal(a.items.find(i=>i.page===68).dailyMinutes,5);assert.match(a.items.find(i=>i.page===119).tempo,/固定 50.*不加速/);});
