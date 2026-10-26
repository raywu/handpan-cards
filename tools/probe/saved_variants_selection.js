#!/usr/bin/env node
// Matched A-B-A trusted-input/frame-opportunity diagnostic. Read the reviewed
// selection-performance plan and browser runbook first. ROOT alone owns browser
// execution under the external180s per-case supervisor/quiet-window lease.
// No production function, storage API, native Promise or browser helper is patched.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),os=require('node:os');
const {execFileSync}=require('node:child_process');
// BEGIN literal timing preflight: no browser, app or timestamp mutation.
const RAF_CALLBACK_REPRESENTATION_TOLERANCE_MS=1e-6; // exactly1ns, never a frame/latency allowance
function timingRepresentation(row){return {firstRAFMinusCallbackMs:row.firstRAF-row.firstCallbackAt,secondRAFMinusCallbackMs:row.secondRAF-row.secondCallbackAt,rafCallbackRepresentationToleranceMs:RAF_CALLBACK_REPRESENTATION_TOLERANCE_MS};}
function validateSelectionTiming(row,previous){
  for(const key of ['eventTimestamp','captureAt','firstRAF','firstCallbackAt','secondRAF','secondCallbackAt'])assert.ok(Number.isFinite(row[key])&&row[key]>0,'finite positive '+key);
  assert.ok(row.captureAt>=row.eventTimestamp&&row.firstCallbackAt>=row.captureAt&&row.secondCallbackAt>=row.firstCallbackAt,'monotonic observation clock');
  const precision=timingRepresentation(row);
  assert.ok(Number.isFinite(precision.firstRAFMinusCallbackMs)&&precision.firstRAFMinusCallbackMs<=RAF_CALLBACK_REPRESENTATION_TOLERANCE_MS&&
    Number.isFinite(precision.secondRAFMinusCallbackMs)&&precision.secondRAFMinusCallbackMs<=RAF_CALLBACK_REPRESENTATION_TOLERANCE_MS&&row.secondRAF>row.firstRAF,'valid monotonically increasing RAF clock');
  if(previous){assert.ok(row.eventTimestamp>previous.eventTimestamp&&row.captureAt>previous.secondCallbackAt&&row.firstRAF>previous.secondRAF,'monotonic clocks across actual Document rows');}
  const intervals={clickToFirstOpportunityMs:row.firstCallbackAt-row.eventTimestamp,clickToAfterOpportunityMs:row.secondCallbackAt-row.eventTimestamp,
    capturedDispatchToFirstOpportunityMs:row.firstCallbackAt-row.captureAt,observedFrameIntervalMs:row.secondRAF-row.firstRAF};
  for(const key of ['clickToFirstOpportunityMs','clickToAfterOpportunityMs','capturedDispatchToFirstOpportunityMs','observedFrameIntervalMs'])assert.ok(Number.isFinite(intervals[key])&&intervals[key]>0,'positive interval, no filtering: '+key);
  return {...precision,...intervals};
}
function timingPreflight(){
  // Retained a0 phone/baseline-before sample17: raw numbers are literal, not rounded.
  const recorded=Object.freeze({eventTimestamp:974,captureAt:974,firstRAF:989.432,firstCallbackAt:991.5,secondRAF:1006.1,secondCallbackAt:1006.0999999046326});
  const firstBoundary={eventTimestamp:1e-8,captureAt:2e-8,firstRAF:2e-6,firstCallbackAt:1e-6,secondRAF:4e-6,secondCallbackAt:4e-6};
  const secondBoundary={eventTimestamp:1e-8,captureAt:2e-8,firstRAF:2e-7,firstCallbackAt:3e-7,secondRAF:2e-6,secondCallbackAt:1e-6};
  assert.equal(firstBoundary.firstRAF-firstBoundary.firstCallbackAt,1e-6,'literal first boundary is exactly1ns');
  assert.equal(secondBoundary.secondRAF-secondBoundary.secondCallbackAt,1e-6,'literal second boundary is exactly1ns');
  const controls=[
    ['retained-a0-row',recorded,true],['first-exact1ns-boundary',firstBoundary,true],['second-exact1ns-boundary',secondBoundary,true],
    ['first-just-over1ns',{...firstBoundary,firstRAF:2.0000000000000003e-6},false],
    ['second-just-over1ns',{...secondBoundary,secondRAF:2.0000000000000003e-6},false],
    ['cross-api2ns',{...recorded,secondCallbackAt:1006.099998},false],['cross-api1us',{...recorded,secondCallbackAt:1006.099},false],
    ['zero-RAF-interval',{...recorded,secondRAF:989.432},false],['backwards-RAF-interval',{...recorded,secondRAF:989.431},false],
    ['zero-first-opportunity',{...recorded,eventTimestamp:991.5,captureAt:991.5},false],
    ['observation-clock-reversal',{...recorded,secondRAF:991.3,secondCallbackAt:991.4},false],
    ['first-RAF-NaN',{...recorded,firstRAF:NaN},false],['second-RAF-Infinity',{...recorded,secondRAF:Infinity},false],
    ['first-callback-Infinity',{...recorded,firstCallbackAt:Infinity},false],['second-callback-NaN',{...recorded,secondCallbackAt:NaN},false],
    ['cross-row-clock-reversal',recorded,false,{eventTimestamp:973,secondCallbackAt:973,secondRAF:990}]
  ];
  return controls.map(([name,row,expected,previous])=>{
    const before=JSON.stringify(row);let accepted=true,errorCode=null;
    try{validateSelectionTiming(row,previous);}catch(error){assert.equal(error.code,'ERR_ASSERTION');accepted=false;errorCode=error.code;}
    assert.equal(accepted,expected,'literal precision preflight '+name);assert.equal(JSON.stringify(row),before,'raw preflight timestamps unchanged');
    return {name,expectedAccepted:expected,accepted,errorCode,...timingRepresentation(row)};
  });
}
const timingPreflightControls=timingPreflight();
// END literal timing preflight.
const FLAGS=['--repo','--baseline-ref','--baseline-source-sha','--source-sha','--case','--case-sha','--out'],options={};
for(let i=2;i<process.argv.length;i+=2){const flag=process.argv[i],value=process.argv[i+1];assert.ok(FLAGS.includes(flag)&&value&&!Object.hasOwn(options,flag),'explicit nonduplicate known arguments');options[flag]=value;}
for(const flag of FLAGS)assert.ok(options[flag],'required '+flag);
for(const flag of ['--repo','--case','--out'])assert.ok(path.isAbsolute(options[flag]),'absolute '+flag);
for(const flag of ['--baseline-source-sha','--source-sha','--case-sha'])assert.match(options[flag],/^[0-9a-f]{64}$/);
assert.match(options['--baseline-ref'],/^[0-9a-f]{40}$/,'explicit immutable40-character baseline ref');
const BASE_REF='92d6516bd533abb4a1e4fb7c8116b9836f648296',BASE_SHA='5628f31deed911e7e406ce852fe0daee5d6fcf1caa26d2fb0f182a823c0894b3';
assert.equal(options['--baseline-ref'],BASE_REF,'frozen baseline ref');assert.equal(options['--baseline-source-sha'],BASE_SHA,'frozen baseline source');
const REPO=fs.realpathSync(options['--repo']),OUT=path.join(fs.realpathSync(path.dirname(options['--out'])),path.basename(options['--out']));
const relative=path.relative(REPO,OUT);assert.ok(relative!==''&&(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)),'canonical output outside candidate');
const exists=file=>{try{fs.lstatSync(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
assert.ok(!exists(OUT)&&!exists(OUT+'.part'),'fresh output and part paths');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),q=JSON.stringify;
const candidate=fs.readFileSync(path.join(REPO,'index.html'));assert.equal(sha(candidate),options['--source-sha'],'reviewed candidate source bytes');
// No shell, network fetch, checkout, branch write or mutable ref resolution.
const baseline=execFileSync('git',['-C',REPO,'show',BASE_REF+':index.html'],{maxBuffer:10*1024*1024});assert.equal(sha(baseline),BASE_SHA,'actual immutable local-Git baseline bytes');
const rawCase=fs.readFileSync(options['--case']);assert.equal(sha(rawCase),options['--case-sha'],'frozen case bytes');const input=JSON.parse(rawCase);
const CASES={0:'60c672265a23c119dedf4e01b185558992cbe2d0c8bd77aafdf063491833925f',2:'d0a409b66497543be0c75b33a6ec2b065b7ee02425a0a30f242e028e90cfb815',20:'0416c0a3b81d1a041e215b7f167e5bcf2773c5169efd6b5f0f6350fde5ff39ee',200:'fe4d93aa04799755efbec31273cd778444ca9fada264cb958096b479ded7b320'};
assert.ok(Object.hasOwn(CASES,input.recordCount),'only frozen0/2/20/200 cases');assert.equal(options['--case-sha'],CASES[input.recordCount]);
const KEYS=['hpfc','hpfc.scales','hpfc.scales.v3'];assert.deepEqual(Object.keys(input.sources).sort(),[...KEYS].sort());
for(const key of KEYS)assert.ok(input.sources[key]===null||typeof input.sources[key]==='string');
if(input.recordCount===0){assert.equal(input.kind,'selection-empty');for(const key of KEYS)assert.equal(input.sources[key],null);}
else {assert.equal(input.kind,'records');assert.equal(JSON.parse(input.sources['hpfc.scales.v3']).length,input.recordCount);}
const expectedCounts={baseline:({0:5,2:7,20:8,200:8})[input.recordCount],candidate:5+input.recordCount};
const HELPER_SHA='178e034c3d9395bd92a7250b50b8ec5858bb177bb6678e500870699701b50826',helperPath=path.join(REPO,'tests/helpers/cdp.js');assert.equal(sha(fs.readFileSync(helperPath)),HELPER_SHA,'independently reviewed browser helper');
for(const key of ['NODE_OPTIONS','E2E_PORT','HPC_COVERAGE_DIR','NODE_V8_COVERAGE','NODE_SUITE_TIMEOUT','HPFC_CDP_PORT_TIMEOUT_MS'])assert.ok(!process.env[key],'unset inherited '+key);
const helper=require(helperPath);assert.ok(helper.findBrowser(),'required browser, no skip');
const BUILTINS=[{id:'kurd',name:'D KURD 10',cards:49},{id:'amara10',name:'D AMARA 10',cards:29},{id:'amara',name:'D AMARA 9',cards:27},{id:'hijaz',name:'C# HIJAZ 9',cards:19},{id:'pygmy',name:'F3 LOW PYGMY 18',cards:53}];
const MODES=[{name:'desktop',width:900,height:900,mobile:false},{name:'phone',width:380,height:780,mobile:true}];
const nearestRank=(values,p)=>{assert.ok(values.length);return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];};
const median=values=>{assert.ok(values.length);const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;};
const hostLoad=()=>({at:new Date().toISOString(),loadAverage:os.loadavg(),freeMemoryBytes:os.freemem(),logicalCPUs:os.cpus().length});
const report={timingPrecision:{rafCallbackRepresentationToleranceMs:RAF_CALLBACK_REPRESENTATION_TOLERANCE_MS,meaning:'Fixed1ns only for RAF timestamp minus corresponding callback-clock sanity ordering; all raw values/strict intervals/statistics/budgets unchanged. Engineering cap, not proof of Chromium cause.',controls:timingPreflightControls},contract:'saved-variants-selection-aba-v1',started:new Date().toISOString(),baselineRef:BASE_REF,baselineSourceSHA256:BASE_SHA,candidateSourceSHA256:options['--source-sha'],helperSHA256:HELPER_SHA,case:input.id,caseSHA256:options['--case-sha'],recordCount:input.recordCount,expectedCounts,requiredRows:180,requiredDocuments:6,rows:[],documents:[],resets:[],arms:[],comparisons:[],quietWindows:[],cleanup:false,
  backendPureBuildBench:{executedHere:false,tool:'tools/probe/saved_variants_storage.js',caseSHA256:options['--case-sha'],candidateSourceSHA256:options['--source-sha'],meaning:'Attach the separately source-bound backend parse/normalize-build/serialize receipt. These independent pure benches are not selection CPU subphases; empty case has no migration record build.'}};
let browser=null,server=null,origin=null,bodyArm=null,failure=null;
function prelude(){return `(()=>{if(location.origin!==${q(origin)})return;const sources=${q(input.sources)};
  for(const key of ${q(KEYS)}){if(sources[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,sources[key]);}
  window.__svSelectionSeededSources=Object.fromEntries(${q(KEYS)}.map(key=>[key,localStorage.getItem(key)]));
  window.__svSelectionFixtureReadyAt=performance.now();})();`;}
async function blankAndReset(mode,arm){
  const navigation=await browser.send('Page.navigate',{url:'about:blank'});assert.ok(!navigation.errorText);
  await browser.waitFor('location.href==="about:blank"&&document.readyState==="complete"',{timeout:5000,label:'explicit blank before owned reset'});
  const owned=new URL(origin);assert.equal(owned.protocol,'http:');assert.equal(owned.hostname,'127.0.0.1');assert.equal(Number(owned.port),server.address().port);assert.equal(owned.origin,origin);
  await browser.send('Storage.clearDataForOrigin',{origin,storageTypes:'local_storage,indexeddb'});
  report.resets.push({mode:mode.name,arm,origin,afterBlank:true,storageTypes:'local_storage,indexeddb',cdpAcknowledged:true});
}
async function actualDocument(mode,arm){
  const target=origin+'/#deck=d-kurd-10',session=browser.sessionId,source=arm==='candidate'?candidate:baseline,sourceSHA=sha(source);
  let navigation=null,load=false,settled=false,resolve,reject;
  const responses=new Map(),finished=new Set(),loaded=new Promise((r,j)=>{resolve=r;reject=j;});loaded.catch(()=>{});
  const ready=()=>{if(settled||!navigation||!load)return;for(const[id,response]of responses)if(response.frameId===navigation.frameId&&response.loaderId===navigation.loaderId&&finished.has(id)){settled=true;resolve({requestId:id,...response});return;}};
  const listener=event=>{try{const m=JSON.parse(event.data);if(m.sessionId!==session)return;const p=m.params||{};
    if(m.method==='Network.responseReceived'&&p.type==='Document')responses.set(p.requestId,p);
    if(m.method==='Network.loadingFinished')finished.add(p.requestId);
    if(m.method==='Network.loadingFailed'&&responses.has(p.requestId)){settled=true;reject(new Error('actual Document failed '+p.errorText));}
    if(m.method==='Page.loadEventFired')load=true;ready();}catch(error){settled=true;reject(error);}};
  browser.ws.addEventListener('message',listener);const timeout=setTimeout(()=>{settled=true;reject(new Error('actual Document binding exceeded20000ms'));},20000);
  const navigationStarted=process.hrtime.bigint();
  try{
    navigation=await browser.send('Page.navigate',{url:target});assert.ok(!navigation.errorText&&navigation.frameId&&navigation.loaderId);ready();
    const doc=await loaded,received=new URL(doc.response.url);assert.equal(doc.response.status,200);assert.equal(received.origin,origin);assert.equal(received.pathname,'/');assert.equal(received.search,'');
    assert.equal(!!doc.response.fromDiskCache,false);assert.equal(!!doc.response.fromServiceWorker,false);
    const body=await browser.send('Network.getResponseBody',{requestId:doc.requestId});const bytes=Buffer.from(body.body,body.base64Encoded?'base64':'utf8');assert.equal(sha(bytes),sourceSHA,'actual loaded source bytes');
    const frame=(await browser.send('Page.getFrameTree')).frameTree.frame;assert.equal(frame.id,navigation.frameId);assert.equal(frame.loaderId,navigation.loaderId);
    const receipt={number:report.documents.length+1,mode:mode.name,arm,requestId:doc.requestId,frameId:frame.id,loaderId:frame.loaderId,sourceSHA256:sourceSHA,status:200,bytes:bytes.length,fromDiskCache:false,fromServiceWorker:false};report.documents.push(receipt);
    await browser.waitFor(helper.APP_READY_EXPR+'&&document.querySelectorAll("#decks .chip").length==='+expectedCounts[arm==='candidate'?'candidate':'baseline']+(arm==='candidate'?'&&typeof savedMode!=="undefined"&&savedMode==="durable"':''),{timeout:15000,label:'source-bound app and full expected collection readiness'});
    const cold=await browser.eval('return {documentReadyAt:performance.now(),fixtureReadyAt:window.__svSelectionFixtureReadyAt,seededSources:window.__svSelectionSeededSources,initialDeck:deck().id,visible:document.visibilityState,viewportScale:visualViewport?visualViewport.scale:1};');
    assert.deepEqual(cold.seededSources,input.sources,'actual pre-app legacy source strings match the same immutable fixture');
    receipt.seededSourceAccounting=Object.fromEntries(KEYS.map(key=>[key,cold.seededSources[key]===null?null:{utf8Bytes:Buffer.byteLength(cold.seededSources[key],'utf8'),utf16CodeUnits:cold.seededSources[key].length,sha256Utf8:sha(Buffer.from(cold.seededSources[key],'utf8'))}]));delete cold.seededSources;
    assert.equal(cold.initialDeck,'kurd');assert.equal(cold.visible,'visible');assert.equal(cold.viewportScale,1);assert.ok(Number.isFinite(cold.fixtureReadyAt)&&cold.documentReadyAt>=cold.fixtureReadyAt);
    receipt.coldReadiness={...cold,hostNavigationToObservedReadyMs:Number(process.hrtime.bigint()-navigationStarted)/1e6,fixtureToObservedReadyMs:cold.documentReadyAt-cold.fixtureReadyAt};return receipt;
  }finally{clearTimeout(timeout);browser.ws.removeEventListener('message',listener);}
}
async function preflight(expected){
  const wanted=q(expected.name);
  assert.equal(await browser.eval(`const matches=[...document.querySelectorAll('#decks .chip')].filter(el=>el.textContent.trim()===${wanted});
    if(matches.length!==1)return false;matches[0].scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});return true;`),true,'unique literal builtin target');
  await browser.settle();
  const state=await browser.eval(`const matches=[...document.querySelectorAll('#decks .chip')].filter(el=>el.textContent.trim()===${wanted});
    if(matches.length!==1)throw new Error('literal target changed');const el=matches[0],r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,style=getComputedStyle(el),hit=document.elementFromPoint(x,y);
    return {x,y,text:el.textContent.trim(),selected:el.classList.contains('on'),enabled:!el.matches(':disabled'),inert:!!el.closest('[inert]'),hidden:document.hidden,
      visible:el.getClientRects().length>0&&style.display!=='none'&&style.visibility!=='hidden'&&r.width>0&&r.height>0,
      inViewport:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,hit:!!hit&&(hit===el||el.contains(hit))};`);
  const {x,y,...flags}=state;assert.ok(Number.isFinite(x)&&Number.isFinite(y));
  assert.deepEqual(flags,{text:expected.name,selected:false,enabled:true,inert:false,hidden:false,visible:true,inViewport:true,hit:true},'visible unselected literal builtin actual hit target');return {x,y};
}
async function installObserver(){
  await browser.eval(`window.__svSelectionMeasurement={armed:null,rows:[]};
    document.addEventListener('click',event=>{
      const state=window.__svSelectionMeasurement;if(!state.armed)return;
      const chip=event.target.closest&&event.target.closest('#decks .chip');if(!chip)return;
      const armed=state.armed;state.armed=null;
      const row={sample:armed.sample,expectedId:armed.expectedId,clickedText:chip.textContent.trim(),trusted:event.isTrusted,
        eventTimestamp:event.timeStamp,captureAt:performance.now(),visibilityAtClick:document.visibilityState};
      requestAnimationFrame(frame1=>{
        row.firstRAF=frame1;row.firstCallbackAt=performance.now();row.firstDeckId=deck().id;
        row.firstSheetHidden=document.getElementById('scale-sheet').hidden;row.firstChipText=(document.querySelector('#decks .chip.on')||{}).textContent||'';
        row.firstSelectedChipCount=document.querySelectorAll('#decks .chip.on').length;row.firstChipCount=document.querySelectorAll('#decks .chip').length;
        row.firstCount=document.getElementById('count').textContent;row.visibilityAtFirst=document.visibilityState;
        requestAnimationFrame(frame2=>{
          row.secondRAF=frame2;row.secondCallbackAt=performance.now();row.secondDeckId=deck().id;row.secondSheetHidden=document.getElementById('scale-sheet').hidden;
          row.secondChipText=(document.querySelector('#decks .chip.on')||{}).textContent||'';row.secondSelectedChipCount=document.querySelectorAll('#decks .chip.on').length;
          row.secondChipCount=document.querySelectorAll('#decks .chip').length;row.secondCount=document.getElementById('count').textContent;
          row.visibilityAtSecond=document.visibilityState;state.rows.push(row);
        });
      });
    },true);return true;`);
}
async function drainPreference(arm,expected,secondCallbackAt=null){
  return browser.eval(`return (async()=>{
    const started=performance.now(),deadline=started+5000,attempts=[];let timedOut=false;
    const once=async()=>{
      const start=performance.now();
      if(${q(arm)}!=='candidate'){
        const raw=localStorage.getItem('hpfc');let parsed=null;try{parsed=raw===null?null:JSON.parse(raw);}catch(error){throw new Error('baseline preference malformed');}
        return {start,observedAt:performance.now(),kind:'localStorage-hpfc.deck',preference:parsed&&parsed.deck};
      }
      return new Promise((resolve,reject)=>{
        const request=indexedDB.open('hpfc.saved-scales.v1');let db=null;
        request.onupgradeneeded=()=>{request.transaction.abort();reject(new Error('candidate preference database absent'));};
        request.onblocked=()=>reject(new Error('candidate preference open blocked'));
        request.onerror=()=>reject(request.error||new Error('candidate preference open failed'));
        request.onsuccess=()=>{
          db=request.result;if(timedOut){db.close();return;}
          let tx;try{
            if(db.version!==1||db.objectStoreNames.length!==1||!db.objectStoreNames.contains('collections'))throw new Error('candidate preference schema mismatch');
            tx=db.transaction('collections','readonly');const store=tx.objectStore('collections');
            if(store.keyPath!==null||store.autoIncrement!==false)throw new Error('candidate preference store mismatch');
            let raw,key;store.get('current').onsuccess=event=>{raw=event.target.result;};store.getKey('current').onsuccess=event=>{key=event.target.result;};
            tx.onabort=()=>{db.close();reject(tx.error||new Error('candidate preference read aborted'));};tx.onerror=()=>{};
            tx.oncomplete=()=>{db.close();try{
              if(key!=='current'||typeof raw!=='string')throw new Error('candidate current absent/nonstring');
              const value=JSON.parse(raw);if(value.schema!==1)throw new Error('candidate envelope schema mismatch');
              resolve({start,observedAt:performance.now(),kind:'completed-idb-getKey/get',keyPresent:true,collectionId:value.collectionId,revision:value.revision,preference:value.preferredSelection});
            }catch(error){reject(error);}};
          }catch(error){if(tx)try{tx.abort();}catch(_){}db.close();reject(error);}
        };
      });
    };
    let timer;
    try{return await Promise.race([(async()=>{
      while(performance.now()<deadline){
        const value=await once();attempts.push(value);const preference=value.preference;
        const matched=${q(arm)}==='candidate'?preference&&preference.kind==='builtin'&&preference.id===${q(expected.id)}:preference===${q(expected.id)};
        if(matched){const completedAt=performance.now();return {expectedBuiltin:{kind:'builtin',id:${q(expected.id)}},startedAt:started,completedAt,
          durationMs:completedAt-started,observationDelaySinceSecondCallbackMs:${q(secondCallbackAt)}===null?null:completedAt-${q(secondCallbackAt)},attempts,
          meaning:'Preference observed in actual storage after timed row; observation delay is not exact native commit time or physical disk flush.'};}
        await new Promise(resolve=>setTimeout(resolve,5));
      }throw new Error('persisted preference did not match before5000ms');
    })(),new Promise((resolve,reject)=>{timer=setTimeout(()=>{timedOut=true;reject(new Error('persisted preference drain exceeded5000ms'));},5000);})]);}
    finally{clearTimeout(timer);}
  })();`);
}
function summary(rows){
  assert.equal(rows.length,30);return {executed:rows.length,firstOpportunityP95Ms:nearestRank(rows.map(row=>row.clickToFirstOpportunityMs),.95),afterOpportunityP95Ms:nearestRank(rows.map(row=>row.clickToAfterOpportunityMs),.95),
    firstOpportunityMaxMs:Math.max(...rows.map(row=>row.clickToFirstOpportunityMs)),afterOpportunityMaxMs:Math.max(...rows.map(row=>row.clickToAfterOpportunityMs)),
    observedFrameMedianMs:median(rows.map(row=>row.observedFrameIntervalMs)),drainP95Ms:nearestRank(rows.map(row=>row.drain.durationMs),.95)};
}
async function measureArm(mode,arm){
  bodyArm=arm==='candidate'?'candidate':'baseline';await blankAndReset(mode,arm);await browser.send('Page.bringToFront');
  const document=await actualDocument(mode,arm);await browser.settle();document.initialPreferenceDrain=await drainPreference(arm,BUILTINS[0]);
  await installObserver();const measured=[];let previous=null;
  for(let index=0;index<30;index++){
    const expected=BUILTINS[(index+1)%5];assert.notEqual(await browser.eval('return deck().id;'),expected.id,'every trusted click changes deck');
    const box=await preflight(expected);await browser.eval('window.__svSelectionMeasurement.armed='+q({sample:index+1,expectedId:expected.id})+';return true;');
    // Same trusted coordinate dispatch as Browser.click, after literal hit check.
    for(const type of ['mousePressed','mouseReleased'])await browser.send('Input.dispatchMouseEvent',{type,...box,button:'left',clickCount:1});
    await browser.waitFor('window.__svSelectionMeasurement.rows.length==='+String(index+1),{timeout:5000,label:'trusted selection and two actual RAF observations'});
    const observed=await browser.eval('return window.__svSelectionMeasurement.rows['+index+'];');
    // Retain a timed row BEFORE its validation/drain: no bad outcome is dropped.
    const row={mode:mode.name,arm,documentNumber:document.number,...observed,...timingRepresentation(observed)};report.rows.push(row);measured.push(row);
    assert.equal(row.sample,index+1);assert.equal(row.trusted,true);assert.equal(row.clickedText,expected.name);assert.equal(row.expectedId,expected.id);
    for(const prefix of ['first','second']){
      assert.equal(row[prefix+'DeckId'],expected.id);assert.equal(row[prefix+'SheetHidden'],true);assert.equal(row[prefix+'ChipText'].trim(),expected.name);
      assert.equal(row[prefix+'SelectedChipCount'],1);assert.equal(row[prefix+'ChipCount'],expectedCounts[bodyArm]);assert.equal(row[prefix+'Count'].trim(),'1 / '+expected.cards,'literal builtin card counter after changed selection');
    }
    for(const key of ['visibilityAtClick','visibilityAtFirst','visibilityAtSecond'])assert.equal(row[key],'visible');
    Object.assign(row,validateSelectionTiming(row,previous));
    row.drain=await drainPreference(arm,expected,row.secondCallbackAt);assert.ok(Number.isFinite(row.drain.durationMs)&&row.drain.durationMs>=0);assert.ok(row.drain.observationDelaySinceSecondCallbackMs>0);
    assert.ok(row.drain.startedAt>=row.secondCallbackAt&&row.drain.completedAt>=row.drain.startedAt,'drain clock follows the timed row');
    let previousDrainAt=row.drain.startedAt;
    for(const attempt of row.drain.attempts){assert.ok(Number.isFinite(attempt.start)&&Number.isFinite(attempt.observedAt)&&attempt.start>=previousDrainAt&&attempt.observedAt>=attempt.start,'monotonic actual preference observation');previousDrainAt=attempt.observedAt;}
    assert.ok(row.drain.completedAt>=previousDrainAt);
    previous=row;console.log('SELECTION_SAMPLE '+q(row));
  }
  const result={mode:mode.name,arm,documentNumber:document.number,...summary(measured)};report.arms.push(result);return measured;
}
(async()=>{
  try{
    server=http.createServer((request,response)=>{
      const url=new URL(request.url,'http://127.0.0.1');if(request.method!=='GET'||url.pathname!=='/'||url.search){response.writeHead(404);response.end();return;}
      const body=bodyArm==='candidate'?candidate:baseline;response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});response.end(body);
    });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;report.origin=origin;
    browser=await helper.launch({foregroundSettle:true});assert.ok(browser);console.log('SELECTION_OWNED '+q({pid:browser.proc.pid,pgid:browser.proc.pid,profile:browser.profileDir}));
    report.browser=await browser.send('Browser.getVersion',{},false);await browser.send('Network.enable');await browser.send('Network.setCacheDisabled',{cacheDisabled:true});
    const script=await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:prelude()});assert.ok(script.identifier);
    for(const mode of MODES){
      const quiet={mode:mode.name,requiresExternallyCoordinatedQuietWindow:true,before:hostLoad(),limits:'No competing agent tests/benchmarks permitted by root coordination. Unknown owner processes are preserved; load snapshots do not prove absence of contention.'};report.quietWindows.push(quiet);
      await browser.setViewport(mode.width,mode.height,mode.mobile);
      const before=await measureArm(mode,'baseline-before'),candidateRows=await measureArm(mode,'candidate'),after=await measureArm(mode,'baseline-after');quiet.after=hostLoad();
      const pooled=[...before,...after],frame=median(pooled.map(row=>row.observedFrameIntervalMs));assert.ok(Number.isFinite(frame)&&frame>0);
      const a=summary(before),b=summary(candidateRows),c=summary(after),comparison={mode:mode.name,pooledBaselineRows:pooled.length,pooledMedianObservedFrameMs:frame,baselineBefore:a,candidate:b,baselineAfter:c,metrics:{}};
      for(const [metric,field]of [['first','clickToFirstOpportunityMs'],['after','clickToAfterOpportunityMs']]){
        const beforeP95=nearestRank(before.map(row=>row[field]),.95),afterP95=nearestRank(after.map(row=>row[field]),.95),pooledP95=nearestRank(pooled.map(row=>row[field]),.95),candidateP95=nearestRank(candidateRows.map(row=>row[field]),.95);
        comparison.metrics[metric]={beforeP95,afterP95,pooledP95,candidateP95,pooledMaxMs:Math.max(...pooled.map(row=>row[field])),candidateMaxMs:Math.max(...candidateRows.map(row=>row[field])),baselineDriftMs:Math.abs(afterP95-beforeP95),unstable:Math.abs(afterP95-beforeP95)>frame,limitMs:pooledP95+frame,passes:candidateP95<=pooledP95+frame};
      }
      comparison.stable=Object.values(comparison.metrics).every(metric=>!metric.unstable);comparison.passes=comparison.stable&&Object.values(comparison.metrics).every(metric=>metric.passes);report.comparisons.push(comparison);
      assert.equal(comparison.stable,true,'baseline arm drift exceeds pooled median observed frame: unstable/not validated');assert.equal(comparison.passes,true,'candidate exceeds pooled baseline p95 plus median observed-frame allowance');
    }
    helper.assertNoUncaught();assert.equal(report.rows.length,180);assert.equal(report.documents.length,6);assert.equal(report.resets.length,6);assert.equal(report.arms.length,6);
  }catch(error){failure=error;console.error(error.stack||String(error));}
  finally{
    let browserClean=!browser,serverClean=!server;
    if(browser){const profile=browser.profileDir;try{await browser.close();assert.equal(fs.existsSync(profile),false);browserClean=true;}catch(error){failure ||=error;}}
    if(server){try{await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});serverClean=true;}catch(error){failure ||=error;}}
    report.cleanup=browserClean&&serverClean;report.finished=new Date().toISOString();report.status=failure||!report.cleanup?'FAILED':'PASS';if(failure)report.error=String(failure.stack||failure);
    report.limits='Owned headless Chromium/fallback fonts/foreground trusted mouse; phone viewport is simulated, not native touch/iOS/Safari. First RAF is a paint opportunity; second permits an intervening opportunity, neither proves compositor presentation. Baseline5/7/8/8 vs candidate5/7/25/205 chips intentionally differs. All timed rows retained before independent actual-storage preference drain; drain delay is observation time, not native commit or physical flush. No app/cache/queued-lock hook or storage API patched. Only RAF timestamp-minus-corresponding callback-clock ordering permits fixed1ns representation difference; both raw deltas and allowance are recorded. All same-clock/RAF-increase/positive-interval guards remain strict. Clock/RAF intervals must be finite positive without filtering; nearest-rank p95 and conventional median fixed. A-B-A drift over one pooled median observed frame is unstable/not validated, never favorable-arm selection. Cold readiness and independent backend pure-build reference are separate; no selection CPU attribution. Root alone coordinates quiet window/host browser lease and external180s per-case supervisor; this tool grants no execution/budget increase. Owner processes preserved; host load snapshots cannot prove quietness. Final exact-head CI and actual DEV/device qualification remain separate.';
    fs.writeFileSync(OUT+'.part',JSON.stringify(report,null,2),{flag:'wx'});
    try{fs.linkSync(OUT+'.part',OUT);fs.unlinkSync(OUT+'.part');}catch(error){console.error('SELECTION_PUBLICATION_FAILED '+String(error.stack||error));process.exitCode=1;return;}
    console.log('SELECTION_SUMMARY '+q({status:report.status,executed:report.rows.length,documents:report.documents.length,cleanup:report.cleanup,out:OUT}));if(failure||!report.cleanup)process.exitCode=1;
  }
})();
