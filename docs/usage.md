# RK 原厂程序使用方法

[首页](../README.md) · [程序来源](../official/README.md) · [模型校验](../models/README.md)

以下针对已验证的 SDK 1.1.0、RK3588 Linux aarch64 + RK1828 M.2。命令在板端 Linux shell 执行，电脑用 `adb shell` 进入；多设备时用 `adb -s <SERIAL> shell`。程序不能直接在 Windows 运行。

## 1. 安装与检查

已装好匹配版本时跳过安装。将 `official/local/rknn3_rk182x_m2_installer_arm64.tgz` 传到板端，停止正在运行的推理任务并备份旧 Runtime、固件和服务配置。先检查安装脚本，再执行；安装包应留在解压目录外，安装脚本会清理解压文件。

```sh
mkdir -p /userdata/rknn3-install-1.1.0
# 确保此目录为空；压缩包放在 /userdata 下。
tar -xzf /userdata/rknn3_rk182x_m2_installer_arm64.tgz -C /userdata/rknn3-install-1.1.0
cd /userdata/rknn3-install-1.1.0
sudo ./install.sh
```

按该 SDK 安装要求重启后检查：

```sh
. /etc/profile.d/rknn3-env.sh
systemctl is-active rknn3 rknn-mdns
rknn-smi info
rknn-smi -v
rknn-smi info -t npu_freq
command -v rknn3_vlm_demo rknn3_model_test
```

确认设备 Online / Health OK，Runtime 和设备固件均为 1.1.0。SMI 工具自身版本可能仍是 1.3.0，它不是固件版本。异常时查看 `journalctl -b -u rknn3 -u rknn-mdns --no-pager -n 100`。

## 2. 准备模型与输入

按[模型说明](../models/README.md)传输六个文件并核对 SHA-256。下列命令采用已验证模型目录 `/userdata/models/Qwen3-VL-4B-official-v1.1.0`。

从电脑将本仓库 `examples/` 传到板端 `/userdata/RK1828-demo/examples/`。包含官方示例图片、实际使用的 prompt.ini，以及固定视觉输入 NPY。图片来源记录见 [sources.json](../examples/sources.json)，其中 results 路径是原始来源记录。

`vision-input.npy` 是 demo.jpg 转 RGB、resize 为 384×384 的 UINT8 NHWC 输入；其预处理不等同于图文程序的 RGA 路径，视觉测试耗时不包含图片解码与 resize。

## 3. 图文推理

以下命令来自首轮成功记录，调整了输入文件目录。`-cl 1 -vl 3 -ll 3` 是当次图文验证配置。修改图片或问题时编辑 `prompt.ini` 的 prompt，保留模型对应的图像标记和模板。

```sh
rknn3_vlm_demo \
  -vm \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/vision_Qwen3-VL-4B.rknn \
  -vw \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/vision_Qwen3-VL-4B.weight \
  -lm \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/llm_Qwen3-VL-4B.rknn \
  -lw \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/llm_Qwen3-VL-4B.weight \
  -tk \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/Qwen3-VL-4B.tokenizer.gguf \
  -em \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/Qwen3-VL-4B.embed.bin \
  -vc \
  0xff \
  -lc \
  0xff \
  -im \
  /userdata/RK1828-demo/examples/demo.jpg \
  -pi \
  /userdata/RK1828-demo/examples/prompt.ini \
  -cl \
  1 \
  -vl \
  3 \
  -ll \
  3
```

以真实输出和退出码判断运行成功；首次模型加载约需数十秒。本次测试得到与图片内容相关的描述，但未进行人工标注准确率评分。

## 4. 独立语言性能

官方工具源码在 Model Zoo 的 `tools/rknn3_llm_test`。本地 [原厂程序目录](../official/README.md)保留了本次源码与依赖快照 `eval-110.tgz`；按匹配 SDK 的构建说明编译 aarch64 `eval-perf`，本次使用 `-O3 -DNDEBUG`。

以下是当时实际跑通的工具绝对路径；新环境需替换为编译产物位置：

```sh
/userdata/rknn3-upgrade-1.1.0/eval/eval-perf \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/llm_Qwen3-VL-4B.rknn \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/llm_Qwen3-VL-4B.weight \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/Qwen3-VL-4B.tokenizer.gguf \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/Qwen3-VL-4B.embed.bin \
  1024 \
  128 \
  128 \
  0xff
```

参数依次为语言模型、权重、tokenizer、embedding、上下文 1024、输入 128、输出 128、核心掩码 0xff。原始工具运行 3 轮，首次作为预热；首个输出 token 计入 Prefill，Generate 统计 127 token。

扩样仅将源码 `test_num` 从 3 改为 11，编译为 `eval-samples`；独立启动 10 次，各丢弃首轮，得到 100 个有效样本。完整历史命令见 [status.json](../data/samples-1.1.0/status.json)。这项源码修改属于我们的采样设置。

## 5. 独立视觉性能

以下为扩样实际参数，输入路径调整为当前 examples 目录；空字符串参数不能省略：

```sh
rknn3_model_test \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/vision_Qwen3-VL-4B.rknn \
  /userdata/models/Qwen3-VL-4B-official-v1.1.0/vision_Qwen3-VL-4B.weight \
  0xff \
  /userdata/RK1828-demo/examples/vision-input.npy \
  '' \
  0 \
  101 \
  0 \
  path \
  none \
  1
```

共 101 次，剔除第一次，保留 100 次。开启输出 checksum 检查；计时包含输入同步、模型运行、输出同步。相同图片重复运行，不是 100 张不同图片。

## 6. 对比条件与数据

为了复现统计，应记录 CPU governor、NPU 频率和工作模式，避免其他推理任务争用设备。本次 CPU 临时设为 performance，测试结束恢复原来的 schedutil；NPU 为 PERFORMANCE / 850MHz / 0xff。需要调整 CPU 时先保存各 policy 原值，测试后恢复。

[原厂对照](native-comparison.md)保留原厂值及差异；[实测数据](../data/README.md)包含复现命令、退出码、精选 CSV 与统计摘要；原始日志仅保留本地。本次整理没有重新运行硬件测试。新版已完成[固定图原生 12 小时长测](sdk-1.1.0-stress-12h.md)；并发、完整业务图片吞吐和准确率仍未验证。
