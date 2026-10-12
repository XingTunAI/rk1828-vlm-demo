# 公开方案与 SDK 原生对照

2026-10-11。公开参考：[Rockchip Qwen3-VL 示例](https://github.com/airockchip/rknn3-model-zoo/tree/main/examples/Qwen3_VL)。

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


所有原始日志、下载源码和测试图片仅保留本地results，不随项目提交。

## 同图片的HTTP服务探索

恢复原ctx16384模型服务后，使用同一张demo.jpg、同一句英文提示词、输出上限1024，连续3次请求均成功：首次首token1289.85ms；随后两次300.17/324.54ms，整体耗时828.16/859.09ms，decode39.70/39.26token/s，实际均输出21token。

原生输出108token、HTTP输出21token，说明两条路径的模板或采样等配置尚未对齐；原生ctx1024、HTTPctx16384亦不同。不能把延迟相减当HTTP开销，也不能称同条件A/B测试。固定同图可能受视觉缓存影响，即使请求cache_prompt=false也不保证所有阶段无缓存，不能替代20张轮换吞吐。下一步需对齐模板、采样、上下文和预热，再做可归因对照。

## 更正：已核实 Rockchip 原厂 V1.0.4 数据

已在用户提供SDK的 `rknn/rknn3-runtime/doc/00_Rockchip_RKNPU3_ReleaseNote_RKNN3_SDK_V1.0.4_CN.pdf` 找到原厂表。文档版本V1.0.4，日期2026-05-15，第9页为模型性能，第10页为条件，第13页给出测试方法入口。原文件只保存在本地SDK参考目录，不上传仓库。

Qwen3-VL-4B / RK1828 / 384×384：Vision117.6ms，LLM TTFT111.45ms，LLM Decode87.8token/s。这是 SDK V1.0.4 的历史原厂参考；当前 1.1.0 对比见下方复测报告。

原厂明确说明：Vision和LLM耗时独立测试；LLM输入128token、输出128token；RK3588与RK1828通过PCIe连接；RK3588采用performance模式；协处理器NPU为1GHz。

本机原生图文短测为Vision约130ms、LLM TTFT224.395ms、Decode36.873token/s，使用schedutil且图文输入/输出108token与原厂独立128/128测试不一致。因此这些数值不能作为同条件性能差距，更不能声称硬件只有原厂约四成性能。此前“原厂完整测试条件未知”的表述现已由上述条件补充；模型权重哈希等仍需对齐。

复测应优先按原厂方法分开测视觉与LLM：性能方法入口为 `rknn3-model-zoo/tools/rknn3_llm_test/README.md`；按说明排除首次会话初始化影响。再保留真实图文请求和业务短结论测试作为另外两种口径，不用随机token测试替代图片业务吞吐。

## 部分条件对齐复测与850MHz原因

2026-10-11：原厂Quick Start第25页明确列出SODIMM的EFFICIENT/NORMAL/PERFORMANCE分别为500/850/1000MHz，M.2分别为400/500/850MHz；第27页注明M.2最高频率不超过850MHz。当前设备可用400/500/850MHz、已为PERFORMANCE，与M.2档位一致。查询时温度32℃，默认温控阈值83℃对应850MHz、90℃对应500MHz；当前850MHz不能解释为过热降频。文档未在该处进一步解释模组上限的电气设计原因，不推断为芯片故障或可通过改配置解除。

按SDK指定源码在板端编译rknn3_session_test_eval_perf，保持原源码。将RK3588三组CPU governor临时切为performance，NPU保持受支持最高850MHz。LLM独立输入128、输出128，模型上下文32768；排除Run0初始化后：

| 项目 | Run1 | Run2 | 原厂1GHz参考 |
| --- | ---: | ---: | ---: |
| 首token / Prefill(ms) | 176.21 | 177.40 | 111.45 |
| Decode(token/s) | 39.61 | 39.81 | 87.8 |

程序将128输出中的首token计入Prefill，Generate计127个。原始日志包含plain text mrope提示，符合此次使用纯token输入的事实；不是图文业务准确率验证。

同一CPU performance设置下，再运行原生VLM三次：Vision119ms、图文LLM TTFT157.542ms、Decode40.107token/s、输出108token，退出0。视觉耗时接近原厂117.6ms；语言部分仍有差距，但频率、模型哈希、上下文及输入方式尚未完全对齐，不能把全部差距归因于850MHz，也不线性推算1GHz结果。

结束后CPU governor已恢复schedutil，模型服务恢复ctx16384单session，/health返回ok。完整日志保存在本地results/vendor-retest-board，不上传GitHub。


## CPU 亲和性复核及模型来源缺口

保持 SDK 原始 eval-perf 源码、128输入/128输出、32768上下文、CPU performance、NPU 850MHz不变，依次运行全部CPU允许、大核限定、全部CPU允许。每组3次，排除首次初始化后的两个 Decode 结果：

| CPU亲和性 | Run1 token/s | Run2 token/s |
| --- | ---: | ---: |
| 全部CPU，第一组 | 39.88 | 39.79 |
| 大核，taskset f0 | 40.99 | 41.09 |
| 全部CPU，复核组 | 39.87 | 40.68 |

三组均正常退出，未见日志中的推理失败；结束后恢复CPU schedutil及ctx16384单session服务，health正常。原始结果保存在本地results/condition-audit-board。大核绑定仅小幅改善，不能解释原厂87.8token/s与当前约40token/s的差距。这是短时性能诊断，不是稳定性或业务准确率验证。

当前模型README明确标明由Firefly AI Team转换，不是已经核实与Rockchip性能表一致的二进制产物。SDK eval源码实际使用模型max_ctx_len初始化session，命令行上下文参数只检查范围，不能通过改该参数声称已完成上下文对照。

官方公开[Model Zoo下载说明](https://github.com/airockchip/rknn3-model-zoo/blob/main/README_CN.md)提供[RKNN3 SDK网盘](https://console.box.lenovo.com/l/H1fig1)，提取码rknn。2026-10-11查阅的公开main指向RKNN3_SDK/rknn3_models/v1.1.0；当前比较基准来自V1.0.4，尚未核实网盘中对应旧版Qwen3-VL-4B包及哈希，不将新版包等同于该表的原始测试包。


## 官方 v1.1.0 模型加载验证（2026-10-11）

官网下载的Qwen3-VL-4B包含LLM/视觉模型及权重、embedding和tokenizer六个文件，传到板端后SHA256全部通过。模型内部记录编译器1.1.0；板端仍为1.0.4 Runtime。

SDK eval-perf在模型初始化阶段报告 `MODEL_SETUP fail, ack = ACK_FAIL`，随后退出码-6，未进入推理。因此没有有效TTFT或生成吞吐结果，不能将该次运行记为性能测试通过。版本不一致是优先排查因素，当前错误不足以认定唯一根因。

测试后原模型服务已恢复，health返回ok。升级前已备份现有Runtime、主机侧固件文件和服务配置；尚未执行升级。当前SDK输出中的Runtime标识为1.0.4，其固件文件SHA256与板端现有文件相同，不能作为1.1.0升级包。

官方模型与本地原始日志不提交GitHub。后续需配套版本验证，且v1.1.0测试结果不能直接标为对v1.0.4性能表的严格复现。


## 1.1.0 配套升级后原厂方法复测（2026-10-12）

板端Runtime和设备固件均已确认1.1.0。使用官方v1.1.0 Qwen3-VL-4B模型包，编译官方rknn3-aicp-1.1.0标签下未修改的eval-perf源文件（-O3 -DNDEBUG），RK3588 CPU governor临时设为performance，NPU保持M.2最高850MHz、PERFORMANCE模式，全核0xff。LLM独立输入128、输出128，程序执行3次并按官方说明排除Run0。

模型查询得到max_ctx_len=1024，max_position_embeddings=8192；此前Firefly模型max_ctx_len=32768。模型产物及软件栈同时变化，不能将提升归因于单一因素。

参考来源为SDK V1.1.0英文Release Notes第12页和第13页。原厂Qwen3-VL-4B：Vision108.23ms、LLM TTFT106.92ms、Decode89.95token/s；原厂采用RK3588 performance、PCIe、NPU1GHz、视觉与语言独立测试、LLM128/128。

| 指标 | 原厂1.1.0 | 本机Run1 | 本机Run2 |
| --- | ---: | ---: | ---: |
| LLM TTFT(ms) | 106.92 | 119.37 | 119.49 |
| Decode(token/s) | 89.95 | 85.82 | 85.80 |

两次均值：TTFT119.43ms，比参考高约11.7%；Decode85.81token/s，为参考95.4%，低约4.6%。首次Run0为122.94ms和80.34token/s，不计入上述均值。Generate阶段计127token，首个输出计入Prefill。

已对齐公开方法、SDK版本、输入输出长度和CPU governor；NPU850MHz与原厂1GHz不同。原厂性能表未提供模型哈希及完整上下文配置，仍不能宣称完全相同条件。此次只复测语言部分，不能据此填入视觉耗时或图片FPS，也不是稳定性或准确率结论。

测试正常退出，CPU策略已恢复；原始日志保存在本地results/upgrade-1.1.0/comparison.log，不上传GitHub。

[2026-10-12 SDK 1.1.0 完整复测报告](sdk-1.1.0-retest.md)。
