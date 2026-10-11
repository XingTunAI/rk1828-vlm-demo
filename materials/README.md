# 事件复核素材

当前收集 26 张 Wikimedia Commons 原图，按 9 个事件目录组织（部分目录尚无图片），均为待人工审核的候选素材。**不是已标注准确率测试集，也未达到每类 30–50 张的初步评估规模。**

双击 [index.html](index.html) 可离线浏览缩略图与来源；Demo 内也可筛选、勾选图集并应用到问答或压测。

## 数量与用途

| 事件 | 图片数 |
| --- | --- |
| 打电话 (phone) | 5 |
| 手机操作 (mobile) | 3 |
| 吸烟 (smoking) | 5 |
| 未戴安全帽 (helmet) | 3 |
| 未穿反光衣 (vest) | 4 |
| 人员闯入 (intrusion) | 1 |
| 跌倒 (fall) | 0 |
| 打架 (fight) | 3 |
| 烟火 (fire) | 2 |

每类目录包含 positive、negative、unreviewed；目前所有图片在 unreviewed。正例表示支持所选事件，反例表示反驳事件；例如穿安全帽是“未戴安全帽”的反例候选。

包含电话/手机、吸烟/喝水、反光衣/普通衣服、拳击/冲突线索、明火/背景场景等候选对照。搜索词只用于追溯检索，不作为标签。部分图片是历史或非监控视角，仅用于演示与困难场景探索，不能替代真实部署数据。

跌倒目录尚无素材；打架目录仅有拳击等静态场景候选，尚缺可靠事件正例和连续视频；闯入素材没有禁区 ROI 或授权规则，不能直接标为闯入。不得从单张图推断动作过程。

## 标注与复现

填写 [annotation-template.csv](annotation-template.csv)：verdict 采用“确认 / 否认 / 无法判断”，注明目标位置或 ROI、可见依据、审核者及日期。空白标签不参与准确率计算，不使用模型自行输出作为真值。最终验收需增加监控视角、夜间、遮挡、小目标及连续帧材料。

运行 `node scripts/verify-materials.mjs` 核验文件大小、SHA256、重复文件和来源字段。原图按原样保存；灰度 JPEG 的 RGB 推理副本由 python scripts/prepare-materials.py 生成，转换与哈希记录在清单中；单张不超过 4 MiB，Demo 每批总量仍不超过 20 MiB，不要一次选择整个素材库。

[manifest.json](manifest.json) 保存作者、标题、来源、许可、文件大小及哈希。各图片适用独立许可，代码许可不覆盖图片。

## 本轮采集记录

2026-10-11：从 8 张扩充到 26 张，新增 18 张。Wikimedia 原图服务返回 HTTP 429 并要求等待后，已停止后续下载。未完成的候选未写入清单。后续优先补充跌倒连续视频、闯入区域定义、拥抱和雾气等对照素材。

缺失文件可用 `node scripts/fetch-materials.mjs` 按固定清单恢复；该工具不覆盖已修改文件。用 `node scripts/build-material-index.mjs` 重建索引和空白标注模板（先备份已填写模板）。

## 来源和署名

| 文件 | 作者 | 许可 | 来源 |
| --- | --- | --- | --- |
| [fight-1.jpg](fight/unreviewed/fight-1.jpg) | Wayne Short | Public domain | [来源](https://commons.wikimedia.org/wiki/File:Boxing080905_photoshop.jpg) |
| [fire-1.jpg](fire/unreviewed/fire-1.jpg) | He Who Laughs Last | Public domain | [来源](https://commons.wikimedia.org/wiki/File:Bonfire_Flames.JPG) |
| [helmet-1.jpg](helmet/unreviewed/helmet-1.jpg) | MyName (Ethelred) | Public domain | [来源](https://commons.wikimedia.org/wiki/File:Hard_Hat_Worker_HHW01.JPG) |
| [mobile-1.jpg](mobile/unreviewed/mobile-1.jpg) | Colton Cotton | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [来源](https://commons.wikimedia.org/wiki/File:Texting_on_cell_phone.jpg) |
| [smoking-1.jpg](smoking/unreviewed/smoking-1.jpg) | Paolo Neo | Public domain | [来源](https://commons.wikimedia.org/wiki/File:Cigarette_smoking.jpg) |
| [phone-1.jpg](phone/unreviewed/phone-1.jpg) | Tim Parkinson | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [来源](https://commons.wikimedia.org/wiki/File:Man_speaking_on_mobile_phone_(unmirrored_landscape).jpg) |
| [smoking-2.jpg](smoking/unreviewed/smoking-2.jpg) | Sascha Kohlmann | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [来源](https://commons.wikimedia.org/wiki/File:Man_Smoking_(71920783).jpeg) |
| [vest-1.jpg](vest/unreviewed/vest-1.jpg) | Rakás | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [来源](https://commons.wikimedia.org/wiki/File:Mormon_Helping_Hands_(high-visibility_vest,_Hungarian).jpg) |
| [phone-2.jpg](phone/unreviewed/phone-2.jpg) | Ildar Sagdejev (Specious) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [来源](https://commons.wikimedia.org/wiki/File:2009-05-03_Man_talking_on_cell_phone_in_parking_lot.jpg) |
| [mobile-2.jpg](mobile/unreviewed/mobile-2.jpg) | Tomwsulcer | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [来源](https://commons.wikimedia.org/wiki/File:Young_people_texting_on_smartphones_using_thumbs.JPG) |
| [mobile-3.jpg](mobile/unreviewed/mobile-3.jpg) | Japanexperterna.se from Japan | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [来源](https://commons.wikimedia.org/wiki/File:Person_looking_at_smartphone_in_the_dark_(2).jpg) |
| [phone-3.jpg](phone/unreviewed/phone-3.jpg) | Jan Blok from Holland | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [来源](https://commons.wikimedia.org/wiki/File:M%27era_Luna_festival_2007_-_woman_with_phone.jpg) |
| [phone-4.jpg](phone/unreviewed/phone-4.jpg) | Chris Adamus | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [来源](https://commons.wikimedia.org/wiki/File:Woman_holding_mobile_phone_with_laptop_and_colorful_pencils_on_table.jpg) |
| [phone-5.jpg](phone/unreviewed/phone-5.jpg) | John Benson from Madison WI | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [来源](https://commons.wikimedia.org/wiki/File:Young_woman_walking_and_calling_on_the_phone_in_Madison,_Wisconsin_2020.jpg) |
| [smoking-3.jpg](smoking/unreviewed/smoking-3.jpg) | Luca Galuzzi (Lucag) | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5) | [来源](https://commons.wikimedia.org/wiki/File:Nama_Woman_Smoking_Kalahari_Desert_Namibia_Luca_Galuzzi_2004.JPG) |
| [smoking-4.jpg](smoking/unreviewed/smoking-4.jpg) | Kruscha | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [来源](https://commons.wikimedia.org/wiki/File:Smoking-smoke-cigarette-man-lung-cancer-1.jpg) |
| [smoking-5.jpg](smoking/unreviewed/smoking-5.jpg) | Beendy234 | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [来源](https://commons.wikimedia.org/wiki/File:Drinking_clean_water.jpg) |
| [vest-2.jpg](vest/unreviewed/vest-2.jpg) | Sgroey | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [来源](https://commons.wikimedia.org/wiki/File:Road_Worker_in_Hokkaido_Japan.jpg) |
| [helmet-2.jpg](helmet/unreviewed/helmet-2.jpg) | 作者未注明（来源元数据未提供） | Public domain | [来源](https://commons.wikimedia.org/wiki/File:StateLibQld_1_159292_Concreting_during_the_construction_of_the_Story_Bridge,_Brisbane,_1936.jpg) |
| [helmet-3.jpg](helmet/unreviewed/helmet-3.jpg) | Ettinger / Эттингер | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [来源](https://commons.wikimedia.org/wiki/File:RIAN_archive_695186_Construction_of_second_blast_furnace.jpg) |
| [vest-3.jpg](vest/unreviewed/vest-3.jpg) | Seattle Municipal Archives | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [来源](https://commons.wikimedia.org/wiki/File:Construction_worker_at_Westlake_Center,_1988.jpg) |
| [vest-4.jpg](vest/unreviewed/vest-4.jpg) | Efstathios Iosifidis | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [来源](https://commons.wikimedia.org/wiki/File:FOSDEM_2014_volunteer_and_staff.jpg) |
| [fight-2.jpg](fight/unreviewed/fight-2.jpg) | U.S. Navy photo by Mass Communication Specialist 2nd Class Kristopher S. Wilson | Public domain | [来源](https://commons.wikimedia.org/wiki/File:US_Navy_081012-N-5345W-033_Dave_Cruz,_right,_an_assistant_coach_with_757_Boxing_Club_in_Virginia_Beach,_Va.,_gives_his_fighter_pointers_between_rounds_during_a_sparring_session_at_the_All-Navy_Boxing_Team_mini-camp_at_Rockwell.jpg) |
| [fight-3.jpg](fight/unreviewed/fight-3.jpg) | Fadi (boxeur) | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [来源](https://commons.wikimedia.org/wiki/File:Boxing_is_more_than_just_throwing_punches._it%E2%80%99s_surviving_the_grind_when_everything_in_your_body_is_screaming_to_stop._Sparring_tests_your_limits,_both_physically_and_mentally._It%E2%80%99s_the_rounds_where_you%E2%80%99re_gassed,_bru.jpg) |
| [fire-2.jpg](fire/unreviewed/fire-2.jpg) | Nizil Shah | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [来源](https://commons.wikimedia.org/wiki/File:Holi_Bonfire_Festival_Mundra_Gujarat_India.jpg) |
| [intrusion-1.jpg](intrusion/unreviewed/intrusion-1.jpg) | Simon Carey | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [来源](https://commons.wikimedia.org/wiki/File:Pedestrians_Crossing,_Ham_Lane_-_geograph.org.uk_-_255093.jpg) |

## 视频素材

[视频说明与许可](videos/README.md) · [离线视频图集](videos/index.html)。
