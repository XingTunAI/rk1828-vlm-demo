# 原厂参考与本机实测数据

[首页](../README.md) · [报告索引](../docs/README.md)

- [vendor-reference.csv](vendor-reference.csv)：SDK 1.1.0 Release Notes 第 12–13 页记录的原厂参考值和条件。
- [samples-1.1.0/analysis.json](samples-1.1.0/analysis.json)：语言、视觉各 100 次有效样本的统计。
- [语言逐次数据](samples-1.1.0/llm.csv)、[视觉逐次数据](samples-1.1.0/vision.csv)：保留预热行；语言各组 run=0、视觉 run=1 不参与统计。
- [扩样命令与退出码](samples-1.1.0/status.json)：10 个语言进程与 1 个视觉进程均退出 0；同目录保留工具原始日志及组间状态日志。
- [首轮命令与退出码](retest-1.1.0/record.json)：首轮语言和图文功能验证；同目录保留原始输出。

这些文件直接复制自本地 `results/samples-110-board/` 和 `results/retest-110-board/`，不是重新测试。命令内绝对路径记录当时环境；在新环境复现请按[使用方法](../docs/usage.md)调整。

完整本地原始 `results/` 保留但不进入 Git。旧版业务测试摘要仍在报告索引，相关自建运行代码已移除，需要复查历史实现时查看 Git 历史。

## 12 小时原厂长测

[报告](../docs/sdk-1.1.0-stress-12h.md) · [统计摘要](native-stress-12h/analysis.json) · [资源曲线](native-stress-12h/telemetry.png)

该组仅发布派生统计和曲线。完整日志、逐次遥测与启动参数保留在本地 `results/native-stress-12h-20261012/`，未上传。`analysis.json` 中 npu 为百分比、temp 为℃、mem 为设备 MB、available 为 Host MemAvailable MiB，wallSeconds 包含加载与收尾；均值覆盖全部有效采样。errors 是 SDK 错误标记计数，completedSteps 是日志中的已完成循环数。
