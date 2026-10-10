import { createHash } from 'node:crypto';

export function imageInfo(url) {
  if (typeof url !== 'string') throw new Error('请选择 JPEG 或 PNG 图片');
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!match) throw new Error('仅接受本地 JPEG / PNG 图片，不接受远程图片链接');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 4 * 1024 * 1024 || bytes.toString('base64') !== match[2]) throw new Error('图片编码无效或超过 4 MiB');
  const valid = match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error('图片格式与文件内容不一致');
  return { mime: `image/${match[1]}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function visionContent(text, image) {
  imageInfo(image);
  return [{ type:'image_url', image_url:{url:image} }, {type:'text',text}];
}

export function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 50) throw new Error('对话消息无效');
  let images = 0;
  for (const m of messages) {
    if (!['user','assistant','system'].includes(m.role)) throw new Error('消息角色无效');
    if (typeof m.content === 'string') continue;
    if (m.role !== 'user' || !Array.isArray(m.content) || !m.content.length) throw new Error('图文消息无效');
    for (const part of m.content) {
      if (part.type === 'text' && typeof part.text === 'string') continue;
      if (part.type === 'image_url') { imageInfo(part.image_url?.url); images++; continue; }
      throw new Error('不支持的消息内容');
    }
  }
  if (images !== 1) throw new Error('当前 VLM 会话需包含且仅包含一张图片；切换图片请新建对话');
}
