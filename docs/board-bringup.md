# RK1828 VLM 实机接入记录

本文记录项目实际检查结果与后续部署步骤。验证日期：2026-10-10。命令中的路径、设备序列号和端口需按实际环境填写。

## 当前验证进度

| 项目 | 结果 |
| --- | --- |
| ADB 连接 | 已验证，可进入 Host shell |
| Host | RK3588 EVB7 V11，Ubuntu 22.04.5 LTS，aarch64，Linux 5.10.198 |
| 加速器 | `rknn-smi info` 确认 RK1828，Online / Health OK |
| 加速器内存 | 工具报告总计 5120 MB，空闲检查时已用 32 MB |
| PCIe | 已枚举 Rockchip 加速器 `1d87:182a` |
| RKNN3 API / RKLLM3 Server | 1.0.4 / 1.0.4 |
| 固件 | 1.0.401 |
| PCIe 驱动 | 3.3.0 |
| rknn-smi | 1.3.0 |
| 系统服务 | `rknn3`、`rknn-mdns` 均为 active |
| VLM 模型加载、图片问答 | Qwen3-VL-4B 已验证，照片和测试卡两类图片均完成推理 |
| 性能与长稳成绩 | 已完成短性能基线，长稳尚未验证；见 [运行记录](qwen3-vl-board.md) |

以上是本次设备状态快照，不代表其他板卡配置。空闲温度约 28–29°C、NPU 利用率 0%，功率字段为 NA；不能作为负载性能或功耗结论。

## 1. 确认 ADB 与硬件

在开发电脑执行：

```bash
adb devices -l
adb shell
```

多个设备时使用 `adb -s <SERIAL> shell`。若列表为空，检查 USB 数据连接、设备端 ADB 服务及当前使用的 adb 程序；若显示 unauthorized，先在设备上完成授权。

在 Host shell 执行：

```bash
uname -a
cat /etc/os-release
cat /proc/device-tree/model
lspci -nn
rknn-smi info
rknn-smi -v
```

ADB 的 product/model 字段可能是固件配置的通用名称。本次 ADB 曾显示 Nexus_4，但设备树确认 Host 为 RK3588，SMI 确认加速器为 RK1828。以实际硬件查询结果为准。

## 2. 安装并检查运行时

本次使用厂商提供的 `rknn3_rk182x_m2_installer_arm64.tgz`。已经安装且服务正常时跳过安装，只执行验证。先检查包内安装脚本；不同版本行为可能不同。

在安装包所在目录执行：

```bash
INSTALL_DIR="$(mktemp -d ./rknn3-installer.XXXXXX)"
tar -xzf rknn3_rk182x_m2_installer_arm64.tgz -C "$INSTALL_DIR"
cd "$INSTALL_DIR"
sudo ./install.sh
sudo systemctl daemon-reload
sudo systemctl start rknn3 rknn-mdns
source /etc/profile.d/rknn3-env.sh
```

本次检查的安装脚本会复制运行时文件、启用系统服务、设置 `RKNN3_NETWORK_SOCKET_FILE`，随后清理解压目录内的安装文件。原始压缩包位于解压目录外。该脚本没有实现 `--help` 参数解析，不要用 `./install.sh --help` 来查询帮助。

```bash
systemctl is-active rknn3 rknn-mdns
systemctl status rknn3 rknn-mdns --no-pager -l
rknn-smi info
rknn-smi -v
rkllm3-server --help
```

如设备不在线，先查看日志，不要直接重装或刷写固件：

```bash
journalctl -b -u rknn3 -u rknn-mdns --no-pager -n 100
```

## 3. 准备 VLM 模型包

运行时安装包不等于模型包。需要与 RKNN3 API、芯片及转换配置匹配的完整文件：

- 语言模型 `.rknn` 和对应权重（若分离）。
- 视觉编码器 `.rknn` 和对应权重（若分离）。
- 匹配的 tokenizer `.gguf`、embedding `.embed.bin`。
- 图像尺寸、图像标记、上下文上限、量化方式及模型版本说明。

参考 SDK 中 Qwen2.5-VL / Qwen3-VL 示例。优先核对较小模型的完整包，但能否装入 5120 MB 仍须结合权重、视觉编码器、KV cache 和会话数实际验证。不能按参数规模直接承诺可运行。

模型来源与导出说明见 [README 的开发资料](../README.md#开发资料)。SDK Quick Start 提供预转换模型下载入口；下载时核对对应版本，不将最新模型包默认视为兼容 1.0.4。模型权重和厂商文档副本不提交到仓库。

将已核验的模型包放到 Host 的专用模型目录。可从开发电脑传输：

```bash
adb shell mkdir -p /userdata/models
adb push <LOCAL_MODEL_DIRECTORY> /userdata/models/
```

传输前检查可用磁盘空间；传输后比对文件大小和 SHA-256。启动命令参考 [VLM 模型部署](../README.md#vlm-模型部署)，替换真实文件名与模型配置。服务先绑定 `127.0.0.1:8080`，使用单个 session。

## 4. 通过 ADB 接入网页（已验证）

在开发电脑执行以下命令，将本地 18080 转发到 Host 的 8080。`--no-rebind` 避免覆盖已有转发：

```bash
adb forward --no-rebind tcp:18080 tcp:8080
adb forward --list
curl http://127.0.0.1:18080/health
curl http://127.0.0.1:18080/v1/models
node server.js
```

打开 `http://127.0.0.1:8787`，服务地址填写 `http://127.0.0.1:18080/v1`，连接后选择 VLM，上传 JPEG/PNG，发送一个简短问题。

健康检查与模型列表成功不等于图片推理成功。首条问答应验证回答与图片内容相关、流式响应完整结束，并保留服务日志。更换内容明显不同的图片再次验证，再开展性能测试。

转发端口被占用时换一个未使用端口，并同步修改界面地址。USB 重连后检查转发状态。使用完可执行 `adb forward --remove tcp:18080`。

## 5. 首轮测试与记录

1. 单请求验证图片输入、回答内容与结束状态。
2. 单独预热，再执行固定图片、固定提示词、并发 1 的短测试。
3. 保存模型版本、文件哈希、量化方式、图像尺寸、上下文、session 数、输出上限及运行时版本。
4. 检查首内容延迟、总耗时、成功率；仅在服务提供真实 usage/timings 时报告 token 速度。
5. 基线正常后，再进行 30 分钟稳定性测试；按结果扩展至 2/8 小时。

本项目当前固定图片循环可能命中视觉缓存，结果仅代表该负载。可使用 `node scripts/sample-memory.mjs 60` 独立采样加速器和 Host 内存，尚未整合到网页；短测试不能证明长期无泄漏、温控或功耗表现。对外发布报告前检查其中的提示词和服务地址。
