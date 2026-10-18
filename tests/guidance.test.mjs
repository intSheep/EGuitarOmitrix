import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,resumeSession,tickSession,pauseSession,recoverSession,sessionLog} from '../app/session.js';
import {emptyGoals,validateGoals,mergeGoals,resumeGuidance,optionalNumber} from '../app/guidance.js';
import {validateLog,validateBackup} from '../app/practice-store.js';
const start=Date.parse('2026-01-01T00:00:00Z');
function session(){return resumeSession(createSession('123','v1',start,'synthetic'),start,0);}
test('metronome evidence counts active intervals only and never infers stable BPM or mastery',()=>{
 let s=session();s=tickSession(s,start+1000,1000,60);s=tickSession(s,start+2000,2000,80);
 s=pauseSession(s,start+2500,2500,'paused',80);s=tickSession(s,start+3500,3500,80);
 assert.deepEqual(s.tempoUsage,[{bpm:60,seconds:1},{bpm:80,seconds:1.5}]);
 const log=sessionLog(s,start+4000);validateLog(log);assert.equal(log.bpm,null);assert.equal(log.outcome,null);
 assert.throws(()=>validateLog({...log,tempoUsage:[{bpm:60,seconds:3}]}));
 s=resumeSession(recoverSession(s),start+5000,5000);s=tickSession(s,start+20000,20000,120);
 assert.equal(s.elapsedMs,2500);assert.equal(s.tempoUsage.length,2);
});
test('resume keeps versions separate, honors fixed/no-metronome rules and ignores goal speed',()=>{
 const l={entryId:'123',assignmentVersion:'v1',practicedAt:'2026-01-01',bpm:70,bpmBasis:'self-reported-stable',outcome:'learning'};
 assert.equal(resumeGuidance([l],'123','v1',{}).bpm,70);
 assert.equal(resumeGuidance([l],'123','v2',{}).last,undefined);
 assert.equal(resumeGuidance([{...l,deletedAt:'2026-01-02'}],'123','v1',{}).last,undefined);
 assert.equal(resumeGuidance([l],'123','v1',{tempo:'固定 40 BPM，不加速'}).bpm,40);
 assert.equal(resumeGuidance([l],'123','v1',{tempo:'不用节拍器'}).bpm,null);
 assert.equal(resumeGuidance([{...l,bpmBasis:undefined}],'123','v1',{}).bpm,null);
});
test('nullable learner goals and backup versions preserve old records and refuse goal conflicts',()=>{
 const goals={weeklySessions:3,lessons:{123:{minutes:15,bpm:80}}};validateGoals(goals,new Set(['123']));
 assert.deepEqual(mergeGoals(emptyGoals(),goals),goals);assert.deepEqual(mergeGoals(goals,goals),goals);
 assert.throws(()=>mergeGoals(goals,{...goals,weeklySessions:4}));
 assert.throws(()=>mergeGoals(goals,{weeklySessions:3,lessons:{123:{minutes:20,bpm:80}}}));
 assert.throws(()=>validateGoals(goals,new Set(['999'])));
 assert.equal(optionalNumber('',1,400),null);assert.throws(()=>optionalNumber('40.5',1,400));
 const log=sessionLog(tickSession(session(),start+1000,1000),start+1000);
 for(const version of [1,2])assert.equal(validateBackup({schemaVersion:version,app:'EGuitarOmitrix',logs:[log],goals},new Set(['123'])).length,1);
 assert.throws(()=>validateBackup({schemaVersion:3,app:'EGuitarOmitrix',logs:[log]},new Set(['123'])));
});
