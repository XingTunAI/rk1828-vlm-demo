import { summarize } from './inference.js';

export function loadSummary(run) {
  const elapsed = (run.ended ?? performance.now()) - run.start;
  const summary = summarize(run.records, elapsed);
  const percentile = (key, p) => {
    const values = run.records.filter(r => r.success).map(r => r[key]).filter(Number.isFinite).sort((a,b)=>a-b);
    return values.length ? values[Math.ceil(values.length*p)-1] : null;
  };
  return {...summary, offered:run.offered ?? 0, dropped:run.dropped ?? 0, cancelled:run.cancelled ?? 0,
    queued:run.queue?.length ?? 0, inFlight:run.inFlight ?? 0, peakQueue:run.peakQueue ?? 0,
    queueP95:percentile('queueMs',.95), endToEndP50:percentile('endToEndMs',.5),
    endToEndP95:percentile('endToEndMs',.95), endToEndP99:percentile('endToEndMs',.99),
    completionRatio:run.offered ? summary.succeeded/run.offered : null,
    drainMs:run.inputEnded ? Math.max(0,(run.ended ?? performance.now())-run.inputEnded) : null};
}

// Closed-loop workers measure saturation. Open-loop arrivals expose backlog and rejection.
export async function schedule(run, request, save) {
  const o=run.options, open=['arrival','burst'].includes(o.mode);
  run.queue=[];run.offered=0;run.dropped=0;run.cancelled=0;run.inFlight=0;run.peakQueue=0;
  const jobs=new Set(), free=Array.from({length:o.concurrency},(_,i)=>i);
  const deadline=run.start+o.durationSeconds*1000;
  let next=run.start, produced=0;
  const launch=(job,slot)=>{
    run.inFlight++;
    const task=(async()=>{
      const dispatched=performance.now();
      const record=await request(job.index,slot);
      record.index=job.index;record.queueMs=dispatched-job.at;
      record.endToEndMs=performance.now()-job.at;
      run.records.push(record);
      await save(record);
    })().catch(error=>{run.storageError=error.message;run.stop=true;})
      .finally(()=>{run.inFlight--;free.push(slot);jobs.delete(task);});
    jobs.add(task);
  };
  const offer=at=>{
    const job={index:run.offered++,at};
    if(free.length)launch(job,free.shift());
    else if(run.queue.length<o.queueLimit){run.queue.push(job);run.peakQueue=Math.max(run.peakQueue,run.queue.length);}
    else run.dropped++;
  };
  while(true){
    let now=performance.now();
    if(run.stop){run.cancelled+=run.queue.length;run.queue=[];run.inputEnded??=now;}
    while(!run.stop&&run.queue.length&&free.length)launch(run.queue.shift(),free.shift());
    if(!run.stop&&!run.inputEnded){
      if(open){
        // Stop generating at the time bound; do not emit a late catch-up burst.
        if(now>=deadline)run.inputEnded=now;
        else {
          while(next<=now&&produced<o.requests){
            const count=o.mode==='burst'?Math.min(o.burstSize,o.requests-produced):1;
            for(let i=0;i<count;i++){offer(next);produced++;}
            next+=o.mode==='burst'?o.burstInterval*1000:1000/o.arrivalRate;
          }
          if(produced>=o.requests)run.inputEnded=now;
        }
      }else{
        while(free.length&&produced<o.requests&&performance.now()<deadline){offer(performance.now());produced++;}
        if(produced>=o.requests||performance.now()>=deadline)run.inputEnded=performance.now();
      }
    }
    if(run.inputEnded&&!run.queue.length&&!jobs.size)break;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  await Promise.all(jobs);
}
