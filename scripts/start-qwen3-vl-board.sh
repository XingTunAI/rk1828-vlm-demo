#!/bin/sh
set -eu
. /etc/profile.d/rknn3-env.sh
cd "${1:-/userdata/models/Qwen3-VL-4B}"
exec rkllm3-server -m llm.rknn \
 --weight llm_Qwen3-VL-4B-rkkv4-32768.rk1828.weight \
 --model2 vision_Qwen3-VL-4B-pruned-384.rk1828.rknn \
 --weight2 vision_Qwen3-VL-4B-pruned-384.rk1828.weight \
 --vocab Qwen3-VL-4B.tokenizer.gguf --embed Qwen3-VL-4B.embed.bin \
 --img-start '<|vision_start|>' --img-end '<|vision_end|>' --img-content '<|image_pad|>' \
 --img-width 384 --img-height 384 --alias qwen3-vl-4b \
 --host 127.0.0.1 --port 8080 -c 768 --n-session 1
