# RK 原厂程序

[首页](../README.md) · [使用方法](../docs/usage.md)

本次验证使用 SDK / Runtime / 固件 **1.1.0**，目标为 RK3588 Linux aarch64 + RK1828 M.2。

| 程序 | 用途 | 来源 |
| --- | --- | --- |
| `rknn3_vlm_demo` | 图文推理、循环测试 | SDK 1.1.0 安装包 |
| `rknn3_model_test` | 独立视觉模型性能 | SDK 1.1.0 安装包 |
| `rknn-smi` | 设备状态、频率、版本 | SDK 安装包 |
| `eval-perf` | 独立语言性能 | 官方 Model Zoo `tools/rknn3_llm_test` 源码编译 |

官方入口：[Model Zoo](https://github.com/airockchip/rknn3-model-zoo)、[Qwen3-VL 示例](https://github.com/airockchip/rknn3-model-zoo/tree/main/examples/Qwen3_VL)。本次运行的是 SDK 自带图文二进制，不宣称它与公开示例源码完全相同。

本地 `local/` 已保留：

- `rknn3_rk182x_m2_installer_arm64.tgz`：本次使用的 1.1.0 安装包。
- `eval-110.tgz`：本次语言性能工具的源码、头文件及 tokenizer 静态库快照。
- `00_RKNN3_SDK_Release_Notes_V1.1.0.pdf`：原厂性能数据来源，第 12 页为性能表，第 13 页为测试条件。

上述文件不纳入 Git；大小及 SHA-256 见 [manifest.json](manifest.json)。新克隆仓库需从 RK SDK 分发渠道获取匹配版本，文件名相同不代表版本相同。不要直接用最新版替代本次测试版本。

模型另行准备，见[模型说明](../models/README.md)。SDK 厂商文档的其他本地副本仍在 `docs/sdk-reference/`。
