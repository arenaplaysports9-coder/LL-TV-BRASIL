const test=require('node:test');
const assert=require('node:assert/strict');
const {composeWithCommercials}=require('../src/services/commercial-inserter');
const modules=require('../src/services/broadcast-modules');

test('commercial insertion schedules at programme boundaries',()=>{
 const programme=[{title:'A',duration_seconds:900},{title:'B',duration_seconds:900},{title:'C',duration_seconds:900}];
 const ads=[{media_asset_id:'ad1',title:'spot',advertiser:'LLTV',file_path:'/tmp/ad.mp4',insertion_interval_minutes:10,enabled:true}];
 const result=composeWithCommercials(programme,ads);
 assert.equal(result.filter(x=>x.is_commercial).length,3);
 assert.equal(result[1].is_commercial,true);
 assert.equal(result[3].is_commercial,true);assert.equal(result[5].is_commercial,true);
});
test('commercial insertion ignores disabled rules and leaves programme unchanged',()=>{
 const p=[{title:'A',duration_seconds:1200}];
 assert.deepEqual(composeWithCommercials(p,[{enabled:false,insertion_interval_minutes:1,file_path:'/x'}]),p);
});
test('graphics state clamps scores and limits text fields',()=>{
 const g=modules.setGraphics('test-channel',{lowerThird:'x'.repeat(300),scoreboard:{homeScore:150,awayScore:-3}});
 assert.equal(g.lowerThird.length,180);assert.equal(g.scoreboard.homeScore,99);assert.equal(g.scoreboard.awayScore,0);
});
test('SRT ingest rejects non-SRT protocols',()=>{
 assert.throws(()=>modules.startSrtIngest({channelId:'test',inputUrl:'rtmp://example.com/live',mode:'listener'}),/somente SRT/);
});
test('Preview state is isolated by channel',()=>{
 modules.setPreview('channel-a',{id:'1',title:'Preview A',file_path:require('node:path').resolve('package.json')});
 const state=modules.getPreview('channel-a').preview;
 assert.equal(state.title,'Preview A');
 assert.ok(state.url);
 const token=state.url.split('/').at(-1);
 assert.ok(modules.getPreviewFile('channel-a',token));
 assert.equal(modules.getPreviewFile('channel-a','wrong-token'),null);
 assert.equal(modules.getPreview('channel-b').preview,null);
});
