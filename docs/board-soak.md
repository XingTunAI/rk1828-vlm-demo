# 板端测试与资源采样指南

Demo 的素材图集支持事件筛选、勾选、原图预览和一键应用；问答使用第一张，压测按顺序轮换。每批最多 20 张、20 MiB。来源与许可随图展示，候选素材尚未人工标注，不能用于准确率验收。

SDK 1.0.4 在本机接收灰度 JPEG 时曾抛出 `Illegal param: provided image is invalid` 并退出。素材库保留原图，`scripts/prepare-materials.py`（Python 3 + Pillow）生成 RGB JPEG 副本，清单保存转换说明、文件大小及 SHA256。图集和板端测试优先使用副本；接口会拒绝灰度 / CMYK JPEG 和缺少帧头的 JPEG，避免将已知不兼容输入交给 SDK。这不是完整图片解码验证，其他格式仍需实测。

本页介绍工具用法，不代表已通过 4 小时测试。已归档成绩见 [报告索引](README.md#实测报告)，短测参数见 [短测指南](short-test-guide.md)。

## 板端运行

先启动 RKLLM3 模型服务（8080）和本项目控制服务（8787），确认没有其他推理请求。板端需 Node.js 22、rknn-smi，以及读取设备状态的权限。测试默认 Qwen3-VL-4B、单 session、单并发、最多 128 输出 token；从各类素材交错选择最多 20 张图片。

```sh
# 先短测，确认完整轮换正常
node scripts/board-soak.mjs 180
# 再在板端终端或 systemd 服务中运行 4 小时
node scripts/board-soak.mjs 14400
# 使用本项目板端运行时，由 systemd 托管同一项 4 小时测试（二选一）
sudo sh scripts/start-board-soak.sh
```

正式长测应由板端 systemd 托管，避免电脑休眠或 ADB 中断影响负载。模型、控制服务和测试服务都要在板端运行；本工具不负责模型部署。不要在长测期间并行发起交互推理。

## 记录与停止条件

- `results/active-board-soak.json`：运行 ID、配置、所选素材哈希。
- `results/<ID>/report.json`：请求记录、成功失败、TTFT、端到端 P50/P95/P99、请求/s 和输出 token/s。
- `telemetry.jsonl`：约每 5 秒的设备健康、温度、加速器空闲内存、主机可用内存及原始采样。
- `progress.json`：当前进度；`soak-summary.json`：最终汇总与 5 分钟窗口趋势。
- `monitor-error.json` / `monitor-stop.json`：监控异常或主动停止原因（存在时）。

连续 5 次推理失败自动停止；设备状态异常或连续 3 次采样失败也停止。失败不重试，不自动重启模型掩盖故障。到达时限后停止新请求，等待在途请求结束，因此实际时长可略超设定值。运行器完成写报告不等于稳定性通过，必须检查最终 status、failed 与实际时长。

当前 rknn-smi info 会在输出有效设备表格时返回 255；采集器记录退出码并严格检查设备与内存字段，空输出不算有效采样。

2026-10-11 首次预检记录：运行约 62 秒，10 成功 / 5 失败，因灰度 JPEG 触发 SDK 异常而提前停止。后续出现设备通信超时，普通服务重启未恢复；执行硬件复位并重新加载原有固件、模型后恢复 Online / OK。这是人工恢复，不计入后续连续稳定性成绩。

默认配置用于多素材单 session 稳定性基线；脚本也支持短测参数覆盖，但不自动验证最大并发或满内存。固定模型视觉编码尺寸为 384×384，原图尺寸各异；吞吐与输出长度有关。成功响应也不代表复核判断正确。

## 配置与指标

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| 命令末尾秒数 | 14400 | 停止产生新请求的时限，范围 1–28800 秒；排空可超时限 |
| SESSIONS | 1 | 声明实际模型服务 session 数，1–8，不自动修改模型服务 |
| CONCURRENCY | 等于 SESSIONS | 请求并发数，不得超过声明的 session 数 |
| MAX_TOKENS | 128 | 输出 token 上限，1–512 |
| TEST_PROFILE | baseline | baseline / decode / prefill，提示词与用途见短测指南 |
| PREFILL_REPEAT | 6 | prefill 规则重复次数，1–200；需核对实际上下文预算 |

采样汇总还包含 NPU 利用率有效样本数、均值、最大值和达到 90% 的样本数。约每 5 秒采样，可能漏掉峰值，均值包含起止阶段，不是连续时间积分。实际模型启动参数写入 model-command.txt。指标定义以 [Demo 指标口径](capacity-demo.md#指标口径) 为准。

## 查看 NPU 利用率

在板端运行 sudo rknn-smi info。最右列上行 Npu(%) 是利用率，下行 Memory-Usage(MB) 是内存。info -t memory 只显示内存；info -w 可持续观察。使用本运行器时不要另外持续调用 SMI，避免多个采集进程相互干扰。
