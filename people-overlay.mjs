import {ageStage,yearLocations,resolveSelection,project,inBaseMap,westernPoint,canLocateInWest,lifeStatus} from './people-data.mjs?v=559b2b2851e4dd46';
import {selectLocationWorks} from './people-works.mjs?v=559b2b2851e4dd46';
import {biographyResearchHTML,workResearchHTML} from './people-research.mjs?v=559b2b2851e4dd46';

const stage=document.getElementById('stage'),world=document.getElementById('world-map');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dataVersion=new URL(import.meta.url).searchParams.get('v');
const get=async url=>{const address=new URL(url,document.baseURI);if(dataVersion)address.searchParams.set('v',dataVersion);const r=await fetch(address);if(!r.ok)throw Error(`资料读取失败 (${r.status})`);return r.json()};
let people=[],events=new Map(),poetry=new Map(),research=new Map(),workScope='location',year=Number(world.dataset.year)||618,manifest,yearIndex={},selected=null,show=true,westDismissed=false,raf=0,animateMove=false;
const eventLookup=new Map(),locationCache=new Map();
const focused=new Map(),nodes=new Map();
const layer=document.createElement('div');layer.id='people-layer';stage.append(layer);
const extraDots=document.createElement('div');layer.append(extraDots);
const roster=document.createElement('aside');roster.id='people-roster';roster.setAttribute('aria-label','人物列表');
roster.innerHTML='<p class="people-caption">正在读取人物行迹…</p>';document.body.append(roster);
const panel=document.createElement('aside');panel.className='people-panel';panel.hidden=true;panel.setAttribute('aria-label','人物行迹与作品');document.body.append(panel);
const west=document.createElement('aside');west.className='people-west';west.hidden=true;west.setAttribute('aria-label','西域行迹附图');stage.append(west);
west.innerHTML=`<div class="people-west-head"><b>西域行迹</b><button aria-label="收起西域附图">×</button></div><p>主图范围以外 · 仅为行迹位置示意</p><div class="people-west-map"><svg viewBox="0 0 280 170" aria-hidden="true"><rect width="280" height="170" fill="#eee3c9"/><path d="M12 58Q70 10 112 46T230 40L270 15M18 110Q85 80 138 115T272 95" fill="none" stroke="#9eac8a" stroke-width="15" opacity=".38"/><path d="M12 62Q71 15 112 49T230 43L270 18M18 113Q85 84 138 118T272 99" fill="none" stroke="#71876b" stroke-width="1" opacity=".55"/><path d="M48 105Q105 87 139 95T221 117" fill="none" stroke="#72998a" stroke-width="1.5"/><g fill="#887352" font-family="Songti SC,serif" font-size="11"><text x="126" y="35">天 山</text><text x="62" y="121">龟兹</text><text x="149" y="74">北庭</text><text x="231" y="137">敦煌</text></g></svg></div>`;
west.querySelector('button').onclick=()=>{westDismissed=true;renderPositions()};
const cityNote=document.createElement('div');cityNote.className='people-city-note';cityNote.hidden=true;stage.append(cityNote);

function currentLocations(p){
 const key=`${p.id}:${year}`;if(!locationCache.has(key)){
  const list=(yearIndex[String(year)]?.[p.id]||[]).map(id=>eventLookup.get(id)).filter(Boolean);
  locationCache.set(key,yearLocations(p,list,year));
 }
 return locationCache.get(key);
}
function currentLocation(p){return resolveSelection(currentLocations(p),focused.get(p.id))}
function sprite(p,scale=1){
 const {stage:s}=ageStage(p,year),f=p.frames[s];
 // Viewport clipping is applied at display time. Original PNG pixels stay intact.
 return `<svg class="poet-figure" width="${f.display_width*scale}" height="${f.display_height*scale}" viewBox="${f.x} ${f.y} ${f.width} ${f.height}" aria-hidden="true"><image href="${esc(p.sheet_url)}" x="0" y="0" width="1536" height="1024"/></svg>`;
}
function marker(p,loc,inset=false){
 let b=inset?null:nodes.get(p.id);
 if(!b){
  b=document.createElement('button');b.type='button';b.className='poet-marker';b.dataset.personId=p.id;
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.addEventListener('click',e=>{e.stopPropagation();stop();openPanel(p.id)});
  if(!inset){nodes.set(p.id,b);layer.append(b)}
 }
 const age=ageStage(p,year),signature=`${age.stage}:${year}:${loc.id}`;
 if(b.dataset.signature!==signature){b.innerHTML=`<span class="poet-name" style="color:${p.color}">${esc(p.name)}</span>${sprite(p,inset?.65:1)}`;b.dataset.signature=signature}
 b.setAttribute('aria-label',`${p.name}，${year}年，${age.label}，${loc.label}，查看行迹与作品`);
 b.setAttribute('aria-expanded',String(selected===p.id&&!panel.hidden));
 b.title=`${p.name} · ${age.label}\n${loc.label}${currentLocations(p).length>1?'\n本年记录地点之一，先后未定':''}`;
 return b;
}
function renderPositions(){
 if(!manifest)return;
 const cityMode=document.body.classList.contains('city-mode'),bounds=stage.getBoundingClientRect(),matrix=world.getScreenCTM();
 layer.hidden=!show||cityMode;
 const westMap=west.querySelector('.people-west-map');westMap.querySelectorAll('.poet-marker,.poet-record-dot').forEach(n=>n.remove());
 let western=0;
 extraDots.replaceChildren();
 const occupied=[];
 for(const p of people){
  const loc=currentLocation(p),old=nodes.get(p.id);
  if(!loc||!show||cityMode){if(old)old.hidden=true;continue}
  renderOtherDots(p,loc,matrix,bounds);
  const westLocations=currentLocations(p).filter(l=>!inBaseMap(l.lon,l.lat)&&canLocateInWest(l.lon,l.lat));western+=westLocations.length;
  for(const other of westLocations){
   if(other.id===loc.id)continue;
   const dot=document.createElement('button'),q=westernPoint(other.lon,other.lat);dot.className='poet-record-dot';dot.type='button';
   dot.style.cssText=`left:${q.x/280*100}%;top:${q.y/170*100}%;--person-color:${p.color}`;
   dot.setAttribute('aria-label',`${p.name}西域记录：${other.label}`);dot.title=`${p.name} · ${other.label}`;
   dot.onpointerdown=e=>e.stopPropagation();dot.onclick=e=>{e.stopPropagation();stop();focused.set(p.id,other.id);westDismissed=false;openPanel(p.id)};westMap.append(dot);
  }
  if(!inBaseMap(loc.lon,loc.lat)){
   if(old)old.hidden=true;
   if(canLocateInWest(loc.lon,loc.lat)){
    const b=marker(p,loc,true),q=westernPoint(loc.lon,loc.lat);
    b.style.left=`${q.x/280*100}%`;b.style.top=`${q.y/170*100}%`;westMap.append(b);
   }
   continue;
  }
  const q=project(loc.lon,loc.lat),point=world.createSVGPoint();point.x=q.x;point.y=q.y;
  const screen=point.matrixTransform(matrix),x=screen.x-bounds.left,y=screen.y-bounds.top;
  const b=marker(p,loc);b.hidden=x<0||x>bounds.width||y<10||y>bounds.height;
  if(b.hidden)continue;
  let offset=0;while(occupied.some(a=>Math.abs(a.x-(x+offset))<39&&Math.abs(a.y-y)<58))offset+=35;
  occupied.push({x:x+offset,y});b.dataset.dragging=String(stage.classList.contains('dragging')||!animateMove);b.style.left=`${x+offset}px`;b.style.top=`${y}px`;
 }
 west.hidden=!show||cityMode||!western||westDismissed;
 renderCityNote(cityMode);
 animateMove=false;
 stage.dispatchEvent(new CustomEvent('people-layout-change'));
}
function renderOtherDots(p,loc,matrix,bounds){
 for(const other of currentLocations(p)){
   if(other.id===loc.id||!inBaseMap(other.lon,other.lat))continue;
   const q=project(other.lon,other.lat),pt=world.createSVGPoint();pt.x=q.x;pt.y=q.y;
   const s=pt.matrixTransform(matrix),dx=s.x-bounds.left,dy=s.y-bounds.top;
   if(dx<0||dx>bounds.width||dy<0||dy>bounds.height)continue;
   const dot=document.createElement('button');dot.type='button';dot.className='poet-record-dot';
   dot.style.cssText=`left:${dx}px;top:${dy}px;--person-color:${p.color}`;
   dot.setAttribute('aria-label',`${p.name}本年其他地点：${other.label}`);dot.title=`${p.name} · ${other.label}`;
   dot.onpointerdown=e=>e.stopPropagation();dot.onclick=e=>{e.stopPropagation();stop();focused.set(p.id,other.id);animateMove=true;openPanel(p.id)};
   extraDots.append(dot);
 }
}
function renderCityNote(cityMode){
 cityNote.hidden=true;if(!show||!cityMode)return;
 const svg=document.querySelector('#city-view svg');
 const city={lon:Number(svg?.dataset.lon),lat:Number(svg?.dataset.lat)};
 if(!Number.isFinite(city.lon)||!Number.isFinite(city.lat))return;
 const nearby=people.filter(p=>currentLocations(p).some(l=>Math.hypot(l.lon-city.lon,l.lat-city.lat)<.16));
 if(!nearby.length)return;
 cityNote.innerHTML=`<div class="people-caption">${year}年附近行迹 · 城内位置未考</div><div style="display:flex;gap:14px;align-items:end;margin-top:4px">${nearby.map(p=>`<div style="display:flex;align-items:center;flex-direction:column">${sprite(p)}<span style="font-size:12px">${esc(p.name)}</span></div>`).join('')}</div>`;
 cityNote.hidden=false;
}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;renderPositions()})}
// The existing Tang–Song timeline is the only clock and playback controller.
function stop(){const button=document.getElementById('play-years');if(button?.getAttribute('aria-pressed')==='true')button.click()}
function syncYear(){
 const value=Number(world.dataset.year);if(!Number.isInteger(value))return;
 year=value;westDismissed=false;animateMove=true;
 for(const p of people){const l=currentLocation(p);if(l)focused.set(p.id,l.id)}
 renderRoster();renderPositions();if(!panel.hidden&&selected)renderPanel();
}
function renderRoster(){
 const list=roster.querySelector('.people-list');if(!list)return;
 roster.dataset.year=year;
 roster.querySelector('[data-roster-year]').textContent=`${year} 年`;
 list.innerHTML=people.map(p=>{
  const life=lifeStatus(p,year),locs=currentLocations(p);
  return `<button class="people-row" data-person="${p.id}" data-life="${life.key}" aria-pressed="${selected===p.id&&!panel.hidden}" aria-label="${esc(p.name)}，${esc(life.status)}，${esc(life.ageLabel)}，${locs.length?`本年${locs.length}处记录`:'本年无可定位记录'}"><span class="people-row-portrait">${sprite(p,.65)}</span><span class="people-row-copy"><strong style="color:${p.color}">${esc(p.name)}</strong><span class="people-life">${esc(life.status)} · ${esc(life.ageLabel)}</span><small>${locs.length?`本年 ${locs.length} 处行迹`:(life.key==='unborn'?'尚未出生':life.key==='dead'?'生平已结束':'本年位置不详')}</small></span></button>`;
 }).join('');
 for(const button of list.querySelectorAll('[data-person]'))button.onclick=()=>{stop();if(selected===button.dataset.person&&!panel.hidden)closePanel();else openPanel(button.dataset.person)};
 roster.querySelector('[data-roster-note]').textContent=people.some(p=>currentLocations(p).length)?'点人物查看行迹与作品':'本年暂无可定位的人物记录';
}
function buildControls(){
 roster.innerHTML=`<div class="people-roster-heading"><h2>人 物</h2><span data-roster-year></span><label><input data-show type="checkbox" checked aria-label="显示地图人物">显示</label></div><div class="people-list"></div><p class="people-caption" data-roster-note></p><p class="people-roster-footnote">年龄依所采用生年估算；位置不详不绘制。</p>`;
 roster.querySelector('[data-show]').onchange=e=>{show=e.target.checked;renderPositions()};
}
function closePanel(){panel.hidden=true;selected=null;document.body.classList.remove('people-panel-open');renderRoster();renderPositions()}
function monthLabel(raw){return /^\d+(;\d+)*$/.test(raw)?raw+'月':raw}
function openPanel(id){selected=id;panel.hidden=false;document.body.classList.add('people-panel-open');renderRoster();renderPanel();renderPositions()}
function renderPanel(){
 const p=people.find(p=>p.id===selected);if(!p)return;
 const locs=currentLocations(p),loc=currentLocation(p),life=lifeStatus(p,year);
 panel.innerHTML=`<button class="people-panel-close" aria-label="关闭人物详情">×</button><div class="people-profile">${sprite(p,1.25)}<div><h2 style="color:${p.color}">${esc(p.name)}</h2><p>${year}年 · ${esc(life.status)} · ${esc(life.ageLabel)}</p><p>${p.record_from}—${p.record_to}年生平行迹</p></div></div><div class="people-panel-content"></div>`;
 panel.querySelector('button').onclick=closePanel;
 const content=panel.querySelector('.people-panel-content');
 if(!loc){content.innerHTML='<p>本年没有年代与位置均明确的行迹记录，地图不显示此人。</p>'+`<p class="people-source">${esc(p.life_note)}</p>`;renderResearch(p,content);return}
 content.innerHTML=`<label for="people-place">${locs.length>1?`本年${locs.length}处记录地点`:'本年记录地点'}</label><select id="people-place" aria-label="选择人物本年地点">${locs.map(l=>`<option value="${esc(l.id)}" ${l.id===loc.id?'selected':''}>${esc(l.label)}</option>`).join('')}</select>${locs.length>1?'<p class="people-source">当前显示本年记录之一；列表顺序不代表真实行程先后。</p>':''}<label for="people-event">此地 ${loc.events.length} 条记载</label><select id="people-event" aria-label="选择行迹记载">${loc.events.map((e,i)=>`<option value="${e.id}">${i+1}. ${esc((e.time.month_raw?monthLabel(e.time.month_raw)+' · ':'')+(e.description||'作品记载').slice(0,35))}</option>`).join('')}</select><div data-event-content></div><section data-location-works aria-label="本年此地作品"></section>`;
 content.querySelector('#people-place').onchange=e=>{stop();focused.set(p.id,e.target.value);westDismissed=false;animateMove=true;renderPositions();renderPanel()};
 content.querySelector('#people-event').onchange=e=>{renderEvent(p,loc.events.find(x=>x.id===e.target.value));if(workScope==='event')renderLocationWorks(p,loc)};
 renderResearch(p,content);renderEvent(p,loc.events[0]);renderLocationWorks(p,loc);
}
function loadResearch(p){
 if(!research.has(p.id))research.set(p.id,get(`data/people/research/${p.id}.json`).then(data=>{
  if(data.person_id!==p.id)throw Error('人物补充资料不匹配');return data;
 }).catch(error=>{research.delete(p.id);throw error}));
 return research.get(p.id);
}
async function renderResearch(p,content){
 const target=document.createElement('section'),requestedYear=year;target.dataset.biographyResearch=p.id;content.prepend(target);
 try{
  const data=await loadResearch(p);
  if(target.isConnected&&selected===p.id&&year===requestedYear)target.innerHTML=biographyResearchHTML(data,requestedYear);
 }catch{if(target.isConnected)target.innerHTML='<p class="people-source">生平简介暂未读取，行迹与作品仍可查看。</p>'}
}
function renderEvent(p,e){
 const target=panel.querySelector('[data-event-content]');if(!target||!e)return;
 target.dataset.eventId=e.id;
 target.innerHTML=`<p>${esc(e.description)}</p><p class="people-source">${esc(p.age_note)}</p>`;
}
function loadPoetry(p){
 if(!poetry.has(p.id))poetry.set(p.id,get(`data/people/poetry/${p.id}.json`).then(data=>{
  if(data.person_id!==p.id)throw Error('人物作品资料不匹配');return data;
 }).catch(error=>{poetry.delete(p.id);throw error}));
 return poetry.get(p.id);
}
let poetryRequest=0;
async function renderLocationWorks(p,loc){
 const target=panel.querySelector('[data-location-works]');if(!target)return;
 const request=String(++poetryRequest),requestedYear=year,scope=workScope;
 const eventId=scope==='event'?panel.querySelector('#people-event').value:null;
 delete target.dataset.ready;delete target.dataset.matched;delete target.dataset.review;delete target.dataset.unmatched;
 target.dataset.request=request;target.dataset.personId=p.id;target.dataset.year=requestedYear;target.dataset.location=loc.id;target.dataset.scope=scope;
 target.innerHTML=`<h3 class="people-works-title">${requestedYear}年 · ${esc(loc.label)}的作品</h3><div class="people-work-scopes" role="group" aria-label="作品范围"><button type="button" data-work-scope="location" aria-pressed="${scope==='location'}">本年此地</button><button type="button" data-work-scope="event" aria-pressed="${scope==='event'}">仅当前记载</button></div><p class="people-source people-work-basis">作品按当前人物、年份和所选地点展示。创作年代或地点有异说时，会另作提示。</p><div data-poetry-results><p class="people-source">正在读取作品…</p></div>`;
 for(const button of target.querySelectorAll('[data-work-scope]'))button.onclick=()=>{stop();workScope=button.dataset.workScope;renderLocationWorks(p,loc)};
 const isCurrent=()=>target.isConnected&&!panel.hidden&&selected===p.id&&year===requestedYear&&currentLocation(p)?.id===loc.id&&target.dataset.request===request;
 try{
  const data=await loadPoetry(p);if(!isCurrent())return;
  const result=selectLocationWorks(data,{personId:p.id,year:requestedYear,location:loc,eventId});
  const matched=result.matched,review=result.pending.filter(u=>u.status==='review'),unmatched=result.pending.filter(u=>u.status==='unmatched');
  target.dataset.ready='true';target.dataset.matched=matched.length;target.dataset.review=review.length;target.dataset.unmatched=unmatched.length;
  const host=target.querySelector('[data-poetry-results]');
  const workNodes=new Map();
  host.innerHTML=`<p class="people-work-count" role="status">本年此地作品 ${matched.length} 首</p>${matched.length?'':'<p class="people-source">本年此地暂无可展示的作品正文。</p>'}`;
  for(const entry of matched){
   const work=entry.work,details=document.createElement('details');details.className='people-corpus-work';details.dataset.workId=work.id;details.dataset.eventIds=entry.eventIds.join(' ');
   details.innerHTML=`<summary>${esc(entry.unitTitles[0]||work.title)}</summary><pre class="people-corpus-text">${esc(work.text)}</pre>`;
   workNodes.set(work.id,details);
   host.append(details);
  }
  // Supplemental lookup never blocks the existing work list or changes its scope.
  loadResearch(p).then(supplement=>{
   if(!isCurrent())return;
   for(const [id,node] of workNodes){const note=workResearchHTML(supplement,id);if(note)node.insertAdjacentHTML('beforeend',note)}
  }).catch(()=>{});
 }catch{
  if(!isCurrent())return;
  const host=target.querySelector('[data-poetry-results]');host.innerHTML='<p class="people-source">作品暂未读取成功。</p><button type="button" class="people-poetry-retry">重新读取</button>';
  host.querySelector('button').onclick=()=>renderLocationWorks(p,loc);
 }
}

try{
 manifest=await get('data/people/manifest.json');
 [people,yearIndex]=await Promise.all([get(manifest.people_url),get(manifest.year_index_url)]);
 const results=await Promise.allSettled(people.map(async p=>{const d=await get(p.events_url);events.set(p.id,d.events);for(const e of d.events)eventLookup.set(e.id,e)}));
 const failed=people.filter((p,i)=>results[i].status==='rejected');
 people=people.filter(p=>events.has(p.id));if(!people.length)throw Error('人物资料尚未读取成功');
 buildControls();syncYear();
 if(failed.length){const note=document.createElement('span');note.className='people-failure';note.textContent=`${failed.map(p=>p.name).join('、')}资料未读取`;roster.append(note)}
 const observe=new MutationObserver(changes=>{if(changes.some(c=>c.target===world&&c.attributeName==='data-year'))syncYear();else schedule()});observe.observe(world,{attributes:true,attributeFilter:['viewBox','style','data-year']});
 observe.observe(document.body,{attributes:true,attributeFilter:['class']});observe.observe(stage,{attributes:true,attributeFilter:['class']});
 new ResizeObserver(schedule).observe(stage);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closePanel()});
 window.addEventListener('pagehide',stop);
}catch(error){
 roster.innerHTML=`<span class="people-failure">人物资料暂未加载，地图功能仍可使用。${location.protocol==='file:'?'请通过本地HTTP预览打开页面。':''}</span>`;
 console.error('People overlay:',error);
}
