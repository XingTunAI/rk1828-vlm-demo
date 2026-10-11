# 公开方案与 SDK 原生对照

2026-10-11。公开参考：[Rockchip Qwen3-VL 示例](https://github.com/airockchip/rknn3-model-zoo/tree/main/examples/Qwen3_VL)、[飞凌性能表](https://docs.forlinx.net/ai-accelerator/rk1820_rk1828/RK1820_RK1828_AI_Accelerator_Development_Guide.html#vlm-performance)。

已下载公开 main.cc、qwen3_vl.cc、CMakeLists.txt 和 demo.jpg，来源及SHA256保存在本地results/public-native/sources.json。完整仓库下载超时，尚未编译公开示例。本轮运行板端随SDK安装的原生工具，不能声称严格复现公开源码或性能表。

## RK SDK 老化工具

板端包含 rknn3_vlm_demo、rknn3_llm_demo、rknn3_cnn_demo。当前SDK源码中对应 package/rknn3-test/rknn3_stress_test。VLM工具通过 -cl 指定循环次数、-tl 指定持续小时数、-vl/-ll 指定视觉/语言循环次数；具体参数以板端 --help 为准。

运行VLM工具需模型、权重、tokenizer、embedding、图片和prompt.ini。配置解析已对照当前SDK源码；缺失ini的首次预检退出1，未进入有效推理，单独保留。工具运行前停止HTTP模型服务以释放设备内存，结束后恢复。

原生工具和应用压测用途不同：前者记录模型阶段耗时及老化异常，后者记录图片请求吞吐、传输、排队、拒绝和业务结果。不能把原生TPS当图片/秒。

## 首轮原生结果

Qwen3-VL-4B W4A16，384×384，视觉/LLM核心掩码均0xff，公开demo.jpg，提示词“Describe this image briefly.”，-cl 1 -vl 3 -ll 3；退出0，TotalRuns=3。当前SDK源码将上下文及最大输出设为1024，实际GenLen=108。保持本机CPU schedutil策略，未切换性能模式。

| 工具汇总字段 | 实测 |
| --- | ---: |
| Vision | 130 ms |
| LLM TTFT | 224.395 ms |
| Decode TPS | 36.873 token/s |
| ModelMemory | 4241.519 MB |
| TotalTime | 10673.748 ms |

这是工具输出的汇总值，不是三次分布或P95。TotalTime与阶段计时边界不同，不将其倒数换算图片FPS；源代码计时器的聚合定义需继续核对。视觉输出tensor显示[144,2560]，确认当前视觉模型输出序列长度144，不能外推其他分辨率。

飞凌表中同模型同分辨率为Vision158.89ms、LLM TTFT108.29ms、Decode89.69token/s。但其VLM完整提示词、图片、权重哈希、上下文及预热等未充分公开，不能据此给出同条件性能差距百分比。本轮是原生对照探索，尚非严格复现。

所有原始日志、下载源码和测试图片仅保留本地results，不随项目提交。

## 同图片的HTTP服务探索

恢复原ctx16384模型服务后，使用同一张demo.jpg、同一句英文提示词、输出上限1024，连续3次请求均成功：首次首token1289.85ms；随后两次300.17/324.54ms，整体耗时828.16/859.09ms，decode39.70/39.26token/s，实际均输出21token。

原生输出108token、HTTP输出21token，说明两条路径的模板或采样等配置尚未对齐；原生ctx1024、HTTPctx16384亦不同。不能把延迟相减当HTTP开销，也不能称同条件A/B测试。固定同图可能受视觉缓存影响，即使请求cache_prompt=false也不保证所有阶段无缓存，不能替代20张轮换吞吐。下一步需对齐模板、采样、上下文和预热，再做可归因对照。
