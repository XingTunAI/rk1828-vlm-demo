# 官方 Qwen3-VL-4B 模型

[首页](../README.md) · [运行方法](../docs/usage.md)

使用 Rockchip 官方 **v1.1.0 Qwen3-VL-4B** 包，配套 Runtime / 固件 1.1.0。模型上下文上限 1024，position 上限 8192，视觉输入 384×384。历史 Firefly 模型与此包不同。

需要以下六个文件：

- `llm_Qwen3-VL-4B.rknn`
- `llm_Qwen3-VL-4B.weight`
- `Qwen3-VL-4B.tokenizer.gguf`
- `Qwen3-VL-4B.embed.bin`
- `vision_Qwen3-VL-4B.rknn`
- `vision_Qwen3-VL-4B.weight`

本次板端路径：`/userdata/models/Qwen3-VL-4B-official-v1.1.0/`，来自已保存运行记录，并非当前在线检查。完整文件合计约 3.39 GB，权重不进入 Git；本次整理未在电脑已检查的下载目录中找到完整官方包。

获取入口：[官方 Model Zoo](https://github.com/airockchip/rknn3-model-zoo) 的模型下载说明及配套 SDK Quick Start。选择 v1.1.0 Qwen3-VL-4B，下载后用本仓库的 [manifest.json](manifest.json) 核对大小与 SHA-256；不要与 Firefly 转换包混用。

在 Linux 模型目录中执行（替换仓库绝对路径）：

```sh
sha256sum -c /path/to/RK1828-demo/models/SHA256SUMS
```

六项均为 OK 后再运行。电脑传输到板端可用：

```sh
adb shell mkdir -p /userdata/models/Qwen3-VL-4B-official-v1.1.0
adb push /path/to/Qwen3-VL-4B-official-v1.1.0/. /userdata/models/Qwen3-VL-4B-official-v1.1.0/
```

校验清单取自本次实际测试记录，不能据此断言与原厂性能表使用的模型二进制完全相同。
