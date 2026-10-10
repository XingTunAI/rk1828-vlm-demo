import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { visionContent } from '../lib/vision.js';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';

test('controller: connection, chat, slot isolation, stop and report persistence', {timeout:15000}, async t=>{
  const slots=[];
  const fixture=http.createServer(async(req,res)=>{
    if(req.url==='/health')return res.end('{"status":"ok"}');
    if(req.url==='/v1/models')return res.end('{"data":[{"id":"test-only-fixture"}]}');
    let body='';for await(const b of req)body+=b;const input=JSON.parse(body);slots.push(input.id_slot);
    assert.equal(input.messages[0].content[0].image_url.url,image);
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    setTimeout(()=>res.end('data: {"choices":[{"delta":{"content":"fixture"},"finish_reason":"stop"}],"usage":{"completion_tokens":1}}\n\ndata: [DONE]\n\n'),100);
  });
  await new Promise(r=>fixture.listen(0,'127.0.0.1',r));
  t.after(()=>{fixture.closeAllConnections();fixture.close();});
  const tmp=await mkdtemp(path.join(tmpdir(),'rk1828-test-'));
  // Reserve a free controller port, then release it before spawning.
  const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),RESULTS_DIR:tmp},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());await once(child.stdout,'data');
  const base=`http://127.0.0.1:${port}`;
  async function post(route,data){return fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
  const c={baseUrl:`http://127.0.0.1:${fixture.address().port}/v1`,model:'test-only-fixture',apiKey:'test-secret',maxTokens:16,timeoutSeconds:2};
  assert.equal((await post('/api/connect',c)).status,200);
  assert.equal((await post('/api/chat',{...c,messages:[{role:'user',content:'text only'}]})).status,400);
  const chat=await post('/api/chat',{...c,messages:[{role:'user',content:visionContent('hello',image)}]});assert.match(await chat.text(),/"success":true/);
  assert.equal((await post('/api/runs',{...c,concurrency:2,sessions:1,prompt:'test'})).status,400);
  assert.equal((await post('/api/runs',{...c,prompt:'missing image'})).status,400);
  const started=await post('/api/runs',{...c,image,mode:'stability',concurrency:2,sessions:2,durationSeconds:20,prompt:'fixture only'});
  assert.equal(started.status,201);const {id}=await started.json();
  assert.equal((await post('/api/chat',{...c,messages:[{role:'user',content:'busy'}]})).status,409);
  await post('/api/stop',{});
  let run;
  for(let i=0;i<50;i++){run=await(await fetch(base+'/api/run')).json();if(run.status!=='running')break;await new Promise(r=>setTimeout(r,30));}
  assert.equal(run.status,'stopped');assert.equal(run.summary.total,2);assert.equal(run.summary.succeeded,2);assert.ok(slots.includes(1));
  const report=await readFile(path.join(tmp,id,'report.json'),'utf8');assert.ok(!report.includes('test-secret'));assert.ok(!report.includes('"output":'));assert.equal(JSON.parse(report).records.length,2);
  assert.ok(!report.includes('base64'));assert.equal(JSON.parse(report).options.image.mime,'image/png');
  assert.equal((await fetch(base+'/api/reports/'+id)).status,200);
  assert.equal((await fetch(base)).status,200);
});
