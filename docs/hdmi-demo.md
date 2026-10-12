# HDMI 板端演示

目标：RK3588 Host 的 HDMI 屏幕显示网页，RK1828 执行 VLM 推理。板端控制服务访问 `127.0.0.1:8080/v1`，无需开发电脑转发。

部署目录 `/userdata/rk1828-vlm-demo`，包含 server.js、lib、public、materials。Node.js ARM64 运行时位于 runtime，本次使用官方 v22.23.3 并核对发布的 SHA256。网页服务以 linaro 用户运行：

```bash
sudo systemd-run --unit=rk1828-vlm-demo --uid=linaro \
  --working-directory=/userdata/rk1828-vlm-demo \
  /userdata/rk1828-vlm-demo/runtime/node-v22.23.3-linux-arm64/bin/node server.js
```

这是临时服务，不配置开机启动；已运行时不要重复创建同名 unit。重启后需重新启动模型和网页服务。

本板已有 WebKitGTK MiniBrowser。其系统 GBM 库缺少符号，启动前将 Ubuntu libgbm1 包解压到项目的 runtime/browser-libs，启动脚本只为浏览器设置 LD_LIBRARY_PATH 并采用软件渲染；不替换系统 GPU 驱动。此处理针对本次板端镜像，不保证其他镜像需要同样设置。

登录 linaro 图形桌面后：

```bash
sh /userdata/rk1828-vlm-demo/scripts/open-hdmi-demo.sh
```

桌面和应用菜单提供 RK1828 VLM Demo 入口。网页地址携带 baseUrl 参数，预填板端 8080 服务。图片选择器可从 `/userdata/rk1828-vlm-demo/materials` 选择素材。密码不保存到脚本或仓库。
