import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {teacherPrescription,todayPractice} from '../app/prescription.js';
const a={entryId:'123',version:'synthetic',dailyMinutes:5,tempo:'固定 40 BPM，不加速',evidence:{sha256:'a'.repeat(64),from:0,to:10}};
const at=(d,h=12)=>new Date(2026,9,d,h).getTime();
const log=(id,date,seconds,extra={})=>({id,entryId:'123',assignmentVersion:'synthetic',source:'timer',minutes:seconds/60,practicedAt:new Date(date).toISOString(),intervals:[{start:date,end:date+seconds*1000}],...extra});
test('daily target counts multiple sessions and an active draft once, without debt or mastery',()=>{
 const logs=[log('old',at(10),50),log('one',at(18),60),log('two',at(18,13),60),log('deleted',at(18),100,{deletedAt:'2026-10-18'}),log('other',at(18),100,{entryId:'999'}),log('version',at(18),100,{assignmentVersion:'old'})];
 const draft={id:'active',entryId:'123',assignmentVersion:'synthetic',createdAt:new Date(at(18,14)).toISOString(),elapsedMs:60000,intervals:[{start:at(18,14),end:at(18,14)+60000}]};
 assert.deepEqual(todayPractice(logs,draft,a,at(18,16)),{seconds:180,targetSeconds:300,remainingSeconds:120,completed:false});
 assert.equal(todayPractice([...logs,log('active',at(18,14),60)],draft,a,at(18,16)).seconds,180);
 assert.equal(todayPractice(logs,draft,a,at(19)).remainingSeconds,300);
 assert.equal(todayPractice(logs,draft,a,at(25)).remainingSeconds,300);
 const done=todayPractice([log('long',at(18),360)],null,a,at(18,16));assert.equal(done.seconds,360);assert.equal(done.remainingSeconds,0);assert.equal(done.completed,true);
});
test('local midnight divides actual intervals and unknown dose has no denominator',()=>{
 const midnight=new Date(2026,9,19,0).getTime(),crossing=log('cross',midnight-60000,180);
 assert.equal(todayPractice([crossing],null,a,midnight-1).seconds,60);
 assert.equal(todayPractice([crossing],null,a,midnight+120000).seconds,120);
 assert.equal(todayPractice([crossing],null,{...a,dailyMinutes:null},midnight+120000).remainingSeconds,null);
 assert.equal(teacherPrescription({...a,dailyMinutes:null,evidence:{...a.evidence,doseQuote:'每天练2分钟'}}).dailyMinutes,null);
 assert.equal(teacherPrescription({...a,evidence:null}).dailyMinutes,null);
 assert.equal(teacherPrescription({...a,evidence:null}).startBpm,null);
 assert.equal(todayPractice([],null,undefined).seconds,0);
});
test('BPM roles and real uncertain prescriptions are not collapsed or guessed',async()=>{
 assert.equal(teacherPrescription({...a,tempo:'曲谱标速的 50%→100%；前四张 50→100 BPM'}).startBpm,null);
 assert.equal(teacherPrescription({...a,tempo:'40 BPM 起步；目标待听校'}).startBpm,40);
 assert.match(teacherPrescription({...a,tempo:'40 BPM 起步；目标待听校'}).tempo,/目标 BPM 未明确/);
 assert.equal(teacherPrescription({...a,tempo:'不用节拍器；反应目标约5秒'}).startBpm,null);
 const data=JSON.parse(await readFile(new URL('../app/data/assignments.json',import.meta.url))).items;
 assert.equal(teacherPrescription(data.find(a=>a.page===117)).dailyMinutes,null);
 assert.equal(teacherPrescription(data.find(a=>a.page===137)).startBpm,null);
 assert.match(teacherPrescription(data.find(a=>a.page===70)).tempo,/目标 BPM 未明确/);
 assert.equal(teacherPrescription(data.find(a=>a.page===3)).fixedBpm,40);
 assert.equal(teacherPrescription(data.find(a=>a.page===17)).startBpm,null);
});
