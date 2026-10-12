# Rockchip 原厂性能对照

[文档导航](README.md) · [完整扩样报告](sdk-1.1.0-samples.md) · [排查历史](native-comparison-history.md)

更新于 2026-10-12。当前以 **SDK 1.1.0 官方 Qwen3-VL-4B** 的重复性测试作为原生性能结论。旧版约 40 token/s 的结果使用不同模型产物和软件栈，不能据此判断当前设备只有原厂一半性能。

## 最新对比

原厂来源：SDK `00_RKNN3_SDK_Release_Notes_V1.1.0.pdf` 第 12 页性能表、第 13 页测试条件。厂商文档副本仅在本地保存。

| 指标 | Rockchip 参考 | 本机均值（各 100 次有效样本） | 相对差异 |
| --- | ---: | ---: | ---: |
| 独立 LLM Decode token/s | 89.95 | 85.740 | -4.68% |
| 独立 LLM TTFT ms | 106.92 | 119.993 | +12.23% |
| Vision ms | 108.23 | 114.052 | +5.38% |

吞吐越高越好，耗时越低越好。视觉参考的完整计时边界未披露，本机包含输入同步、模型运行和输出同步，不含解码、resize 或 HTTP 请求。以上不能换算完整图片复核吞吐。

## 条件对齐程度

| 条件 | 本机 | 原厂 / 对齐状态 |
| --- | --- | --- |
| 主控与连接 | RK3588、PCIe | 主控和接口类型一致；参考未披露完整链路配置 |
| CPU governor | performance | 一致 |
| Runtime / 固件 | 1.1.0 / 1.1.0 | 对照 SDK 1.1.0 表 |
| 模型 | 官方 v1.1.0 Qwen3-VL-4B，六文件校验 | 参考未给哈希，不能证明二进制完全一致 |
| NPU | M.2，850MHz，PERFORMANCE，0xff | 原厂 1GHz，频率不同 |
| 语言输入 / 输出 | 128 / 128 token，剔除各组首次 | 与公开方法一致；首输出计入 Prefill，Generate 计 127 |
| 模型上下文 | 1024 | 参考未披露完整配置 |
| 视觉输入 | 384×384，固定图片转 RGB NPY | 分辨率一致；完整预处理与计时边界未完全对齐 |

因此是有条件的参考对比，不是完全同条件复现。M.2 的受支持最高档为 850MHz，不能线性换算 1GHz 成绩。模型与软件栈同时更新，无法把改善归因于某一个改动。

## 样本与验证范围

语言共完成 110 次、视觉 101 次，排除预热后各统计 100 次；11 个进程均正常退出，视觉 checksum 检查未报告不一致。分位数和逐阶段耗时见[扩样报告](sdk-1.1.0-samples.md)，图文功能、模型信息和原生计时说明见[首轮复测](sdk-1.1.0-retest.md)。

这验证固定输入下的短时重复性。1.1.0 的图片轮换业务吞吐、并发能力、连续 NPU 曲线、高负载长稳和准确率仍须单独验证。旧版约 1.14 张/秒见[历史图片基线](image-review-test.md)。

## SDK 性能与老化工具

- 独立语言性能：官方 Model Zoo 的 `tools/rknn3_llm_test`，方法见其 README；扩样仅修改重复次数，保留输入输出与预热口径。
- 独立视觉：`rknn3_model_test`；本轮逐次记录输入同步、run、输出同步。
- 图文及老化：SDK 安装包中的 `rknn3_vlm_demo`；相关源码位于 `package/rknn3-test/rknn3_stress_test`。`-cl` 为循环次数，`-tl` 为小时数，`-vl/-ll` 为阶段循环次数，实际参数以匹配版本的 `--help` 为准。
- 历史业务负载结果保留在报告索引；自建板端运行器已移除。

官方资料入口：[Model Zoo](https://github.com/airockchip/rknn3-model-zoo)、[Qwen3-VL 示例](https://github.com/airockchip/rknn3-model-zoo/tree/main/examples/Qwen3_VL)。

## 历史记录

旧版原厂表、CPU 策略与亲和性排查、官方模型在旧 Runtime 上加载失败、升级首次结果统一保存在[排查历史](native-comparison-history.md)。原始 `results/` 不上传 GitHub。

本次整理已将新版精选逐次 CSV、原生日志和命令记录纳入 [data/](../data/README.md)；完整 results、模型权重和 SDK 安装包仍仅在本地保存。
