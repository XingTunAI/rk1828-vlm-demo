# 并发与 NPU 短测操作指南

[文档导航](README.md)

> 历史复现指南：以下长提示词、上下文及启动命令来自 1.0.4 / Firefly 配置，不直接适用官方 1.1.0 模型（max_ctx_len=1024）。新版优先按[业务图片方案](test-scope-correction.md)验证。

> 2026-10-11 口径更正：长提示词高利用率不代表图片/视频复核业务能力。历史数据保留，后续优先增加短提示词图片任务。见[更正记录与新方案](test-scope-correction.md)。

两类测试分别执行，不使用长时间测试：

1. 并发扫描：图片集、提示词、128 token 输出上限、768 上下文不变。服务使用 `SESSIONS=2 sh scripts/start-qwen3-vl-board.sh`，测试使用 `SESSIONS=2 CONCURRENCY=2 node scripts/board-soak.mjs 90`。各请求独占不同 slot；出现设备异常则停止升档。
2. NPU 负载探索：恢复单 session / 单并发，分别运行长输出与较长输入，避免把 session 变化混入负载比较。

```sh
TEST_PROFILE=decode MAX_TOKENS=512 node scripts/board-soak.mjs 60
TEST_PROFILE=prefill MAX_TOKENS=32 node scripts/board-soak.mjs 60
```

`MAX_TOKENS` 是上限，不保证生成到上限。实际 token 数以响应记录为准。两种 profile 提示词不同，吞吐数值不能直接当作相同业务的加速倍数。较长输入规则是为了增加 prefill 工作量，不是准确率评估。

`soak-summary.json` 记录 NPU 利用率采样均值、最大值和达到 90% 的采样次数。约 5 秒一次，包含起止阶段，不能证明瞬时峰值或硬件理论极限。没有有效样本时不能宣称利用率为零。CLI 的 `SESSIONS` 必须和实际模型服务一致，它不会自动更改模型服务。

## 高负载配置扩展

`PREFILL_REPEAT` 可控制规则重复次数（1–400，默认 6），操作者必须按实际模型上下文检查 token 预算。测试程序保存模型启动命令，便于核对真实上下文和 session。

第三档负载短测使用单 session、上下文 2048、`PREFILL_REPEAT=36`、输出上限 32 token，持续输入 60 秒。服务启动命令需先设置 `CONTEXT_SIZE=2048`，再执行：

```sh
TEST_PROFILE=prefill PREFILL_REPEAT=36 MAX_TOKENS=32 node scripts/board-soak.mjs 60
```

此档改变了上下文及输入量，与 768 上下文的日常复核性能分别报告，不能混为同一业务基线。测试结束恢复默认单 session / 768 上下文服务。

第四档负载短测进一步使用上下文 8192、PREFILL_REPEAT=160、输出上限 32，仍只持续输入 60 秒。该人工构造的大输入用于探索计算利用率，不代表日常复核提示词。


实测成绩与异常见 [短测报告](short-load-tests.md)。当时 1.0.4 模型与 SDK 组合的两 session 初测失败，以下并发命令是复现方法，不是已验证稳定配置。不要同时运行多个负载或多个 SMI 采集器。

改变 CONTEXT_SIZE 或 SESSIONS 前，先结束负载、停止现有模型服务，再以新配置启动；不要在同一端口重复启动模型。完成后恢复默认配置，做少量真实图片请求确认恢复。
