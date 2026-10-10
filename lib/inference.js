import { performance } from 'node:perf_hooks';

export async function* sseEvents(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    let match;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      const data = block.split(/\r?\n/).filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, '')).join('\n');
      if (data) yield data;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) throw new Error('SSE 响应在事件结束前中断');
}

export async function infer(config, messages, slot = 0, onDelta = () => {}, signal) {
  const start = performance.now();
  let first = null, output = '', reasoning = '', finishReason = null, usage = null, timings = null;
  const record = { slot, startedAt: new Date().toISOString(), success: false };
  try {
    const timeout = AbortSignal.timeout(config.timeoutSeconds * 1000);
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({ model: config.model, messages, stream: true, n_predict: config.maxTokens,
        max_tokens: config.maxTokens, temperature: 0, cache_prompt: false, id_slot: slot }),
    });
    if (!response.ok) throw new Error(`推理服务返回 HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('服务未返回 SSE 流');
    let done = false;
    for await (const data of sseEvents(response.body)) {
      if (data === '[DONE]') { done = true; break; }
      const event = JSON.parse(data);
      if (event.error) throw new Error('推理服务报告错误');
      const choice = event.choices?.[0];
      const content = choice?.delta?.content || '';
      const thought = choice?.delta?.reasoning_content || '';
      if ((content || thought) && first === null) first = performance.now();
      output += content; reasoning += thought;
      if (content || thought) onDelta({ content, reasoning: thought });
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (event.usage) usage = event.usage;
      if (event.timings) timings = event.timings;
    }
    if (!done && !finishReason) throw new Error('响应中断：缺少结束标记');
    if (!output.trim()) throw new Error('模型未返回有效回答');
    record.success = true;
  } catch (error) {
    record.error = signal?.aborted ? '请求已取消' : error.name === 'TimeoutError' ? '请求超时' : error.message;
  }
  return { ...record, durationMs: performance.now() - start, ttftMs: first === null ? null : first - start,
    output, reasoning, finishReason, usage, timings,
    outputTokens: Number.isInteger(usage?.completion_tokens) && usage.completion_tokens >= 0 ? usage.completion_tokens : null,
    decodeTps: Number.isFinite(timings?.predicted_per_second) ? timings.predicted_per_second : null };
}

export function summarize(records, elapsedMs) {
  const good = records.filter(r => r.success);
  const percentile = (key, p) => {
    const values = good.map(r => r[key]).filter(Number.isFinite).sort((a,b) => a-b);
    return values.length ? values[Math.max(0, Math.ceil(values.length*p)-1)] : null;
  };
  const tokensKnown = good.length > 0 && good.every(r => r.outputTokens !== null);
  return { total: records.length, succeeded: good.length, failed: records.length-good.length,
    successRate: records.length ? good.length/records.length : null,
    ttftP50: percentile('ttftMs', .5), ttftP95: percentile('ttftMs', .95),
    latencyP95: percentile('durationMs', .95), elapsedMs,
    requestsPerSecond: elapsedMs > 0 ? good.length/(elapsedMs/1000) : 0,
    tokensPerSecond: tokensKnown && elapsedMs > 0 ? good.reduce((s,r)=>s+r.outputTokens,0)/(elapsedMs/1000) : null };
}
