import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export async function catalog(root){
 const rows=JSON.parse(await readFile(path.join(root,'materials','manifest.json'),'utf8'));
 return rows.map(r=>({id:r.inferenceSha256||r.sha256,event:r.event,title:r.title,bytes:r.inferenceBytes||r.bytes,status:r.status,source:r.source,author:r.author,license:r.license,file:r.inferenceFile||r.file,changes:r.inferenceChanges||r.changes}));
}
export async function material(root,id){
 if(!/^[a-f0-9]{64}$/.test(id))throw Error('无效素材 ID');
 const row=(await catalog(root)).find(r=>r.id===id);if(!row)throw Error('素材不存在');
 const base=await realpath(path.join(root,'materials')),file=await realpath(path.resolve(root,row.file));
 const rel=path.relative(base,file);if(path.isAbsolute(rel)||rel==='..'||rel.startsWith('..'+path.sep))throw Error('素材路径无效');
 const data=await readFile(file);if(createHash('sha256').update(data).digest('hex')!==id)throw Error('素材校验失败');
 return data;
}
