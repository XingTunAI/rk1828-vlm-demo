import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const rows=JSON.parse(await readFile(resolve(root,'materials/manifest.json'),'utf8'));
const seen=new Set();let bytes=0;
for(const row of rows){
 const path=resolve(root,row.file),rel=relative(resolve(root,'materials'),path);
 if(isAbsolute(rel)||rel==='..'||rel.startsWith('..\\')||rel.startsWith('../'))throw Error('Path outside materials');
 if(seen.has(row.sha256))throw Error('Duplicate image: '+row.file);seen.add(row.sha256);
 const data=await readFile(path);
 if(data.length!==row.bytes||data.length>4*1024*1024)throw Error('Invalid image size: '+row.file);
 if(data[0]!==255||data[1]!==216||createHash('sha256').update(data).digest('hex')!==row.sha256)throw Error('Invalid image or checksum: '+row.file);
 if(!row.author||!row.source||!row.license)throw Error('Missing attribution: '+row.file);
 if(row.status==='unreviewed'&&row.label!==null)throw Error('Unreviewed image must not carry ground truth');
 bytes+=data.length;
}
console.log(`Verified ${rows.length} unique JPEG images; ${(bytes/1048576).toFixed(2)} MiB. Labels are not validated by this check.`);
