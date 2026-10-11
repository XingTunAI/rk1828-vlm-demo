"""Render a local benchmark report. Requires matplotlib; raw results remain local."""
import csv
import json
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

folder = Path(sys.argv[1])
r = json.loads((folder / 'report.json').read_text(encoding='utf-8-sig'))
s = json.loads((folder / 'soak-summary.json').read_text(encoding='utf-8-sig'))
t = [json.loads(x) for x in (folder / 'telemetry.jsonl').read_text(encoding='utf-8-sig').splitlines() if x.strip()]
start = datetime.fromisoformat(r['startedAt'])
elapsed = lambda stamp: (datetime.fromisoformat(stamp) - start).total_seconds()
valid = [x for x in t if not x.get('error') and isinstance(x.get('npuPercent'), (int, float))]
good = [x for x in r['records'] if x['success']]
def percentile(values, p):
    import math
    values = sorted(values)
    return values[max(0, math.ceil(len(values) * p) - 1)] if values else None
npu = [x['npuPercent'] for x in valid]
metrics = {'npuSampleCount': len(npu), 'npuSampleP50': percentile(npu,.5), 'npuSampleP95': percentile(npu,.95), 'npuSampleMax': max(npu) if npu else None, 'fractionSamplesAtLeast90': sum(x>=90 for x in npu)/len(npu) if npu else None, 'fractionSamplesAtLeast95': sum(x>=95 for x in npu)/len(npu) if npu else None, 'telemetryErrors': sum(bool(x.get('error')) for x in t)}
for name, token, duration in [('prefill','prompt_n','prompt_ms'),('decode','predicted_n','predicted_ms')]:
    known = [x['timings'] for x in good if x.get('timings') and x['timings'].get(duration,0)>0]
    metrics[name+'AggregateTokensPerSecond'] = sum(x[token] for x in known)*1000/sum(x[duration] for x in known) if known else None
metrics['ttftP99Ms'] = percentile([x['ttftMs'] for x in good if x.get('ttftMs') is not None], .99)
(folder/'analysis.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
fields=['timestamp','npuPercent','temperatureC','freeMB','hostAvailableKiB','deviceStatus','health','error']
with (folder/'telemetry.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fields,extrasaction='ignore');w.writeheader();w.writerows(t)
plt.rcParams.update({'font.size':10,'axes.grid':True,'grid.alpha':.2})
fig,ax=plt.subplots(4,1,figsize=(12,10),sharex=True,layout='constrained')
x=[elapsed(a['timestamp']) for a in valid]
ax[0].plot(x,npu,color='#1677be',lw=1.4);ax[0].axhline(90,color='#d97706',ls='--',label='90%');ax[0].set(ylabel='NPU (%)',ylim=(0,105));ax[0].legend(loc='lower right')
ax[1].plot(x,[a.get('temperatureC',float('nan')) for a in valid],color='#c4473d');ax[1].set_ylabel('Temperature (C)')
rx=[elapsed(a['startedAt'])+a['durationMs']/1000 for a in good]
ax[2].plot(rx,[a['durationMs']/1000 for a in good],'o-',label='HTTP response');ax[2].plot(rx,[a['ttftMs']/1000 if a.get('ttftMs') is not None else float('nan') for a in good],'s--',label='First content');ax[2].set_ylabel('Latency (s)');ax[2].legend()
ax[3].plot(x,[a['totalMB']-a['freeMB'] for a in valid],label='Accelerator used');ax[3].plot(x,[a['hostAvailableKiB']/1024 for a in valid],label='Host available (MiB)');ax[3].set(ylabel='Memory',xlabel='Seconds since run start');ax[3].legend()
for a in ax:
    a.set_xlim(0,max(r['summary']['elapsedMs']/1000,max(x,default=0)))
    for row in t:
        if row.get('error'):a.axvline(elapsed(row['timestamp']),color='red',alpha=.4)
fig.suptitle('RK1828 VLM high-load benchmark\n'+r['id'])
fig.savefig(folder/'timeline.png',dpi=150);plt.close(fig)
q=r['summary']; command=(folder/'model-command.txt').read_text(encoding='utf-8').strip()
text=f'''# NPU 高负载测试报告

运行 ID：{r['id']}。状态：{r['status']}。开始时间（北京时间）：{start.astimezone(timezone(timedelta(hours=8))).isoformat()}。

| 指标 | 实测 |
| --- | --- |
| 实际时长 | {q['elapsedMs']/1000:.2f} 秒 |
| 成功 / 失败 | {q['succeeded']} / {q['failed']} |
| 请求 / 输出吞吐 | {q['requestsPerSecond']:.4f} 请求/秒；{q['tokensPerSecond']:.4f} token/秒 |
| 首内容 P50 / P95 | {q['ttftP50']/1000:.3f} / {q['ttftP95']/1000:.3f} 秒 |
| 端到端 P50 / P95 / P99 | {q['endToEndP50']/1000:.3f} / {q['endToEndP95']/1000:.3f} / {q['endToEndP99']/1000:.3f} 秒 |
| NPU 均值 / P50 / P95 / 最大 | {sum(npu)/len(npu):.2f}% / {metrics['npuSampleP50']}% / {metrics['npuSampleP95']}% / {metrics['npuSampleMax']}% |
| NPU >=90% / >=95% 样本占比 | {metrics['fractionSamplesAtLeast90']:.1%} / {metrics['fractionSamplesAtLeast95']:.1%} |
| 温度最高 | {s['telemetry']['maxTemperatureC']}℃ |
| 遥测失败 | {metrics['telemetryErrors']} |

![时间曲线](timeline.png)

曲线按实际采样时间绘制；连线不代表采样间连续测量。样本占比不是精确时间占比，包含起止阶段。内存两条曲线分别是加速器已用 MB 与主机可用 MiB，不能相加。延迟只统计成功请求，图中位置为完成时间。

## 模型与测试配置

```text
{command}
```

```json
{json.dumps({'config':r['config'],'options':{k:v for k,v in r['options'].items() if k not in ('prompt','images','image')}},ensure_ascii=False,indent=2)}
```

完整提示词、图片列表与哈希保存在 [report.json](report.json) 和 [config.json](config.json)，正文仅显示简要配置。模型文件身份和版本见同目录 environment.txt、model-sha256.txt（若已采集）。原始请求见 requests.jsonl，原始采样见 telemetry.jsonl，表格见 telemetry.csv，阶段速度和补充分位数见 analysis.json。

人工长输入用于提高 NPU 计算占比，不代表常规图片复核工作量。请求成功不等于回答准确；token 上限导致截断不作为传输失败。全部原始结果仅保存本地。
'''
(folder/'summary.md').write_text(text,encoding='utf-8')
print(json.dumps(metrics,indent=2))
