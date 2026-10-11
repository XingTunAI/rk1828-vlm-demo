# 视频素材

首批 2 段原始 WebM 视频，总计 4.64 MiB，已同步板端。文件哈希与来源一致，板端 ffprobe 已核验时长、编码和分辨率。

| 素材 | 时长 | 分辨率 | 作者 / 许可 | 来源 |
| --- | --- | --- | --- | --- |
| [城市行人](city-walking.webm) | 14.24 秒 | 1920×1080 | Coverr / [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [来源](https://commons.wikimedia.org/wiki/File:Big_City_Life.webm) |
| [挥手动作](hand-wave.webm) | 5.208 秒 | 1920×1080 | NMu11er / [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [来源](https://commons.wikimedia.org/wiki/File:HandWaveExample.webm) |

打开 [视频图集](index.html) 可离线播放。原文件未剪辑或转码；各素材适用表中独立许可，项目代码许可不覆盖素材。

这些是待标注候选素材，用于人物动作观察及后续抽帧流程准备；不是跌倒、打架或闯入事件的真值样本。准确率评估前需人工标注事件时间段、目标及区域。

当前推理接口仍接收单张图片，视频尚未接入推理。保存和播放原视频不需要预先转码；送入视觉模型前仍需解码获取画面。视频素材与图片清单分开，避免现有图片压测误读。

本轮 4 小时 NPU 高负载测试使用原有 20 张图片轮换和长提示词，不使用这两段视频。详细元数据见 [manifest.json](manifest.json)。
