import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule,loadSummary} from '../lib/load.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function run(mode,extra={}){return {start:performance.now(),records:[],stop:false,options:{mode,concurrency:2,requests:8,durationSeconds:1,queueLimit:2,arrivalRate:100,burstSize:8,burstInterval:10,...extra}};}
const result=()=>({success:true,durationMs:30,ttftMs:5,outputTokens:2});
test('burst bounds queue, records rejection and drains accepted work with isolated slots',async()=>{
 const r=run('burst');const busy=new Set();let peak=0;
 await schedule(r,async(index,slot)=>{assert.ok(!busy.has(slot));busy.add(slot);peak=Math.max(peak,busy.size);await wait(30);busy.delete(slot);return result();},async()=>{});
 assert.equal(peak,2);assert.equal(r.offered,8);assert.equal(r.dropped,4);assert.equal(r.records.length,4);assert.equal(r.peakQueue,2);assert.ok(r.records.some(x=>x.queueMs>=20));
 const s=loadSummary(r);assert.equal(s.completionRatio,.5);assert.ok(s.endToEndP95>=s.queueP95);
});
test('stop cancels queued work and waits for in-flight work',async()=>{
 const r=run('burst');
 await schedule(r,async()=>{await wait(20);r.stop=true;return result();},async()=>{});
 assert.equal(r.records.length,2);assert.equal(r.cancelled,2);assert.equal(r.offered,r.records.length+r.cancelled+r.dropped);
});
test('fixed arrivals continue under saturation and closed-loop does not reject',async()=>{
 const open=run('arrival');await schedule(open,async()=>{await wait(100);return result();},async()=>{});
 assert.equal(open.offered,8);assert.ok(open.dropped>0);
 const closed=run('concurrency');await schedule(closed,async()=>{await wait(10);return result();},async()=>{});
 assert.equal(closed.records.length,8);assert.equal(closed.dropped,0);assert.equal(closed.peakQueue,0);
});
