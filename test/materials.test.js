import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {catalog,material} from '../lib/materials.js';
test('material allowlist rejects unknown ids, escaped paths and changed bytes',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'materials-'));await mkdir(path.join(root,'materials'));
 const bytes=Buffer.from([255,216,255,0]);const id=createHash('sha256').update(bytes).digest('hex');
 const row={sha256:id,file:'materials/test.jpg',event:'phone'};
 await writeFile(path.join(root,'materials/test.jpg'),bytes);await writeFile(path.join(root,'materials/manifest.json'),JSON.stringify([row]));
 assert.equal((await catalog(root))[0].id,id);assert.deepEqual(await material(root,id),bytes);
 await assert.rejects(material(root,'../secret'));await assert.rejects(material(root,'0'.repeat(64)));
 await writeFile(path.join(root,'materials/test.jpg'),'changed');await assert.rejects(material(root,id),/校验/);
 await writeFile(path.join(root,'outside.jpg'),bytes);row.file='outside.jpg';await writeFile(path.join(root,'materials/manifest.json'),JSON.stringify([row]));await assert.rejects(material(root,id),/路径/);
});
test('RGB inference derivative is selected and verified instead of original',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'materials-rgb-'));await mkdir(path.join(root,'materials'));
 const bytes=Buffer.from('rgb-copy'),id=createHash('sha256').update(bytes).digest('hex');
 await writeFile(path.join(root,'materials/rgb.jpg'),bytes);
 await writeFile(path.join(root,'materials/manifest.json'),JSON.stringify([{file:'materials/original.jpg',sha256:'0'.repeat(64),inferenceFile:'materials/rgb.jpg',inferenceSha256:id,inferenceBytes:bytes.length}]));
 assert.equal((await catalog(root))[0].id,id);assert.deepEqual(await material(root,id),bytes);
 await assert.rejects(material(root,'0'.repeat(64)),/不存在/);
});
