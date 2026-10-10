import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { sseEvents, infer, summarize } from '../lib/inference.js';

test('SSE preserves split UTF-8, CRLF and multi-line data',async()=>{
  const bytes=new TextEncoder().encode('data: 中文\r\ndata: 第二行\r\n\r\ndata: [DONE]\n\n');
  async function* chunks(){for(let i=0;i<bytes.length;i+=2)yield bytes.slice(i,i+2);}
  const events=[];for await(const e of sseEvents(chunks()))events.push(e);
  assert.deepEqual(events,['中文\n第二行','[DONE]']);
});
test('truncated event is rejected',async()=>{
  async function* chunks(){yield new TextEncoder().encode('data: {"incomplete":');}
  await assert.rejects(async()=>{for await(const e of sseEvents(chunks()))void e;},/中断/);
});
async function fixture(t, handler){const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));return {baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'test',maxTokens:10,timeoutSeconds:2};}
test('first content excludes empty delta; usage after finish is preserved',async t=>{
  const c=await fixture(t,(_req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n');setTimeout(()=>{res.write('data: {"choices":[{"delta":{"content":"你好"},"finish_reason":"stop"}]}\n\n');res.end('data: {"choices":[],"usage":{"completion_tokens":2}}\n\ndata: [DONE]\n\n');},50);});
  const r=await infer(c,[{role:'user',content:'hi'}]);assert.equal(r.success,true);assert.equal(r.outputTokens,2);assert.equal(r.output,'你好');assert.ok(r.ttftMs>=40);assert.equal(r.decodeTps,null);
});
test('stream without termination is failed even with partial content',async t=>{
  const c=await fixture(t,(_req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');});
  const r=await infer(c,[]);assert.equal(r.success,false);assert.match(r.error,/中断/);
});
test('failed requests excluded from latency; unknown tokens never estimated',()=>{
  const r=summarize([{success:true,ttftMs:10,durationMs:50,outputTokens:null},{success:false,ttftMs:900,durationMs:900,outputTokens:0}],1000);
  assert.equal(r.ttftP95,10);assert.equal(r.successRate,.5);assert.equal(r.tokensPerSecond,null);assert.equal(r.requestsPerSecond,1);
});
