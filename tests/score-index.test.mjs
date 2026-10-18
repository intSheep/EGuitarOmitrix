import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('local index includes multiple examples and diagrams but separates editions and excludes trials',async()=>{
 const root=await mkdtemp(join(tmpdir(),'eguitar-index-'));
 try{
  await mkdir(join(root,'app/data'),{recursive:true});await mkdir(join(root,'app/local-scores'),{recursive:true});
  const entries=[{id:'current',page:1,title:'Synthetic lesson',stage:1,legacy:false,exercises:[1]},{id:'paired',page:2,stage:1,legacy:false,exercises:[1]},{id:'old',page:3,stage:1,legacy:true,exercises:[1]},{id:'other',page:4,stage:2,legacy:false,exercises:[1]}];
  await writeFile(join(root,'app/data/course.json'),JSON.stringify({entries}));
  for(const [name,files,referenceOnly] of [['p001',['score.gp'],false],['p001-ex2',['score.musicxml'],false],['p001-ex99',['source-10.jpg','source-2.jpg'],true],['p001-trial',['score.gp'],false]]){
   const dir=join(root,'app/local-scores',name);await mkdir(dir);await writeFile(join(dir,'manifest.json'),JSON.stringify({title:'Synthetic',referenceOnly}));
   for(const file of files)await writeFile(join(dir,file),'Synthetic fixture only');
  }
  const result=spawnSync('python3',['scripts/index-local-scores.py','--root',root],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const {items}=JSON.parse(await readFile(join(root,'app/local-scores/index.json'),'utf8'));
  assert.equal(items.length,3);assert.ok(items.every(i=>JSON.stringify(i.entryIds)===JSON.stringify(['current','paired'])));
  assert.deepEqual(items.find(i=>i.referenceOnly).images,['p001-ex99/source-2.jpg','p001-ex99/source-10.jpg']);
 }finally{await rm(root,{recursive:true});}
});
