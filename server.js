import http from 'node:http';
import { readFile, mkdir, writeFile, appendFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { infer } from './lib/inference.js';
import { imageInfo, visionContent, validateMessages } from './lib/vision.js';

import { schedule, loadSummary } from './lib/load.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const results = process.env.RESULTS_DIR || path.join(root, 'results');
const port = Number(process.env.PORT || 8787);
let active = null;
let chatActive = false;
let startingRun = false;
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
async function body(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 32 * 1024 * 1024) throw new Error('请求过大（上限 32 MiB）'); }
  return JSON.parse(data || '{}');
}
function integer(value, low, high, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < low || n > high) throw new Error(`${label} 必须在 ${low}–${high} 之间`);
  return n;
}
function config(input) {
  const url = new URL(input.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('服务地址无效');
  if (!url.pathname.replace(/\/$/, '').endsWith('/v1')) throw new Error('服务地址须以 /v1 结尾');
  return { baseUrl: url.href.replace(/\/$/, ''), model: String(input.model || '').slice(0,200),
    apiKey: String(input.apiKey || ''), maxTokens: integer(input.maxTokens ?? 256, 1, 8192, '输出上限'),
    timeoutSeconds: integer(input.timeoutSeconds ?? 120, 1, 600, '超时秒数') };
}
const publicConfig = c => { const { apiKey, ...rest } = c; return rest; };
function snapshot(run) {
  return { id: run.id, status: run.status, config: publicConfig(run.config), options: run.options,
    startedAt: run.startedAt, storageError: run.storageError,
    summary: loadSummary(run), records: run.records };
}
async function execute(run) {
  try {
    await schedule(run, async(index,slot)=>{
      const imageIndex=index%run.images.length;
      const record=await infer(run.config,[{role:'user',content:visionContent(run.options.prompt,run.images[imageIndex])}],slot);
      record.imageIndex=imageIndex;
      delete record.output;delete record.reasoning;
      return record;
    },record=>appendFile(path.join(results,run.id,'requests.jsonl'),JSON.stringify(record)+'\n'));
    run.status = run.storageError ? 'failed' : run.stop ? 'stopped' : 'completed';
  } catch { run.status = 'failed'; }
  run.ended = performance.now();
  run.images = null;
  try { await writeFile(path.join(results, run.id, 'report.json'), JSON.stringify(snapshot(run), null, 2)); }
  catch { run.status = 'failed'; run.storageError = '报告保存失败'; }
}

const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // The local controller is not a publicly exposed inference gateway.
    if (req.method === 'POST' && req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(res,403,{error:'不允许跨站请求'});
    if (req.method === 'POST' && url.pathname === '/api/connect') {
      const c = config(await body(req));
      const headers = c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {};
      const healthUrl = c.baseUrl.slice(0,-3)+'/health';
      const [health, models] = await Promise.all([fetch(healthUrl,{headers, signal:AbortSignal.timeout(8000)}), fetch(c.baseUrl+'/models',{headers,signal:AbortSignal.timeout(8000)})]);
      if (!health.ok || !models.ok) return json(res,502,{error:`服务未就绪（health ${health.status} / models ${models.status}）`});
      return json(res,200,{health:await health.json(),models:(await models.json()).data || []});
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      if (active?.status === 'running' || startingRun || chatActive) return json(res,409,{error:'推理任务运行中，请稍后再试'});
      const input = await body(req), c = config(input);
      validateMessages(input.messages);
      if (active?.status === 'running' || startingRun || chatActive) return json(res,409,{error:'推理任务运行中，请稍后再试'});
      chatActive = true;
      res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-cache'});
      const controller = new AbortController();
      res.on('close',()=>controller.abort());
      let record;
      try { record = await infer(c,input.messages,0,delta=>res.write(JSON.stringify({type:'delta',...delta})+'\n'),controller.signal); }
      finally { chatActive = false; }
      if (!res.destroyed) res.end(JSON.stringify({type:'result',record})+'\n');
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/runs') {
      if (active?.status === 'running' || startingRun || chatActive) return json(res,409,{error:'已有推理任务正在运行'});
      const input = await body(req), c = config(input);
      const mode = input.mode ?? 'concurrency';
      if(!['performance','baseline','concurrency','arrival','burst','stability'].includes(mode))throw new Error('未知测试模式');
      const concurrency = mode === 'baseline' ? 1 : integer(input.concurrency ?? 1,1,8,'并发数');
      const sessions = integer(input.sessions ?? 1,1,8,'服务 session 数');
      if (concurrency > sessions) throw new Error('并发数不能超过已配置的服务 session 数');
      const images=input.images ?? [input.image];
      if(!Array.isArray(images)||!images.length||images.length>20)throw new Error('选择 1–20 张图片');
      const metadata=images.map(imageInfo);
      if(metadata.reduce((n,m)=>n+m.bytes,0)>20*1024*1024)throw new Error('图片集合不超过 20 MiB');
      const image=metadata[0];
      const options = {mode, concurrency, sessions, image, images:metadata, workload:'round-robin-single-image-vlm', requests: ['stability','arrival','burst'].includes(mode) ? 100000 : integer(input.requests ?? 30,1,10000,'请求数'),
        durationSeconds: integer(input.durationSeconds ?? 1800,1,28800,'时长'), prompt: String(input.prompt || '').trim()};
      options.queueLimit=integer(input.queueLimit ?? 32,0,1000,'排队上限');
      options.arrivalRate=Number(input.arrivalRate ?? 1);
      if(!Number.isFinite(options.arrivalRate)||options.arrivalRate<0.1||options.arrivalRate>100)throw new Error('输入速率须为 0.1–100 请求/秒');
      options.burstSize=integer(input.burstSize ?? 8,1,1000,'突发批量');
      options.burstInterval=integer(input.burstInterval ?? 10,1,3600,'突发间隔');
      if (!options.prompt || options.prompt.length > 60000) throw new Error('请输入不超过 60000 字符的测试文本');
      if (active?.status === 'running' || startingRun || chatActive) return json(res,409,{error:'已有推理任务正在运行'});
      startingRun = true;
      const run = {id:randomUUID(), status:'running', config:c, options, images, startedAt:new Date().toISOString(), start:performance.now(), records:[], stop:false};
      try {
        await mkdir(path.join(results,run.id),{recursive:true});
        await writeFile(path.join(results,run.id,'config.json'),JSON.stringify({config:publicConfig(c),options,startedAt:run.startedAt},null,2));
        active = run;
      } finally { startingRun = false; }
      void execute(run);
      return json(res,201,{id:run.id});
    }
    if (req.method === 'POST' && url.pathname === '/api/stop') {
      if (active?.status === 'running') active.stop = true;
      return json(res,200,{message:'已停止输入并取消排队任务；在途请求完成或超时后结束'});
    }
    if (req.method === 'GET' && url.pathname === '/api/run') { const state = active ? snapshot(active) : null; if(state)state.records=state.records.slice(-100); return json(res,200,state); }
    if (req.method === 'GET' && url.pathname === '/api/reports') {
      await mkdir(results,{recursive:true});
      const reports = [];
      for (const id of await readdir(results)) {
        if (!/^[a-f0-9-]{36}$/.test(id)) continue;
        try { const r=JSON.parse(await readFile(path.join(results,id,'report.json'),'utf8')); reports.push({id,status:r.status,startedAt:r.startedAt,mode:r.options.mode,concurrency:r.options.concurrency,summary:r.summary}); } catch {}
      }
      return json(res,200,reports.sort((a,b)=>b.startedAt.localeCompare(a.startedAt)));
    }
    if (req.method === 'GET' && /^\/api\/reports\/[a-f0-9-]{36}$/.test(url.pathname)) {
      const id=url.pathname.split('/').pop();
      try { return json(res,200,JSON.parse(await readFile(path.join(results,id,'report.json'),'utf8'))); } catch { return json(res,404,{error:'报告不存在或测试尚未结束'}); }
    }
    const assets = {'/':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css']};
    if (req.method === 'GET' && assets[url.pathname]) {
      const [name,type]=assets[url.pathname]; res.writeHead(200,{'Content-Type':type+'; charset=utf-8'}); res.end(await readFile(path.join(root,'public',name))); return;
    }
    json(res,404,{error:'接口不存在'});
  } catch(error) { if (!res.headersSent) json(res,400,{error:error.message}); else res.end(); }
});
server.listen(port,'127.0.0.1',()=>console.log(`RK1828 VLM Demo: http://127.0.0.1:${port}`));
