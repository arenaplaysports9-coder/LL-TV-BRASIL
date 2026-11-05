// Inserts at most one spot per rule at each programme boundary where the
// configured interval has elapsed. Missed break points are not emitted as a
// burst after a long file; the next break is scheduled from this boundary.
function composeWithCommercials(programItems, commercialRows) {
  if (!Array.isArray(programItems) || !programItems.length) return [];
  const rules=(commercialRows||[]).filter(x=>x.enabled!==false && x.file_path && Number(x.insertion_interval_minutes)>0)
    .map(x=>({...x,interval:Number(x.insertion_interval_minutes)*60,nextDue:Number(x.insertion_interval_minutes)*60}))
    .sort((a,b)=>a.interval-b.interval);
  if (!rules.length) return programItems;
  const output=[]; let programmeElapsed=0;
  for (const item of programItems) {
    output.push(item); programmeElapsed+=Math.max(0,Number(item.duration_seconds)||0);
    for (const rule of rules) {
      if(programmeElapsed>=rule.nextDue){
        output.push({...rule,title:`COMERCIAL — ${rule.advertiser}: ${rule.title}`,is_commercial:true});
        rule.nextDue=programmeElapsed+rule.interval;
      }
    }
  }
  return output;
}
module.exports={composeWithCommercials};
