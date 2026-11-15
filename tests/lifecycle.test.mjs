import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {createCloseBarrier}=createRequire(import.meta.url)('../desktop/lifecycle.cjs');
test('close keeps the application open when persistence fails and user cancels',async()=>{
 const barrier=createCloseBarrier({prepare:async()=>{throw Error('SYNTHETIC storage failure');},ask:async()=>({response:0})});
 assert.equal(await barrier(),false);
});
test('close retries persistence and coalesces concurrent close and quit requests',async()=>{
 let count=0;const barrier=createCloseBarrier({prepare:async()=>{if(++count===1)throw Error('SYNTHETIC retry');},ask:async()=>({response:1})});
 assert.deepEqual(await Promise.all([barrier(),barrier()]),[true,true]);assert.equal(count,2);
});
test('discarding unsaved changes requires the explicit third choice',async()=>{
 const barrier=createCloseBarrier({prepare:async()=>{throw Error('SYNTHETIC failure');},ask:async()=>({response:2})});assert.equal(await barrier(),true);
});
