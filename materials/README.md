# 事件复核素材

首批从 Wikimedia Commons 下载 8 张原图，来源、作者、许可链接和 SHA256 见 manifest.json。图片保持原样，单张均低于 Demo 的 4 MiB 限制。所有图片先作为候选素材，不是已标注测试集。

目录：phone（电话）、smoking（吸烟）、mobile（手机操作）、helmet（未戴安全帽）、vest（未穿反光衣）、intrusion（闯入）、fall（跌倒）、fight（打架）、fire（烟火）。每类包含 positive、negative、unreviewed 三个子目录。

- positive：证据支持该疑似事件，需人工标注确认。
- negative：证据反驳该事件，需人工标注确认。
- unreviewed：待审核素材，目前首批图片均在这里。

拳击是运动场景，不直接标为打架；单独香烟不代表有人正在吸烟；穿安全帽/反光衣的素材可用于相应违规任务的反例审核。跌倒需要连续画面；人员闯入需要定义区域，两个目录暂未填充正例。

选取候选图时勿将作者标题当作标注。正式验收需增加真实监控视角、正反例及遮挡/模糊难例。保留作者署名和各图片独立许可，项目代码许可不替代图片许可。

## 首批素材索引

图片均为原图，未作修改。点击文件可预览，来源页提供完整许可说明。

| 分类 | 图片 | 作者 | 许可 | 来源 |
| --- | --- | --- | --- | --- |
| fight | [fight-1.jpg](fight/unreviewed/fight-1.jpg) | Wayne Short | Public domain | [原始页面](https://commons.wikimedia.org/wiki/File:Boxing080905_photoshop.jpg) |
| fire | [fire-1.jpg](fire/unreviewed/fire-1.jpg) | He Who Laughs Last | Public domain | [原始页面](https://commons.wikimedia.org/wiki/File:Bonfire_Flames.JPG) |
| helmet | [helmet-1.jpg](helmet/unreviewed/helmet-1.jpg) | MyName (Ethelred) | Public domain | [原始页面](https://commons.wikimedia.org/wiki/File:Hard_Hat_Worker_HHW01.JPG) |
| mobile | [mobile-1.jpg](mobile/unreviewed/mobile-1.jpg) | Colton Cotton | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [原始页面](https://commons.wikimedia.org/wiki/File:Texting_on_cell_phone.jpg) |
| smoking | [smoking-1.jpg](smoking/unreviewed/smoking-1.jpg) | Paolo Neo | Public domain | [原始页面](https://commons.wikimedia.org/wiki/File:Cigarette_smoking.jpg) |
| phone | [phone-1.jpg](phone/unreviewed/phone-1.jpg) | Tim Parkinson | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [原始页面](https://commons.wikimedia.org/wiki/File:Man_speaking_on_mobile_phone_(unmirrored_landscape).jpg) |
| smoking | [smoking-2.jpg](smoking/unreviewed/smoking-2.jpg) | Sascha Kohlmann | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [原始页面](https://commons.wikimedia.org/wiki/File:Man_Smoking_(71920783).jpeg) |
| vest | [vest-1.jpg](vest/unreviewed/vest-1.jpg) | Rakás | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [原始页面](https://commons.wikimedia.org/wiki/File:Mormon_Helping_Hands_(high-visibility_vest,_Hungarian).jpg) |
