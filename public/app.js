const $ = id => document.getElementById(id);
let tab='demo', history=[], chatBusy=false, connected=false, selectedImage=null, selectedImages=[];
const number = (value,unit='') => Number.isFinite(value) ? `${value.toFixed(1)}${unit}` : '—';
const notice = text => $('notice').textContent=text;
const boardBaseUrl=new URL(location.href).searchParams.get('baseUrl');
if(boardBaseUrl)$('baseUrl').value=boardBaseUrl;
const config=()=>({baseUrl:$('baseUrl').value.trim(),model:$('model').value,apiKey:$('apiKey').value,maxTokens:Number($('maxTokens').value),timeoutSeconds:Number($('timeoutSeconds').value)});
async function api(url,data){const r=await fetch(url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error||'请求失败');return result;}
function message(text,role){$('messages').querySelector('.empty')?.remove();const el=document.createElement('div');el.className=`message ${role}`;el.textContent=text;$('messages').append(el);el.scrollIntoView({block:'nearest'});return el;}
const tabs={demo:['视觉语言模型演示','上传一张图片，让模型理解画面并回答问题。'],performance:['性能测试','固定负载，测量响应延迟与请求吞吐。'],stability:['稳定性测试','持续运行，记录每一次完成与异常。'],reports:['测试报告','保存配置与逐请求数据，让结果可以复查。']};
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b===button));$('title').textContent=tabs[tab][0];$('subtitle').textContent=tabs[tab][1];$('demo').hidden=tab!=='demo';$('testing').hidden=!['performance','stability'].includes(tab);$('reports').hidden=tab!=='reports';$('testTitle').textContent=tab==='stability'?'稳定性测试配置':'性能测试配置';if(tab==='stability')$('loadMode').value='stability';updateMode();if(tab==='reports')loadReports();});
for(const id of ['baseUrl','apiKey'])$(id).oninput=()=>{connected=false;$('status').textContent='● 配置已修改';$('status').classList.remove('online');};
$('connect').onclick=async()=>{const b=$('connect');b.disabled=true;notice('正在检查服务…');try{const r=await api('/api/connect',config());$('model').replaceChildren();for(const m of r.models){const o=document.createElement('option');o.value=m.id;o.textContent=m.id;$('model').append(o);}connected=r.models.length>0;$('status').textContent=connected?'● 已连接':'● 无模型';$('status').classList.toggle('online',connected);notice(connected?'服务已就绪。并发测试前请确认服务端 session 配置。':'服务在线，但没有已加载模型。');history=[];}catch(e){connected=false;$('status').textContent='● 连接失败';$('status').classList.remove('online');notice(e.message);}finally{b.disabled=false;}};
document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{$('prompt').value=b.dataset.case;$('prompt').focus();});
$('clear').onclick=()=>{if(chatBusy)return;history=[];$('messages').replaceChildren();};
$('model').onchange=()=>{history=[];};
$('chatForm').onsubmit=async event=>{event.preventDefault();if(chatBusy)return;if(!connected)return notice('请先连接推理服务。');const text=$('prompt').value.trim();if(!text)return;if(!selectedImage)return notice('请先选择图片。');chatBusy=true;$('imageFile').disabled=true;$('send').disabled=true;message(text,'user');const answer=message('','assistant');const content=history.length?text:[{type:'image_url',image_url:{url:selectedImage}},{type:'text',text}];const messages=[...history,{role:'user',content}];let output='';try{const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config(),messages})});if(!res.ok)throw Error((await res.json()).error);const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',finished=false;while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line)continue;const e=JSON.parse(line);if(e.type==='delta'){output+=e.content;answer.textContent=output||(e.reasoning?'模型正在思考…':'');}if(e.type==='result'){finished=true;const r=e.record;$('chatTtft').textContent=number(r.ttftMs,' ms');$('chatTps').textContent=number(r.decodeTps,' tok/s');$('chatTime').textContent=number(r.durationMs/1000,' s');$('chatTokens').textContent=r.outputTokens??'—';if(!r.success)throw Error(r.error);history=[...messages,{role:'assistant',content:r.output}];$('prompt').value='';notice('回答完成');}}}if(!finished)throw Error('控制服务连接中断');}catch(e){answer.classList.add('error');answer.textContent=(output?output+'\n\n':'')+'错误：'+e.message;notice(e.message);}finally{chatBusy=false;$('imageFile').disabled=false;$('send').disabled=false;}};
$('start').onclick=async()=>{if(chatBusy)return notice('请先等待当前对话结束。');if(!connected)return notice('请先连接推理服务。');if(!selectedImage)return notice('请先选择测试图片。');$('start').disabled=true;try{await api('/api/runs',{...config(),mode:$('loadMode').value,images:selectedImages,arrivalRate:Number($('arrivalRate').value),burstSize:Number($('burstSize').value),burstInterval:Number($('burstInterval').value),queueLimit:Number($('queueLimit').value),concurrency:Number($('concurrency').value),sessions:Number($('sessions').value),requests:Number($('requests').value),durationSeconds:Number($('durationSeconds').value),prompt:$('testPrompt').value});notice('测试已开始，记录将保存到本地。');await poll();}catch(e){notice(e.message);$('start').disabled=false;}};
$('stop').onclick=async()=>{try{notice((await api('/api/stop',{})).message);}catch(e){notice(e.message);}};
async function poll(){try{const r=await api('/api/run');if(!r)return;$('start').disabled=r.status==='running';$('imageFile').disabled=r.status==='running'||chatBusy;$('send').disabled=chatBusy||r.status==='running';const s=r.summary;$('runState').textContent=`${({running:'运行中',completed:'已完成',stopped:'已停止',failed:'失败'})[r.status]} · ${number(s.elapsedMs/1000,' 秒')}`;$('total').textContent=s.total;$('rate').textContent=number(s.successRate===null?null:s.successRate*100,'%');$('p95').textContent=number(s.ttftP95,' ms');$('rps').textContent=number(s.requestsPerSecond);$('tokenRate').textContent=number(s.tokensPerSecond);$('e2e').textContent=number(s.endToEndP95,' ms')+' / '+number(s.endToEndP99,' ms');$('queueTime').textContent=number(s.queueP95,' ms');$('backlog').textContent=(s.queued??0)+' / '+(s.inFlight??0);$('loadCounts').textContent='到达 '+(s.offered??s.total)+' · 成功 '+s.succeeded+' · 失败 '+s.failed+' · 队满拒绝 '+(s.dropped??0)+' · 取消 '+(s.cancelled??0)+' · 峰值排队 '+(s.peakQueue??0)+' · 含拒绝成功占比 '+number(s.completionRatio==null?null:s.completionRatio*100,'%')+' · 排空 '+number(s.drainMs==null?null:s.drainMs/1000,' s');$('records').replaceChildren();for(const x of r.records.slice(-100).reverse()){const tr=document.createElement('tr');for(const value of [x.index+1,x.slot+' / '+((x.imageIndex??0)+1),number(x.queueMs,' ms'),x.success?'成功':'失败',number(x.ttftMs,' ms'),number(x.durationMs,' ms'),x.error||x.finishReason||'完成']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('records').append(tr);}if(r.storageError||r.stopReason)notice(r.storageError||r.stopReason);}catch(e){notice('无法读取测试状态：'+e.message);}}
async function loadReports(){try{const reports=await api('/api/reports');$('reportList').replaceChildren();if(!reports.length)$('reportList').textContent='暂无已完成的测试报告';for(const r of reports){const row=document.createElement('div');row.className='report';const label=document.createElement('div');label.textContent=new Date(r.startedAt).toLocaleString();const small=document.createElement('small');small.textContent=`${r.status} · ${r.summary.total} 次请求 · 成功 ${r.summary.succeeded} 次 · ${number(r.summary.requestsPerSecond)} 请求/s · ${number(r.summary.tokensPerSecond)} tok/s · 排队拒绝 ${r.summary.dropped??0}`;label.append(small);const b=document.createElement('button');b.textContent='下载 JSON';b.onclick=async()=>{try{const data=await api('/api/reports/'+r.id);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=r.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice(e.message);}};row.append(label,b);$('reportList').append(row);}}catch(e){notice(e.message);}}
$('refresh').onclick=loadReports;
setInterval(poll,2000);poll();

const modeHelp={baseline:'单并发逐张轮换，建立延迟基线。回答是否准确需人工核对，本页不自动判定业务准确率。',concurrency:'分别设置 1、2、4 路运行并比较报告。session 数需与实际启动参数一致，本页不会自动修改模型服务。',arrival:'按固定请求/秒独立产生任务；观察队列、拒绝与吞吐。到时停止输入，再排空已接收任务。',burst:'每隔指定秒数同时送入一批任务，模拟上游集中提交。记录排队与排空耗时。',stability:'按配置并发持续补发至时限或 100000 次。请使用已验证配置；资源监控仍由独立 ADB 脚本采集。'};
function updateMode(){const mode=$('loadMode').value;$('loadHelp').textContent=modeHelp[mode];$('concurrency').disabled=mode==='baseline';if(mode==='baseline')$('concurrency').value=1;$('requestField').hidden=['arrival','burst','stability'].includes(mode);document.querySelectorAll('[data-load]').forEach(el=>el.hidden=!el.dataset.load.split(' ').includes(mode));}
$('loadMode').onchange=updateMode;updateMode();
$('imageFile').onchange=async()=>{
 if(chatBusy)return notice('请先等待当前回答结束。');
 const files=[...$('imageFile').files];selectedImage=null;selectedImages=[];history=[];$('messages').replaceChildren();$('imagePreview').hidden=true;
 if(!files.length){$('imageMeta').textContent='尚未选择图片';return;}
 if(files.length>20||files.reduce((n,f)=>n+f.size,0)>20*1024*1024||files.some(f=>!['image/jpeg','image/png'].includes(f.type)||f.size>4*1024*1024)){notice('最多 20 张 JPEG/PNG，每张不超过 4 MiB，总计不超过 20 MiB');return;}
 try{
 const images=[];
 for(const file of files){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});const check=new Image();check.src=data;await check.decode();images.push(data);}
 selectedImages=images;selectedImage=images[0];$('imagePreview').src=selectedImage;$('imagePreview').hidden=false;$('imageMeta').textContent=files.length+' 张图片 · 问答展示第一张 · 测试依次轮换：'+files.map(f=>f.name).join('、');notice('图片集已准备好。');
 }catch(e){notice('无法读取图片：'+e.message);}
};

const reviewTasks={
phone:['打电话','检查手持电话靠近耳部等可见线索。手靠近脸不能单独证明打电话，无法看清手机时不要猜测。'],
smoking:['吸烟','检查嘴边或手中的香烟、可辨认的烟雾等线索。普通细物、背景雾气不等于吸烟。'],
mobile:['玩手机','检查可辨认手机、手部操作和视线关系。仅持有手机不能证明正在玩手机。'],
helmet:['未戴安全帽','定位目标人员并检查头部。普通帽子或其他头盔不自动视为工地安全帽；头部遮挡时无法判断。'],
vest:['未穿反光衣','检查目标人员上身是否穿有可辨认反光条的安全背心。仅凭衣服颜色不要判断；遮挡或太小无法判断。'],
intrusion:['人员闯入','必须给出禁区范围或清晰区域标记。单图只可确认人员是否位于指定区域，不能确认进入过程或人员是否获授权；未给区域时返回无法判断。'],
fall:['跌倒','检查是否存在倒地姿态。坐、躺或弯腰不证明发生跌倒；单图无法确认跌倒过程，需连续帧，结论保留无法判断并描述姿态。'],
fight:['打架','检查挥拳、踢踹、冲突接触等线索。拥抱、运动或手臂抬起不证明打架；单图无法确认冲突过程时返回无法判断。'],
fire:['烟火','区分可见火焰、疑似烟雾与灯光、蒸汽、云雾。分别描述火焰和烟雾证据，不推断火灾原因。']
};
function reviewHint(){ $('reviewHint').textContent=reviewTasks[$('reviewTask').value][1]; }
$('reviewTask').onchange=reviewHint;reviewHint();
$('applyReview').onclick=()=>{if(chatBusy)return notice('请先等待当前回答结束。');history=[];$('messages').replaceChildren();const [event,rule]=reviewTasks[$('reviewTask').value];const context=$('reviewContext').value.trim();const prompt='请复核上游疑似事件：'+event+'。现场条件：'+(context||'未提供')+'。'+rule+' 仅根据图片可见证据，不补全被遮挡细节。只输出 JSON：{"event":"'+event+'","verdict":"确认|否认|无法判断","evidence":"简短可见依据","limitation":"证据不足或需要补充的内容"}。verdict 只能取三个值之一。';$('prompt').value=prompt;$('testPrompt').value=prompt;notice('已应用“'+event+'”到问答和压测提示词。');};

let galleryRows=[],galleryChosen=new Set();
function galleryCount(){const chosen=galleryRows.filter(r=>galleryChosen.has(r.id));$('galleryCount').textContent=chosen.length+' 张 · '+(chosen.reduce((n,r)=>n+r.bytes,0)/1048576).toFixed(2)+' MiB';}
function renderGallery(){ $('gallery').replaceChildren();for(const row of galleryRows.filter(r=>!$('galleryFilter').value||r.event===$('galleryFilter').value)){
 const card=document.createElement('article'),link=document.createElement('a'),img=document.createElement('img');link.href=row.imageUrl;link.target='_blank';link.rel='noopener';img.src=row.imageUrl;img.alt=row.title;img.loading='lazy';link.append(img);
 const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=galleryChosen.has(row.id);check.onchange=()=>{if(check.checked)galleryChosen.add(row.id);else galleryChosen.delete(row.id);galleryCount();};label.append(check,document.createTextNode((reviewTasks[row.event]?.[0]||row.event)+' · '+(row.status==='unreviewed'?'待标注':row.status)));
 const title=document.createElement('p');title.textContent=row.title;const source=document.createElement('a');source.href=row.source;source.target='_blank';source.rel='noopener';source.textContent=row.author+' · '+row.license;
 const changes=document.createElement('small');changes.textContent=row.changes?.includes('Converted')?'推理副本：灰度转 RGB JPEG；原图保留':'';
 card.append(link,label,title,source,changes);$('gallery').append(card);
 }galleryCount();}
async function loadGallery(){try{galleryRows=await api('/api/materials');$('galleryFilter').replaceChildren(new Option('全部事件',''));for(const event of [...new Set(galleryRows.map(r=>r.event))])$('galleryFilter').append(new Option(reviewTasks[event]?.[0]||event,event));renderGallery();}catch(e){$('galleryCount').textContent='素材加载失败：'+e.message;}}
$('galleryRefresh').onclick=loadGallery;$('galleryFilter').onchange=renderGallery;$('galleryClear').onclick=()=>{galleryChosen.clear();renderGallery();};
$('galleryUse').onclick=async()=>{
 if(chatBusy||$('imageFile').disabled)return notice('请等待当前推理或测试结束。');
 const chosen=galleryRows.filter(r=>galleryChosen.has(r.id));if(!chosen.length||chosen.length>20||chosen.reduce((n,r)=>n+r.bytes,0)>20*1048576)return notice('请选择 1–20 张图片，总计不超过 20 MiB');
 $('galleryUse').disabled=true;
 try{const data=[];for(const row of chosen){const response=await fetch(row.imageUrl);if(!response.ok)throw Error('无法读取素材');const blob=await response.blob();data.push(await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('读取失败'));reader.readAsDataURL(blob);}));}
 if(chatBusy||$('imageFile').disabled)throw Error('任务已开始，请结束后重新应用图片');
 selectedImages=data;selectedImage=data[0];history=[];$('messages').replaceChildren();$('imageFile').value='';$('imagePreview').src=data[0];$('imagePreview').hidden=false;$('imageMeta').textContent='已选择图集 '+data.length+' 张，问答使用第一张，压测顺序轮换。';notice('图集已应用。');
 }catch(e){notice(e.message);}finally{$('galleryUse').disabled=false;}
};
loadGallery();
