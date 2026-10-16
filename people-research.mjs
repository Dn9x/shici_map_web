const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={supported:'',disputed:'存在异说',partial:'部分可考',unknown:'尚未考定',tradition:'传说或纪念'};
export function researchTime(t={}){
 if(!Number.isInteger(t.year))return '年代不详';
 let value=t.year_end&&t.year_end!==t.year?`${t.year}—${t.year_end}年`:`${t.year}年`;
 if(t.month)value+=` ${t.month}月`;if(t.day)value+=`${t.day}日`;
 if(t.calendar==='chinese_lunisolar')value+='（旧历）';return value;
}
export function researchForYear(data,year){return (data?.timeline||[]).filter(c=>c.time?.year===year&&(!c.time.year_end||c.time.year_end===year));}
function claimHTML(c){return `<div class="people-research-claim"><p><b>${esc(c.label)}</b>${labels[c.status]?' · '+esc(labels[c.status]):''}</p><p class="people-source">${esc(researchTime(c.time))}${c.place?.label?' · '+esc(c.place.label):''}</p></div>`;}
export function biographyResearchHTML(data,year){const current=researchForYear(data,year);return `<details class="people-event-note people-research"><summary>生平简介与年代说明</summary>${(data.life||[]).map(claimHTML).join('')}${current.length?`<h3 class="people-works-title">${year}年</h3>${current.map(claimHTML).join('')}`:''}</details>`;}
export function workResearchHTML(data,id){const notes=data?.work_notes?.[id]||[];return notes.length?`<details class="people-work-evidence people-work-research"><summary>创作年代与地点说明</summary>${notes.map(claimHTML).join('')}<p class="people-source">存在异说的作品，不能视为已确定唯一的创作年份和地点。</p></details>`:'';}
