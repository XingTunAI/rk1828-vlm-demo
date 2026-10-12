# Qwen3-VL-4B 板端运行记录

[文档导航](README.md)

> 历史配置：本文命令对应 Firefly 转换包及 1.0.4，不是官方 1.1.0 包的直接启动教程。新版兼容性见[版本与部署说明](deployment.md)。

验证日期：2026-10-10。推理在 RK3588 Host + RK1828 上运行，本地电脑运行网页控制服务，经 ADB 转发访问板端。

## 模型与环境

- 模型：[Firefly Qwen3-VL-4B RK1828 预转换包](https://huggingface.co/t-firefly/qwen3-vl-4b-rknn3-rk1828)。
- 固定版本：`8246e2a89e9e13a6db511c1406edc3bf2e36bbe5`。
- 发布配置：W4A16，语言模型文件标注 rkkv4 / 32768；本次服务上下文仅设为 768，未验证 32768 上下文。
- 视觉模型：pruned-384，图像输入 384 × 384。
- RKNN3 API / RKLLM3 Server：1.0.4；固件 1.0.401；PCIe 驱动 3.3.0。
- 模型头显示编译器 1.0.4；下载后已按发布元数据逐一核验 6 个核心文件的大小和 SHA256。

本次直接在板端下载并运行已转换模型，没有在板端完成模型转换或编译。完整模型文件约 3.58 GB，不提交到 Git。

## 准备文件

从上述固定版本下载下列文件到板端 `/userdata/models/Qwen3-VL-4B`。网络需要时可将下载域名替换为 `hf-mirror.com`，仍须对照固定版本的发布哈希校验：

| 发布文件名 | 本地文件名 |
| --- | --- |
| llm_Qwen3-VL-4B-rkkv4-32768.rk1828.rknn | llm.rknn |
| llm_Qwen3-VL-4B-rkkv4-32768.rk1828.weight | 保持原名 |
| vision_Qwen3-VL-4B-pruned-384.rk1828.rknn | 保持原名 |
| vision_Qwen3-VL-4B-pruned-384.rk1828.weight | 保持原名 |
| Qwen3-VL-4B.embed.bin | 保持原名 |
| Qwen3-VL-4B.tokenizer.gguf | 保持原名 |

不要混用其他版本的权重、tokenizer 或 embedding。发布目录的 `model.toml`、README 和文件元数据应随部署保留。

## 启动

在开发电脑上传本仓库的启动脚本：

```bash
adb push scripts/start-qwen3-vl-board.sh /userdata/models/Qwen3-VL-4B/
adb shell
```

进入板端后执行（保持终端运行，可在另一个终端检查日志）：

```bash
sh /userdata/models/Qwen3-VL-4B/start-qwen3-vl-board.sh \
  > /userdata/models/Qwen3-VL-4B/server.log 2>&1
```

脚本默认一个 session、上下文 768、384 × 384 图像及 Qwen3-VL 图像标记。可传入其他模型目录作为第一个参数。服务只绑定 `127.0.0.1:8080`。

开发电脑另开终端：

```bash
adb forward --no-rebind tcp:18080 tcp:8080
curl http://127.0.0.1:18080/health
curl http://127.0.0.1:18080/v1/models
node server.js
```

打开 `http://127.0.0.1:8787`，填写服务地址 `http://127.0.0.1:18080/v1`，连接并选择 `qwen3-vl-4b`。上传图片后即可问答、运行性能测试。已有同一转发时无需重复创建。

## 首轮实测

两张不同图片均通过真实模型推理：宇航员照片回答包含人物、瓶子、月球与地球背景；电视测试卡回答识别为彩条测试图。照片中的饮料被误判为香槟，属于语义错误，不能把请求成功等同于回答准确。测试卡输出达到 96 token 上限，以 `length` 结束。

首次照片请求（非严格冷启动）：首内容延迟 1268 ms，总耗时 2507 ms，输出 47 token，服务报告 decode 38.24 token/s。

随后通过网页控制服务执行固定照片、固定提示词的 20 次单并发测试。输出上限 96 token，超时 120 秒，之前已有两次图片推理，不计入这 20 次。

| 指标 | 结果 |
| --- | --- |
| 请求成功 | 20 / 20 |
| 总耗时 | 33.13 秒 |
| 首内容延迟 P50 / P95 | 387 / 403 ms |
| 端到端耗时 P95 | 1827 ms |
| 请求吞吐 | 0.604 请求/秒 |
| 输出吞吐（含请求全部耗时） | 28.37 token/秒 |
| 加速器内存采样 | 已用约 4292.32 / 5120 MB，约 84% |
| 测试后设备状态 | Online / Health OK，35°C |

固定图片重复请求可能命中视觉缓存，该结果仅代表此负载。提示词为“请简短描述图片中的人物、手中物品和背景。”；图片 SHA256：`58c5c9898c5359bcf53797711e3d954c8ef529e141cb012ffc433376933839e7`。

本地逐请求报告保存在 `results/1e11047e-7754-4241-af6b-f9a7efc9b5ab/`，内存原始采样保存在 `results/memory-1791629376337/`；这些目录默认不提交。独立采样命令为 `node scripts/sample-memory.mjs 75`，每约 5 秒读取一次，不能保证捕获瞬时峰值。

## 历史结论与后续记录

以上为 2026-10-10 首轮记录。后续已完成图集轮换、约 2.6 小时单并发观察及多档 NPU 短测；两 session 初测未通过，见 [最新报告索引](README.md#实测报告)。满内存边界与高负载长稳仍待验证。

## 板端控制服务与 PC 查看

运行器要求 Node.js 控制服务与模型服务都在板端。本节与前述 PC 运行控制服务是两种部署方式，选择其中一种。板端从仓库目录执行 node server.js，网页内模型地址填 http://127.0.0.1:8080/v1。PC 需要查看同一个板端任务时，确认 PC 的 8787 没有被本地服务占用，再执行：

```bash
adb forward --no-rebind tcp:8787 tcp:8787
```

PC 浏览器打开 http://127.0.0.1:8787。关闭浏览器或断开 ADB 不会停止板端负载；关闭板端控制服务会中断测试。启动脚本允许通过 CONTEXT_SIZE 和 SESSIONS 覆盖默认值；具体步骤见 [短测指南](short-test-guide.md)。
