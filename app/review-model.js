// Derived views only: never mutate records or infer proficiency from elapsed time.
export function reviewGroups(logs, assignments) {
  const current = new Map(assignments.map(a => [a.entryId, a.version]));
  const groups = new Map();
  for (const log of logs) {
    if (log.deletedAt) continue;
    const key = JSON.stringify([log.entryId, log.assignmentVersion]);
    if (!groups.has(key)) groups.set(key, {key, entryId:log.entryId, version:log.assignmentVersion, records:[]});
    groups.get(key).records.push(log);
  }
  return [...groups.values()].map(group => {
    const records = [...group.records].sort((a,b) => Date.parse(a.practicedAt)-Date.parse(b.practicedAt) || Date.parse(a.createdAt)-Date.parse(b.createdAt) || a.id.localeCompare(b.id));
    let seconds = 0;
    const duration = records.map(record => {
      seconds += record.source === 'timer' ? record.seconds : record.minutes * 60;
      return {id:record.id, at:record.practicedAt, value:seconds};
    });
    const tempo = records.filter(r => r.bpmBasis === 'self-reported-stable' && Number.isFinite(r.bpm) && r.bpm > 0)
      .map(r => ({id:r.id, at:r.practicedAt, value:r.bpm}));
    const outcomes = records.filter(r=>r.outcome != null).map(r=>({id:r.id,at:r.practicedAt,value:r.outcome}));
    const latestOutcome = outcomes.at(-1) || null;
    const status = !latestOutcome ? 'unrated' : latestOutcome.value === 'mastered' ? 'mastered' : 'continue';
    return {...group, records, duration, tempo, outcomes, seconds, latestOutcome, latestTempo:tempo.at(-1)||null,
      lastAt:records.at(-1).practicedAt, current:current.get(group.entryId)===group.version, status};
  }).sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt)||a.key.localeCompare(b.key));
}

export function chartCoordinates(points, {zero = false} = {}) {
  if (!points.length) return [];
  const from = Date.parse(points[0].at), to = Date.parse(points.at(-1).at);
  const values = points.map(p=>p.value), max = Math.max(...values);
  const min = zero ? 0 : Math.min(...values);
  const low = zero ? 0 : Math.max(0, min-5), high = Math.max(low+1, max+(zero ? 0 : 5));
  return points.map(p=>({...p,x:to===from?320:56+(Date.parse(p.at)-from)/(to-from)*548,y:176-(p.value-low)/(high-low)*142}));
}
