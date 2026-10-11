import { createHash } from 'node:crypto';

export function imageInfo(url) {
  if (typeof url !== 'string') throw new Error('请选择 JPEG 或 PNG 图片');
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!match) throw new Error('仅接受本地 JPEG / PNG 图片，不接受远程图片链接');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 4 * 1024 * 1024 || bytes.toString('base64') !== match[2]) throw new Error('图片编码无效或超过 4 MiB');
  const valid = match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error('图片格式与文件内容不一致');
  if(match[1]==='jpeg'){
    // Inspect frame components before passing images to the native SDK decoder.
    let frame=false;
    for(let p=2;p<bytes.length;){
      if(bytes[p++]!==255)break;
      while(bytes[p]===255)p++;
      const marker=bytes[p++];
      if(marker===0xda||marker===0xd9)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      if(p+2>bytes.length)break;
      const size=bytes.readUInt16BE(p);if(size<2||p+size>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        if(size<8)break;
        if(bytes[p+7]!==3)throw new Error('模型 SDK 不兼容灰度或 CMYK JPEG，请先转换为 RGB JPEG，或使用图集的兼容副本');
        frame=true;break;
      }
      p+=size;
    }
    if(!frame)throw new Error('JPEG 缺少有效图像帧');
  }
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
