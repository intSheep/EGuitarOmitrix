import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGroups,chartCoordinates} from '../app/review-model.js';
import {lessonReview} from '../app/review-view.js';
const log=(id,extra={})=>({id,entryId:'lesson',assignmentVersion:'v1',practicedAt:`2026-01-${id.padStart(2,'0')}T10:00:00Z`,createdAt:'2026-01-01T10:00:00Z',minutes:5,outcome:null,bpm:null,...extra});
test('review preserves versions, exact timer seconds and deleted history',()=>{
 const logs=[log('1',{source:'timer',seconds:61}),log('2'),log('3',{assignmentVersion:'v0'}),log('4',{deletedAt:'today'})];
 const before=JSON.stringify(logs),groups=reviewGroups(logs,[{entryId:'lesson',version:'v1'}]);
 assert.equal(groups.length,2);const current=groups.find(g=>g.current);
 assert.equal(current.seconds,361);assert.deepEqual(current.duration.map(p=>p.value),[61,361]);assert.equal(JSON.stringify(logs),before);
});
test('only explicit stable BPM is graphed; latest is not peak and missing is not zero',()=>{
 const g=reviewGroups([log('1',{bpm:90,bpmBasis:'self-reported-stable'}),log('2',{bpm:70,bpmBasis:'self-reported-stable'}),log('3',{bpm:120,tempoUsage:[{bpm:150,seconds:10}]}),log('4')],[])[0];
 assert.deepEqual(g.tempo.map(p=>p.value),[90,70]);assert.equal(g.latestTempo.value,70);
});
test('latest explicit self-report determines status without inactivity inference',()=>{
 const g=reviewGroups([log('1',{outcome:'mastered'}),log('2',{outcome:'learning'}),log('3')],[])[0];
 assert.equal(g.status,'continue');assert.equal(g.latestOutcome.value,'learning');
 assert.equal(reviewGroups([log('1',{outcome:'review'})],[])[0].status,'continue');
 assert.equal(reviewGroups([log('1')],[])[0].status,'unrated');
});
test('coordinates use date spacing and handle single or coincident observations',()=>{
 assert.deepEqual(chartCoordinates([]),[]);
 assert.equal(chartCoordinates([{at:'2026-01-01',value:30}])[0].x,320);
 const p=chartCoordinates([{at:'2026-01-01',value:0},{at:'2026-01-02',value:10},{at:'2026-01-11',value:20}],{zero:true});
 assert.equal(p[0].y,176);assert.ok(Math.abs(p[1].x-110.8)<.01);
 assert.ok(chartCoordinates([{at:'2026-01-01',value:0},{at:'2026-01-01',value:0}]).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('detail separates BPM points, escapes labels and paginates exact records',()=>{
 const logs=Array.from({length:21},(_,i)=>log(String(i+1),{bpm:60,bpmBasis:'self-reported-stable',assignmentVersion:'<unsafe>'}));
 const html=lessonReview(logs,{entries:[]},[],new URLSearchParams({lesson:'lesson',version:'<unsafe>'}));
 assert.ok(html.includes('&lt;unsafe&gt;'));assert.ok(html.includes('下一页'));
 const tempo=html.split('tempo-chart')[1].split('</svg>')[0];assert.ok(!tempo.includes('polyline'));assert.equal((tempo.match(/<circle/g)||[]).length,21);
});
