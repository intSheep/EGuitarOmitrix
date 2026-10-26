import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCourseTool } from '../scripts/course-resources.mjs';

test('private resource pack includes indexed files only, verifies bytes and refuses traversal/tampering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eguitar-course-synthetic-'));
  const source = join(root, 'source'), archive = join(root, 'synthetic.zip'), lock = join(root, 'lock.json');
  const tool = (command, args) => runCourseTool(command, args, lock);
  try {
    await mkdir(join(source, 'p003'), { recursive: true });
    const index = { schemaVersion: 1, items: [{ id: 'synthetic', entryId: 'SYNTHETIC', images: [], gp: 'p003/score.gp' }] };
    await writeFile(join(source, 'index.json'), JSON.stringify(index));
    await writeFile(join(source, 'p003/score.gp'), 'SYNTHETIC BYTES, NOT A REAL SCORE');
    await writeFile(join(source, 'personal-records.json'), 'SYNTHETIC PRIVATE RECORDS');
    const args = ['--source', source, '--archive', archive, '--version', '2026.10.20.1'];
    assert.equal(tool('create', args).fileCount, 2);
    const output = join(root, 'output');
    tool('extract', ['--archive', archive, '--output', output]);
    assert.equal(tool('directory', ['--source', output]).itemCount, 1);
    assert.equal(await readFile(join(output, 'p003/score.gp'), 'utf8'), 'SYNTHETIC BYTES, NOT A REAL SCORE');
    await assert.rejects(readFile(join(output, 'personal-records.json')));
    assert.throws(() => tool('extract', ['--archive', archive, '--output', output]));
    await writeFile(join(output, 'p003/score.gp'), 'SYNTHETIC TAMPERING');
    assert.throws(() => tool('directory', ['--source', output]));
    // Give the malicious archive a matching outer checksum: paths still fail closed.
    const python = process.env.EGUITAR_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    execFileSync(python, ['-c', 'import sys,zipfile,json,hashlib; p,l=sys.argv[1:]; z=zipfile.ZipFile(p,"a"); z.writestr("../escape.json","SYNTHETIC"); z.close(); d=json.load(open(l)); d["sha256"]=hashlib.sha256(open(p,"rb").read()).hexdigest(); open(l,"w").write(json.dumps(d))', archive, lock]);
    assert.throws(() => tool('extract', ['--archive', archive, '--output', join(root, 'bad-output')]));
    await assert.rejects(readFile(join(root, 'escape.json')));
    // The source index cannot opt arbitrary personal files into a pack.
    await rm(archive);
    index.items[0].gp = '../personal-records.json';
    await writeFile(join(source, 'index.json'), JSON.stringify(index));
    assert.throws(() => tool('create', args));
    index.items[0].gp = 'p003/score.gp';
    await writeFile(join(source, 'index.json'), JSON.stringify(index));
    if (process.platform !== 'win32') {
      await rm(join(source, 'p003/score.gp'));
      await symlink(join(source, 'personal-records.json'), join(source, 'p003/score.gp'));
      assert.throws(() => tool('create', args));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
