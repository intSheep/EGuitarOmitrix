import test from 'node:test';
import assert from 'node:assert/strict';
import { POSITIONS, positionNotes } from '../app/position-reference.js';
test('five C-major reference patterns contain every scale degree on six strings', () => {
  assert.equal(POSITIONS.length,5);
  for (let i=0;i<5;i++) {
    const notes=positionNotes(i);
    assert.deepEqual([...new Set(notes.map(n=>n.name))].sort(),['A','B','C','D','E','F','G']);
    assert.deepEqual([...new Set(notes.map(n=>n.string))],[1,2,3,4,5,6]);
    assert.ok(notes.every(n=>n.degree && n.root === (n.name==='C')));
    assert.equal(new Set(notes.map(n=>`${n.string}:${n.fret}`)).size,notes.length);
  }
  assert.deepEqual(positionNotes(4).filter(n=>n.string===6).map(n=>[n.fret,n.name]),[[12,'E'],[13,'F'],[15,'G']]);
});
