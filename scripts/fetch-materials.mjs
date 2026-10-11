import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),exec=promisify(execFile);
const rows=JSON.parse(await readFile(resolve(root,'materials/manifest.json'),'utf8'));
let failures=0;
for(const r of rows){
 const file=resolve(root,r.file),rel=relative(resolve(root,'materials'),file);
 if(isAbsolute(rel)||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\'))throw Error('Invalid material path');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 try {const current=await readFile(file);if(hash(current)===r.sha256){console.log('OK '+r.file);continue;}throw Error('Existing file changed; keep it and resolve manually');}
 catch(e){if(e.code!=='ENOENT'){console.error(r.file+': '+e.message);failures++;continue;}}
 const url=new URL(r.url);if(url.protocol!=='https:'||url.hostname!=='upload.wikimedia.org')throw Error('Unexpected material source');
 try{
 await mkdir(dirname(file),{recursive:true});
 await exec(process.platform==='win32'?'curl.exe':'curl',['-fL','--connect-timeout','10','--max-time','60',url.href,'-o',file+'.part'],{timeout:65000,maxBuffer:1048576});
 const b=await readFile(file+'.part');if(b.length!==r.bytes||hash(b)!==r.sha256)throw Error('Source content differs from pinned manifest');
 await rename(file+'.part',file);console.log('Downloaded '+r.file);
 }catch(e){failures++;console.error(r.file+': '+e.message);if(/429/.test(e.stderr??e.message)){console.error('Source rate limited requests; stop and retry later.');break;}}
}
if(failures)process.exitCode=1;
