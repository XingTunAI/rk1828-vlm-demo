import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageInfo, validateMessages, visionContent } from '../lib/vision.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
test('image metadata excludes payload and has stable digest',()=>{const info=imageInfo(image);assert.equal(info.mime,'image/png');assert.equal(info.sha256.length,64);assert.ok(info.bytes>0);assert.ok(!JSON.stringify(info).includes('base64'));});
test('reject remote, wrong MIME, malformed and oversized images',()=>{
  for(const value of ['https://example.com/a.png','data:image/png;base64,aGVsbG8=',image.replace('image/png','image/jpeg'),'data:image/png;base64,'+Buffer.alloc(4*1024*1024+1).toString('base64')])assert.throws(()=>imageInfo(value));
});
test('multi-turn VLM conversation keeps exactly one image',()=>{
  const first={role:'user',content:visionContent('describe',image)};
  assert.doesNotThrow(()=>validateMessages([first,{role:'assistant',content:'answer'},{role:'user',content:'follow up'}]));
  assert.throws(()=>validateMessages([{role:'user',content:'no image'}]));
  assert.throws(()=>validateMessages([first,first]));
});
