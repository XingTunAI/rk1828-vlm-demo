import {readFile,writeFile,appendFile,mkdir,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {summarize} from '../lib/inference.js';
import {material} from '../lib/materials.js';
const exec=promisify(execFile),root=new URL('../',import.meta.url);
const seconds=Number(process.argv[2]??14400);
if(!Number.isInteger(seconds)||seconds<1||seconds>28800)throw Error('Duration must be 1..28800 seconds');
const sessions=Number(process.env.SESSIONS||1),concurrency=Number(process.env.CONCURRENCY||sessions),maxTokens=Number(process.env.MAX_TOKENS||128);
if(!Number.isInteger(sessions)||sessions<1||sessions>8||!Number.isInteger(concurrency)||concurrency<1||concurrency>sessions||!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>512)throw Error('Invalid sessions/concurrency/token limit');
const sampleIntervalMs=Number(process.env.SAMPLE_INTERVAL_MS||5000);
if(!Number.isInteger(sampleIntervalMs)||sampleIntervalMs<1000||sampleIntervalMs>10000)throw Error('SAMPLE_INTERVAL_MS must be 1000..10000');
const base='http://127.0.0.1:8787';
async function deviceInfo(){try{return {...await exec('rknn-smi',['info'],{timeout:15000}),exitCode:0};}catch(e){if(e.code===255&&e.stdout?.includes('RK1828'))return {stdout:e.stdout,exitCode:255};throw e;}}

const profile=process.env.TEST_PROFILE||'baseline';
const prefillRepeat=Number(process.env.PREFILL_REPEAT||6);
if(!Number.isInteger(prefillRepeat)||prefillRepeat<1||prefillRepeat>400)throw Error('PREFILL_REPEAT must be 1..400; check model context budget');
const prompts={baseline:'请检查图片中是否有人，简短描述可见动作、衣着及烟火线索。看不清或单图无法确认的动作请写无法判断，不要猜测。',decode:'请详细描述图片中所有可见的人物、衣着、动作、物品、空间关系、背景和光照。按十个观察维度分别写一段，尽可能详尽，至少五百字。不能确定的内容说明无法判断，不要编造。',prefill:'你是图像复核助手。'+('审核规则：只描述可见证据，不猜测身份、意图或被遮挡细节。检查人物、衣着、动作、物品、环境与光照；看不清时说明无法判断。').repeat(prefillRepeat)+'请只用一句话描述图中主要内容。'};
if(!prompts[profile])throw Error('Unknown test profile');
const config={baseUrl:'http://127.0.0.1:8080/v1',model:'qwen3-vl-4b',maxTokens,timeoutSeconds:120};
async function api(path,data){const r=await fetch(base+path,{...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());return r.json();}
async function atomic(file,value){await writeFile(new URL(file+'.tmp',root),JSON.stringify(value,null,2));await rename(new URL(file+'.tmp',root),new URL(file,root));}
const rows=JSON.parse(await readFile(new URL('materials/manifest.json',root),'utf8')).map(r=>({...r,originalFile:r.file,file:r.inferenceFile||r.file,sha256:r.inferenceSha256||r.sha256,bytes:r.inferenceBytes||r.bytes}));
const groups=[...new Set(rows.map(r=>r.event))].map(event=>rows.filter(r=>r.event===event));
const selected=[];let bytes=0;
for(let i=0;i<20;i++)for(const group of groups){const r=group[i];if(r&&selected.length<20&&bytes+r.bytes<=20*1048576){selected.push(r);bytes+=r.bytes;}}
const images=[];for(const r of selected)images.push('data:image/jpeg;base64,'+(await material(fileURLToPath(root),r.sha256)).toString('base64'));
await api('/api/connect',config);
const modelCommand=(await exec('ps',['-ww','-C','rkllm3-server','-o','args='],{timeout:5000})).stdout;
// Verify telemetry before starting a long load.
const beforeInfo=(await deviceInfo()).stdout;
const beforeMemory=(await exec('rknn-smi',['info','-t','memory'],{timeout:15000})).stdout;
if(!/\|\s*0\s+Online\s*\|\s*OK\b/.test(beforeInfo)||!beforeMemory.includes('Free DDR Capacity(MB)'))throw Error('Device telemetry preflight failed');
const started=await api('/api/runs',{...config,images,mode:'stability',concurrency,sessions,durationSeconds:seconds,failureLimit:5,prompt:process.env.TEST_PROMPT||prompts[profile]});
const dir=`results/${started.id}/`;
await mkdir(new URL(dir,root),{recursive:true});
await writeFile(new URL(dir+'model-command.txt',root),modelCommand);
await writeFile(new URL(dir+'device-before.txt',root),beforeInfo+'\n'+beforeMemory);
await atomic('results/active-board-soak.json',{id:started.id,startedAt:new Date().toISOString(),seconds,images:selected.map(r=>({file:r.file,sha256:r.sha256})),config});
console.log('STARTED '+started.id);
let stop=false,stopRecorded=false,last,monitorErrors=0,telemetryErrors=0;const samples=[];
process.on('SIGTERM',()=>{stop=true;});process.on('SIGINT',()=>{stop=true;});
async function stopOwnRun(reason){last=await api('/api/run');if(last?.id===started.id&&last.status==='running'){await api('/api/stop',{});if(!stopRecorded){await atomic(dir+'monitor-stop.json',{reason,at:new Date().toISOString()});stopRecorded=true;}}}
try{
while(true){
 const sample={timestamp:new Date().toISOString()};
 try{
 const device=await deviceInfo();const info=device.stdout;sample.infoExitCode=device.exitCode;
 const memory=(await exec('rknn-smi',['info','-t','memory'],{timeout:15000})).stdout;
 const host=await readFile('/proc/meminfo','utf8');sample.raw=info+'\n'+memory+'\n'+host;
 const value=(text,re)=>{const m=text.match(re);return m?Number(m[1]):null;};
 sample.npuPercent=value(info,/\|\s*0\s+Online\s*\|\s*\w+\s*\|[^|]*\|\s*([\d.]+)\s*\|/);
 sample.totalMB=value(memory,/Total DDR Capacity\(MB\)\s*:\s*([\d.]+)/);
 sample.freeMB=value(memory,/Free DDR Capacity\(MB\)\s*:\s*([\d.]+)/);
 sample.hostAvailableKiB=value(host,/MemAvailable:\s*(\d+)/);
 sample.temperatureC=value(info,/RK1828\s*\|[^|]*\|\s*([\d.]+)\s*\|/);
 const health=info.match(/\|\s*0\s+(Online|Offline)\s*\|\s*(\w+)/);sample.deviceStatus=health?.[1]??null;sample.health=health?.[2]??null;
 if(sample.totalMB===null||sample.freeMB===null||sample.hostAvailableKiB===null||!health)throw Error('Required telemetry fields missing');
 telemetryErrors=0;
 if(sample.deviceStatus!=='Online'||sample.health!=='OK'){await stopOwnRun('Device unhealthy');stop=true;}
 }catch(e){sample.error=e.message;if(++telemetryErrors>=3){await stopOwnRun('Telemetry failed three consecutive times');stop=true;}}
 samples.push(sample);await appendFile(new URL(dir+'telemetry.jsonl',root),JSON.stringify(sample)+'\n');
 if(stop)await stopOwnRun('Monitor stop requested');
 try{
 last=await api('/api/run');if(last?.id!==started.id)throw Error('Active run changed');
 await atomic(dir+'progress.json',{timestamp:sample.timestamp,status:last.status,summary:last.summary,stopReason:last.stopReason,telemetry:{...sample,raw:undefined}});
 monitorErrors=0;if(last.status!=='running')break;
 }catch(e){if(++monitorErrors>=3)throw e;}
 await new Promise(r=>setTimeout(r,sampleIntervalMs));
}
// The controller writes its final report just after updating status.
let report;
for(let i=0;i<20;i++){try{report=JSON.parse(await readFile(new URL(dir+'report.json',root),'utf8'));break;}catch{await new Promise(r=>setTimeout(r,250));}}
if(!report)throw Error('Final report missing');
const valid=samples.filter(s=>Number.isFinite(s.freeMB)&&!s.error),temps=samples.map(s=>s.temperatureC).filter(Number.isFinite);
const npuValues=samples.filter(s=>!s.error&&Number.isFinite(s.npuPercent)).map(s=>s.npuPercent);
const npu={count:npuValues.length,mean:npuValues.length?npuValues.reduce((a,b)=>a+b,0)/npuValues.length:null,max:npuValues.length?Math.max(...npuValues):null,samplesAtLeast90:npuValues.filter(v=>v>=90).length};
const windows=[];const start=Date.parse(report.startedAt);
for(let offset=0;offset<report.summary.elapsedMs;offset+=300000){const records=report.records.filter(r=>{const t=Date.parse(r.startedAt)+r.durationMs-start;return t>=offset&&t<offset+300000;});windows.push({offsetSeconds:offset/1000,...summarize(records,Math.min(300000,report.summary.elapsedMs-offset))});}
await atomic(dir+'soak-summary.json',{id:started.id,status:report.status,stopReason:report.stopReason,summary:report.summary,selectedImages:selected.length,sessions,concurrency,maxTokens,profile,prefillRepeat,sampleIntervalMs,npu,telemetry:{count:samples.length,errors:samples.filter(s=>s.error).length,first:valid.length?{...valid[0],raw:undefined}:null,last:valid.length?{...valid.at(-1),raw:undefined}:null,minFreeMB:valid.length?Math.min(...valid.map(s=>s.freeMB)):null,maxTemperatureC:temps.length?Math.max(...temps):null},windows,note:'Rotating-image workload; refer to sessions and concurrency. A successful stage does not establish maximum capacity or accuracy. Window throughput counts requests completed in that window.'});
console.log('COMPLETE '+started.id);
if(report.status!=='completed'||report.summary.failed>0)process.exitCode=2;
}catch(e){await atomic(dir+'monitor-error.json',{error:e.message,at:new Date().toISOString()});try{await stopOwnRun('Monitor aborted');}catch{}throw e;}
