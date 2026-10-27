/** Select only work identities attached to the exact current person/year/location. */
import {validEvent} from './people-data.mjs?v=49a29e3c1836451d';

export function selectLocationWorks(data,{personId,year,location,eventId=null}){
 const result={matched:[],pending:[],eventIds:[]};
 if(!data||data.person_id!==personId||!location||!Number.isInteger(year))return result;
 const samePoint=(a,b)=>Number.isFinite(a.lon)&&Number.isFinite(a.lat)&&Number.isFinite(b.lon)&&Number.isFinite(b.lat)&&a.lon.toFixed(6)===b.lon.toFixed(6)&&a.lat.toFixed(6)===b.lat.toFixed(6);
 const matched=new Map(),pending=new Map();
 for(const event of location.events||[]){
  if(event.person_id!==personId||!validEvent(event,year)||!samePoint(event,location)||(eventId&&event.id!==eventId))continue;
  const reference=data.events?.[event.id];
  if(!reference||reference.year!==year||!samePoint(reference,event))continue;
  result.eventIds.push(event.id);
  for(const id of reference.item_ids){
   const item=data.items?.[id];if(!item||item.person_id!==personId)continue;
   for(const unit of item.units){
    const work=unit.status==='automatic'?data.works?.[unit.work_id]:null;
    if(work&&work.person_id===personId&&work.text){
     if(!matched.has(work.id))matched.set(work.id,{work,unitTitles:[],groupTitles:[],eventIds:[]});
     const entry=matched.get(work.id);
     if(!entry.unitTitles.includes(unit.title))entry.unitTitles.push(unit.title);
     if(!entry.groupTitles.includes(item.title))entry.groupTitles.push(item.title);
     if(!entry.eventIds.includes(event.id))entry.eventIds.push(event.id);
    }else{
     if(!pending.has(unit.id))pending.set(unit.id,{...unit,status:unit.status==='automatic'?'review':unit.status,reason:unit.status==='automatic'?'matched_text_unavailable':unit.reason,groupTitle:item.title,genre:item.genre_raw,eventIds:[]});
     const entry=pending.get(unit.id);if(!entry.eventIds.includes(event.id))entry.eventIds.push(event.id);
    }
   }
  }
 }
 result.matched=[...matched.values()];result.pending=[...pending.values()];
 return result;
}
