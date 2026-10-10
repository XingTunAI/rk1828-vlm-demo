# RK1828 VLM Demo

面向 RK1828 的视觉语言模型（VLM）演示、性能与稳定性测试工具。上传图片并提问，观察模型对场景、文字和对象关系的理解，以及持续负载下的响应表现。

| 核心方向 | 内容 |
| --- | --- |
| Demo | 图片问答、场景描述、图片文字读取、视觉结构化输出 |
| 性能 | 图文请求首内容延迟、端到端耗时、生成速度与并发吞吐 |
| 稳定性 | 固定图文负载循环执行、失败记录、超时处理与结果保存 |

> 当前为 v0.1：已实现本地界面、图文流式接口适配、HTTP 压测和报告保存。自动化测试使用独立测试服务，尚未完成 RK1828 实机 VLM 推理验证，无板端性能成绩。

实机进度：已通过 ADB 确认 RK3588 Host 与 RK1828 加速器，设备 Online / Health OK，RKNN3 API 与 RKLLM3 Server 均为 1.0.4；VLM 模型加载和图文推理尚待验证。安装、检查与接入步骤见 [RK1828 VLM 实机接入记录](docs/board-bringup.md)。

## 快速启动

需要 Node.js 22 或更新版本，无第三方运行依赖。

```bash
git clone git@github.com:XingTunAI/rk1828-vlm-demo.git
cd rk1828-vlm-demo
node server.js
```

打开 `http://127.0.0.1:8787`：

1. 输入已部署 VLM 的 RKLLM3 服务地址，以 `/v1` 结尾。
2. 点击“连接检查”，选择模型。服务在线不代表模型支持图片，需确认部署的是 VLM。
3. 选择 JPEG 或 PNG 图片，最大 4 MiB。
4. 输入问题或选择场景理解、图片文字、视觉抽取提示词。
5. 切换至性能或稳定性页面，配置负载并开始测试。

控制服务默认仅监听本机。`PORT` 可修改端口，`RESULTS_DIR` 可修改结果目录。图片通过控制服务发送至所配置的推理服务，不上传到 GitHub。

```bash
# 自动化测试
node --test
```

## 当前功能与限制

- 单图多轮问答：首轮携带图片，后续请求携带完整会话；更换图片会清空对话。
- 图片原样发送，浏览器显示原图尺寸和大小。模型端缩放、裁剪与视觉 token 数由部署配置决定。
- 固定图文压测：每个请求携带同一张图片和提示词，适合重复负载基线。
- 并发工作线程使用独立 `id_slot`，对话与压测互斥。
- 稳定性测试最多 8 小时或 100000 次请求，以先达到者为准。
- 停止或到达时限后停止发起新请求，在途请求完成或超时后结束。
- 不自动预热、不自动重试。稳态测试前可单独预热；原始失败始终保留。
- 输出 token 使用服务端 usage；Decode 速度使用 `timings.predicted_per_second`。缺失时显示“—”，不按分块数估算。
- 报告保存图片 SHA-256、格式与字节数，不保存图片本体、API Key 或生成回答。报告包含提示词和服务地址，分享前应检查；复现时需自行保留原图及模型配置。
- 关闭浏览器不停止任务；关闭控制服务会中断任务。逐请求 JSONL 保留，未完成报告不会进入历史列表。
- 暂不支持视频、多图、摄像头、自动模型部署、设备遥测、原生视觉编码耗时、CSV/HTML 导出或自动故障恢复。

## 技术结构

```text
浏览器：图片预览 + 问答 / 性能 / 稳定性 / 报告
  └─ Node.js 控制服务
       ├─ 图文请求适配 ── Host 上的 rkllm3-server
       │                      └─ Vision 编码器 + 语言生成模型 ── RK1828
       ├─ 固定并发测试与停止控制
       └─ 配置、逐请求 JSONL、JSON 报告
```

RK1828 是协处理器，Host 负责模型加载和服务调度。采用 RK182x SDK 的 RKNN3 / RKLLM3 工具链。`rkllm3-server` 是 SDK 中支持 VLM 的实际服务程序名称。

```text
server.js             控制服务、任务调度、报告保存
lib/inference.js      流式响应解析与指标统计
lib/vision.js         图片校验、图文消息和图片指纹
public/               VLM 演示与测试界面
test/                 协议、图片验证和集成测试
results/              本地结果，不提交到 Git
```

## VLM 模型部署

准备与 SDK、Host 架构和板卡内存匹配的 VLM 模型包。可参考 SDK 的 Qwen2.5-VL、Qwen3-VL、MiniCPM-V 示例，具体模型规模及输入配置以实际适配结果为准。

典型模型包包含语言生成与视觉编码两部分的 `.rknn`、可选独立 `.weight`，以及匹配的 `.tokenizer.gguf`、`.embed.bin`。还需核对图像标记、输入尺寸、上下文及量化配置。这里 `.gguf` 是 tokenizer 文件；纯文本模型包不具备视觉编码能力。

以下是参考 SDK 的 Qwen2.5-VL 启动模板，**未在目标设备验证**。在实际 Host 上运行，文件名、权重拆分方式和输入尺寸必须与模型转换配置一致：

```bash
rknn-smi info
rknn-smi info -l
rknn-smi -v

cd /userdata/models/Qwen2.5-VL-3B
rkllm3-server \
  -m Qwen2.5-VL-3B-llm.rknn \
  --weight Qwen2.5-VL-3B-llm.weight \
  --model2 Qwen2.5-VL-3B-vision.rknn \
  --weight2 Qwen2.5-VL-3B-vision.weight \
  --vocab Qwen2.5-VL-3B-llm.tokenizer.gguf \
  --embed Qwen2.5-VL-3B-llm.embed.bin \
  --img-start '<|vision_start|>' --img-end '<|vision_end|>' \
  --img-content '<|image_pad|>' --img-width 392 --img-height 392 \
  --alias demo-vlm --host 127.0.0.1 --port 8080 -c 0
```

图文请求通过 `/v1/chat/completions` 发送：

```json
{
  "model": "demo-vlm",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<图片数据>"}},
      {"type": "text", "text": "请描述图片中的主要对象。"}
    ]
  }],
  "stream": true,
  "n_predict": 256,
  "cache_prompt": false,
  "id_slot": 0
}
```

先验证 `/health`、`/v1/models` 和真实图片问答。并发前在服务端配置 `--n-session`；界面中的 session 数用于客户端校验，不会修改服务端。多会话 VLM 的支持范围和资源占用需单独验证。

## 性能测试口径

| 指标 | 含义 |
| --- | --- |
| 首内容延迟 | 控制服务发起请求至收到首个非空生成内容，可能包含图片传输、视觉处理、Prefill、排队和网络时间 |
| 端到端耗时 | 控制服务发起请求至完整响应结束，不包含浏览器选图和预览耗时 |
| Decode tokens/s | 服务端报告的生成速度，不能作为完整视觉推理吞吐 |
| P50 / P95 | 成功请求的延迟分位数，附有效样本量 |
| 请求吞吐 | 成功请求数除以测试窗口耗时 |
| 输出 token 吞吐 | 所有成功请求都有可靠 token 数时才统计 |
| 成功率 | 成功数除以已结束请求数；空回答、流中断和超时为失败 |

视觉编码耗时、纯 Prefill 耗时及设备温度/功耗尚未独立采集。HTTP 首内容延迟不能标成视觉编码耗时或纯 NPU 推理耗时。流式事件数不等于 token 数。

当前可手动改变图片、提示词长度、输出上限和并发数，分别运行并导出报告。对比时保持模型、量化、预处理、缓存策略和性能模式一致；原图分辨率变化不一定意味着模型输入分辨率变化。

建议测试顺序：

1. 单图短问题，验证图像理解。
2. 同一图文输入并发 1，建立基线。
3. 改变提示词长度或输出预算，记录延迟变化。
4. 配置独立 session 后递增并发，观察吞吐与失败。
5. 更换不同内容或尺寸的图片，单独执行相同配置；自动图片集轮换作为后续扩展。

图像 token 和文本 token 共同占用上下文资源，不能仅按文字长度估算剩余窗口。

## 稳定性测试

使用固定图片和提示词持续发起请求，先运行 30 分钟，再扩展至 2 小时和 8 小时。记录成功率、逐请求延迟、耗时、结束原因和错误。

重复同一图片可能受视觉缓存影响，本期结果代表固定图片工作负载。异图轮换、显式视觉缓存控制和视觉模型反复加载需后续实现，不能据此宣称覆盖全部 VLM 稳定性场景。

停止操作不重置设备或重启模型服务。自然故障与故障注入应分开统计。资源趋势、内存增长分析和恢复耗时需后续采集与恢复流程支持。

## 后续计划

- [ ] RK1828 实机验证：完整 VLM 模型包、图像尺寸、上下文和 session 配置。
- [ ] 图片集轮换、视觉 token 档位和混合图文负载。
- [ ] 视觉编码、Prefill、Decode 分阶段性能采集。
- [ ] `rknn-smi` 单一采集器、资源曲线和长稳性能趋势。
- [ ] 异常恢复验证和 CSV/HTML 报告。

YOLO 检测后转文字交给语言模型属于组合应用，本项目主线是 VLM 直接接收图片。

## 开发资料

SDK、模型权重和厂商文档需自行获取，本仓库不包含本地参考资料副本。

| 资料 | SDK 内路径 |
| --- | --- |
| RK182x Quick Start | `docs/Release/Rockchip_RK1820_RK1828_AI_SDK_Quick_Start_CN.pdf` |
| RKLLM3 Server 指南 | `docs/Examples/Rockchip_User_Guide_RKNN_RKLLM3_Server_DEMO_CN.pdf` |
| 图文请求示例 | `rknn/rknn3-runtime/rkllm3-server/test_multimodal.py` |
| 服务参数说明 | `rknn/rknn3-runtime/rkllm3-server/README_CN.md` |
| VLM 示例 | `rknn/rknn3-model-zoo/examples/Qwen2_5_VL/`、`rknn/rknn3-model-zoo/examples/Qwen3_VL/` |
| 设备监控 | `docs/Tools/Rockchip_User_Guide_RKNN-SMI_Tool_CN.pdf` |

官方工具链：[RKNN3 Toolkit](https://github.com/airockchip/rknn3-toolkit)、[RKNN3 Model Zoo](https://github.com/airockchip/rknn3-model-zoo)。
