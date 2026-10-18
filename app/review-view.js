import {reviewGroups, chartCoordinates} from './review-model.js';
import {OUTCOMES} from './practice-store.js';
import {shortTitle} from './course.js';
const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
const clock=value=>{const total=Math.floor(value);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;};
const duration=value=>value>=3600?`${Math.floor(value/3600)} 小时 ${Math.floor(value%3600/60)} 分钟`:`${Math.floor(value/60)} 分 ${Math.floor(value%60)} 秒`;
const link=(group,extra={})=>'#history?'+new URLSearchParams({lesson:group.entryId,version:group.version,...extra});
const filters={all:'全部',continue:'继续练',mastered:'已掌握',unrated:'未评价'};
function graph(points,kind){
  if(!points.length)return `<p class="review-empty">${kind==='tempo'?'还没有确认过稳定 BPM':'还没有练习记录'}</p>`;
  const coords=chartCoordinates(points,{zero:kind==='duration'}),unit=kind==='tempo'?'BPM':'分钟';
  const last=coords.at(-1),first=coords[0];
  const max=Math.max(...points.map(p=>p.value));
  const min=kind==='duration'?0:Math.max(0,Math.min(...points.map(p=>p.value))-5),high=kind==='duration'?max:max+5;
  const label=v=>kind==='duration'?String(Math.round(v/60*10)/10):String(v);
  const line=kind==='duration'?`<polyline class="duration-path" points="${coords.flatMap((p,i)=>i?[`${p.x},${coords[i-1].y}`,`${p.x},${p.y}`]:[`${p.x},${p.y}`]).join(' ')}"/>`:'';
  // Tempo is intentionally unconnected: passage/subdivision comparability is not recorded.
  return `<svg class="review-chart ${kind}-chart" viewBox="0 0 640 220" role="img" aria-label="${kind==='duration'?'累计练习分钟':'逐次自评稳定 BPM'}，${points.length} 条记录；精确值见下方明细"><path class="chart-axis" d="M56 34V176H604"/><path class="chart-grid" d="M56 105H604 M56 34H604"/><text x="48" y="39" text-anchor="end">${label(high)}</text><text x="48" y="180" text-anchor="end">${label(min)}</text><text x="56" y="18">${unit}</text>${line}${coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" class="observation"><title>${esc(date(p.at))} · ${kind==='duration'?clock(p.value):p.value+' BPM'}</title></circle>`).join('')}<text x="56" y="208">${esc(date(first.at))}</text>${first.at!==last.at?`<text x="604" y="208" text-anchor="end">${esc(date(last.at))}</text>`:''}</svg>`;
}
function timeline(group){
  if(!group.outcomes.length)return '<p class="review-empty">还没有熟练程度自评</p>';
  return `<ol class="proficiency-timeline" aria-label="熟练程度自评记录">${[...group.outcomes].reverse().map(p=>`<li><a href="${esc(link(group,{session:p.id}))}"><span class="proficiency-dot ${p.value==='mastered'?'is-mastered':''}" aria-hidden="true"></span><strong>${esc(OUTCOMES[p.value] || p.value)}</strong><time datetime="${esc(p.at)}">${esc(date(p.at))}</time></a></li>`).join('')}</ol>`;
}
function recordsTable(group,params){
  const size=20,count=Math.ceil(group.records.length/size),page=Math.min(count,Math.max(1,Number.parseInt(params.get('records'),10)||1));
  const rows=[...group.records].reverse().slice((page-1)*size,page*size);
  const cumulative=new Map(group.duration.map(p=>[p.id,p.value]));
  return `<section class="lesson-records"><h3>每次练习</h3><div class="record-table-scroll"><table><caption>练习明细 · ${group.records.length} 次</caption><thead><tr><th scope="col">日期</th><th scope="col">时长</th><th scope="col">累计时长</th><th scope="col">稳定 BPM</th><th scope="col">熟练程度</th><th scope="col">记录</th></tr></thead><tbody>${rows.map(r=>`<tr><td><time datetime="${esc(r.practicedAt)}">${esc(new Date(r.practicedAt).toLocaleString('zh-CN'))}</time></td><td>${clock(r.source==='timer'?r.seconds:r.minutes*60)}</td><td>${clock(cumulative.get(r.id))}</td><td>${r.bpmBasis==='self-reported-stable'&&r.bpm!==null?r.bpm:'未确认'}</td><td>${esc(OUTCOMES[r.outcome] || '未评价')}</td><td><a href="${esc(link(group,{session:r.id,records:String(page)}))}">查看</a></td></tr>`).join('')}</tbody></table></div>${count>1?`<nav class="review-pagination" aria-label="练习记录分页">${page>1?`<a class="button secondary" href="${esc(link(group,{records:String(page-1)}))}">上一页</a>`:''}<span>${page} / ${count}</span>${page<count?`<a class="button secondary" href="${esc(link(group,{records:String(page+1)}))}">下一页</a>`:''}</nav>`:''}</section>`;
}
export function lessonReview(logs,course,assignments,params){
  const groups=reviewGroups(logs,assignments),selectedId=params.get('lesson');
  const byId=new Map(course.entries.map(e=>[e.id,e]));
  if(selectedId){
    const versions=groups.filter(g=>g.entryId===selectedId);
    const selected=versions.find(g=>g.version===params.get('version')) || (!params.has('version') && (versions.find(g=>g.current)||versions[0]));
    if(!selected)return '<section class="lesson-review"><h2>这个版本还没有练习记录</h2><a class="button secondary" href="#history">返回全部课程</a></section>';
    const e=byId.get(selected.entryId),last=selected.latestOutcome,bpm=selected.latestTempo;
    return `<section class="lesson-review" data-review-lesson="${esc(selected.entryId)}"><a class="text-link" href="#history">全部课程</a><div class="lesson-review-heading"><h2>${esc(e?shortTitle(e):'未找到课程')}</h2>${params.has('session')?'':`<a class="button primary" href="#practice?lesson=${esc(selected.entryId)}">返回练习台</a>`}</div><label class="review-version-label">练习版本<select id="review-version" aria-label="练习版本">${versions.map(v=>`<option value="${esc(link(v))}" ${v===selected?'selected':''}>${v.current?'当前要求':'历史要求'} · ${esc(v.version)}${e?.legacy?' · 旧版课程':''}</option>`).join('')}</select></label><div class="lesson-metrics"><div><strong>${duration(selected.seconds)}</strong><span>累计 · ${selected.records.length} 次</span></div><div><strong>${bpm?bpm.value+' BPM':'未确认'}</strong><span>${bpm?'最近确认 · '+date(bpm.at):'稳定速度'}</span></div><div><strong>${esc(last?OUTCOMES[last.value]:'未评价')}</strong><span>${last?'最近自评 · '+date(last.at):'熟练程度'}</span></div></div><div class="lesson-charts"><section><h3>累计练习时长</h3>${graph(selected.duration,'duration',selected)}</section><section><h3>自评稳定 BPM</h3><p class="chart-caption">逐次记录；练习段落未区分，不推算提速幅度。</p>${graph(selected.tempo,'tempo',selected)}</section></div><section class="proficiency-section"><h3>熟练程度变化 · 最近在前</h3>${timeline(selected)}</section>${recordsTable(selected,params)}</section>`;
  }
  const filter=Object.hasOwn(filters,params.get('review'))?params.get('review'):'all';
  const visible=groups.filter(g=>filter==='all'||g.status===filter);
  return `<section class="lesson-review"><div class="lesson-review-heading"><h2>每课进展</h2><span>${new Set(groups.map(g=>g.entryId)).size} 节已练课程</span></div><nav class="review-filters" aria-label="课程练习状态">${Object.entries(filters).map(([k,v])=>`<a class="button secondary" href="#history?review=${k}" aria-current="${filter===k?'page':'false'}">${v}<span>${k==='all'?groups.length:groups.filter(g=>g.status===k).length}</span></a>`).join('')}</nav><div class="lesson-progress-list">${visible.map(g=>{const e=byId.get(g.entryId);return `<article class="lesson-progress-row" data-review-group="${esc(g.key)}"><div><h3>${esc(e?shortTitle(e):'未找到课程')}</h3><span class="review-edition">${g.current?'当前要求':'历史要求 · '+esc(g.version)}${e?.legacy?' · 旧版课程':''}</span><p>${esc(g.latestOutcome?OUTCOMES[g.latestOutcome.value]:'未评价')}${g.latestOutcome?' · '+date(g.latestOutcome.at):''}</p></div><div class="review-duration"><strong>${duration(g.seconds)}</strong><span>${g.records.length} 次练习</span><meter min="0" max="${Math.max(1,...groups.map(x=>x.seconds))}" value="${g.seconds}" aria-label="累计练习时长相对本列表最长时长"></meter></div><div class="review-bpm"><strong>${g.latestTempo?g.latestTempo.value+' BPM':'未确认 BPM'}</strong>${g.latestTempo?`<span>自评稳定 · ${date(g.latestTempo.at)}</span>`:''}</div><a class="button secondary" href="${esc(link(g))}" aria-label="查看${esc(e?shortTitle(e):'课程')}变化">查看变化</a></article>`;}).join('')||`<p class="review-empty">${groups.length?'这个分类暂无课程。':'完成第一次练习后，这里会展示每课的变化。'}</p>`}</div></section>`;
}
