/** Pure timeline selection. A source-record order is not a claimed travel order. */
export function ageStage(person,year){
 const age=Number.isInteger(person.birth_year)?Math.max(0,year-person.birth_year):null;
 return {age,stage:age===null?'middle':age<15?'child':age<30?'young':age<50?'middle':'late',
         label:age===null?'年龄待考':`约${age}岁${person.birth_uncertain?' · 生年待考':''}`};
}
/** Life status is distinct from whether this year has a mappable record. */
export function lifeStatus(person,year){
 const age=ageStage(person,year).label;
 if(Number.isInteger(person.birth_year)&&year<person.birth_year)return {key:'unborn',status:person.birth_uncertain?'尚未出生（依采用生年）':'尚未出生',ageLabel:'—'};
 if(!Number.isInteger(person.birth_year)&&Number.isInteger(person.record_from)&&year<person.record_from)return {key:'uncertain',status:'生存状态待考',ageLabel:'年龄待考'};
 if(Number.isInteger(person.death_year)){
  if(year>person.death_year)return {key:'dead',status:'已故',ageLabel:Number.isInteger(person.birth_year)?`享年约${person.death_year-person.birth_year}岁`:'享年待考'};
  if(year===person.death_year)return {key:'dying',status:'本年去世',ageLabel:age};
 }
 if(person.death_uncertain&&Number.isInteger(person.death_year_claim)&&year>=person.death_year_claim)return {key:'uncertain',status:year===person.death_year_claim?'本年记卒（有异说）':'卒年待考',ageLabel:year===person.death_year_claim?age:'年龄待考'};
 if(!Number.isInteger(person.death_year)&&year>person.record_to)return {key:'uncertain',status:person.last_seen_status==='missing'?'下落不详':'生存状态待考',ageLabel:'年龄待考'};
 return {key:'alive',status:'在世',ageLabel:age};
}
export function validEvent(e,year){return e.year===year&&Number.isFinite(e.lon)&&Number.isFinite(e.lat)&&e.lon!==0&&e.lat!==0&&Math.abs(e.lon)<=180&&Math.abs(e.lat)<=90;}
export function yearLocations(person,events,year){
 const groups=new Map();
 for(const e of events){
  if(!validEvent(e,year))continue;
  const key=`${e.lon.toFixed(6)},${e.lat.toFixed(6)}`;
  if(!groups.has(key))groups.set(key,{id:key,person_id:person.id,lon:e.lon,lat:e.lat,label:placeLabel(e),events:[]});
  groups.get(key).events.push(e);
 }
 const list=[...groups.values()],counts=new Map();for(const l of list)counts.set(l.label,(counts.get(l.label)||0)+1);
 for(const l of list)if(counts.get(l.label)>1){
  const p=l.events[0].place,modern=[p.modern_city,p.modern_county].filter(Boolean).join(' · ');
  l.label+=`（${modern?modern+'；':''}${l.lon.toFixed(2)}, ${l.lat.toFixed(2)}）`;
 }
 return list;
}
export function placeLabel(e){return [...new Set([e.place.historic_prefecture,e.place.historic_county,e.place.site].filter(Boolean))].join(' · ')||[e.place.modern_province,e.place.modern_city].filter(Boolean).join(' · ')||'有坐标记录';}
export function resolveSelection(locations,previous){return locations.find(l=>l.id===previous)||locations[0]||null;}
/** Co-located people share one geographic anchor; display order never moves it. */
export function groupMapLocations(entries){
 const groups=new Map();
 for(const entry of entries){
  const {lon,lat}=entry.location;
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon===0||lat===0)continue;
  const key=`${lon.toFixed(6)},${lat.toFixed(6)}`;
  if(!groups.has(key))groups.set(key,{key,lon,lat,members:[]});
  groups.get(key).members.push(entry);
 }
 return [...groups.values()];
}
/** Nearby points can share a chooser at overview zoom, keeping every real anchor. */
export function clusterMapGroups(groups,radius=44){
 const clusters=[];
 for(const group of [...groups].sort((a,b)=>a.x-b.x||a.y-b.y||a.key.localeCompare(b.key))){
  const cluster=clusters.find(c=>Math.hypot(c.seedX-group.x,c.seedY-group.y)<=radius);
  if(cluster){cluster.places.push(group);cluster.members.push(...group.members)}
  else clusters.push({seedX:group.x,seedY:group.y,places:[group],members:[...group.members]});
 }
 return clusters.map(c=>({...c,key:c.places.map(g=>g.key).sort().join('|'),nearby:c.places.length>1}));
}
/** Screen-only crowd presentation; every member keeps a separate true anchor. */
export function planPeopleGroup(group,selectedId=null){
 const entries=group.members.map(entry=>{
  const place=group.places.find(p=>p.members.some(m=>m.person.id===entry.person.id));
  return {...entry,anchorX:place.x,anchorY:place.y};
 }).sort((a,b)=>a.anchorX-b.anchorX||a.anchorY-b.anchorY||a.person.id.localeCompare(b.person.id));
 const count=entries.length;
 if(count>5){
  const front=entries.find(e=>e.person.id===selectedId)||entries[0];
  return {mode:'stack',markers:[{...front,x:front.anchorX,y:front.anchorY,scale:.8,
   companions:entries.filter(e=>e!==front).slice(0,2).map(e=>e.person)}]};
 }
 const slots={1:[[0,0]],2:[[-20,0],[20,0]],3:[[-22,0],[0,-12],[22,0]],
  4:[[-30,-8],[-10,0],[10,-12],[30,0]],5:[[-36,-4],[-18,-18],[0,0],[18,-18],[36,-4]]};
 const scale=count<3?1:count===3?.76:count===4?.72:.68;
 return {mode:count===1?'single':count===2?'pair':'compact',markers:entries.map((e,i)=>({...e,
  x:e.anchorX+slots[count][i][0],y:e.anchorY+slots[count][i][1],scale,companions:[]}))};
}
export function project(lon,lat){return {x:170+(lon-93)*78,y:175+(46-lat)*66};}
export function inBaseMap(lon,lat){const p=project(lon,lat);return p.x>=82&&p.x<=3118&&p.y>=82&&p.y<=2118;}
export function westernPoint(lon,lat){return {x:22+(lon-78)/23*236,y:152-(lat-32)/16*125};}
export function canLocateInWest(lon,lat){return lon>=78&&lon<=101&&lat>=32&&lat<=48;}
