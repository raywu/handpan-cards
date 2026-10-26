#!/usr/bin/env node
// Bounded backend measurement for independently generated saved-variant cases.
// See docs/plans/2026-10-25-saved-scale-variants.md, Backend measurement gate.
// Explicit absolute --repo/--case/--out paths and reviewed source/case SHA-256s
// are mandatory. Produce cases with saved_variants_cases.py first. Evidence must
// go outside the candidate. Run only under the integrator's sole browser lease
// and reviewed external supervisor; this CLI grants neither concurrency nor time.
// No application function is patched: native Web Locks receive the same call.
// Port-only output hardening: canonical-parent containment and atomic exclusive
// final publication. An existing destination is never overwritten; a failed
// publication leaves the owned .part evidence and exits nonzero.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const options={};
for(let i=2;i<process.argv.length;i+=2){
  const flag=process.argv[i],value=process.argv[i+1];
  assert.ok(['--repo','--case','--case-sha','--source-sha','--out'].includes(flag)&&value&&!Object.hasOwn(options,flag),'explicit nonduplicate known arguments');
  options[flag]=value;
}
for(const flag of ['--repo','--case','--case-sha','--source-sha','--out'])assert.ok(options[flag],'required '+flag);
for(const flag of ['--repo','--case','--out'])assert.ok(path.isAbsolute(options[flag]),'absolute '+flag);
for(const flag of ['--case-sha','--source-sha'])assert.match(options[flag],/^[0-9a-f]{64}$/);
const REPO=fs.realpathSync(options['--repo']);
// Resolve the existing parent before checking containment: a lexical outside
// path may traverse a symlink back into the candidate. Use that canonical path
// for output too; no browser or server can start before these checks pass.
const OUT=path.join(fs.realpathSync(path.dirname(options['--out'])),path.basename(options['--out']));
const outputRelative=path.relative(REPO,OUT);
assert.ok(outputRelative!==''&&(outputRelative==='..'||outputRelative.startsWith('..'+path.sep)||path.isAbsolute(outputRelative)),
  'measurement output outside candidate source (canonical parent)');
const exists=p=>{try{fs.lstatSync(p);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
assert.ok(!exists(OUT)&&!exists(OUT+'.part'),'fresh output and part paths');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const bytes=fs.readFileSync(path.join(REPO,'index.html'));
assert.equal(sha(bytes),options['--source-sha'],'reviewed immutable candidate source bytes');
const rawCase=fs.readFileSync(options['--case']);assert.equal(sha(rawCase),options['--case-sha'],'independently frozen case artifact');
const input=JSON.parse(rawCase);
// One independently extracted case per invocation; --case-sha binds its exact bytes.
assert.ok(input.expectedEnvelope&&Number.isSafeInteger(input.expectedEnvelope.utf8Bytes)&&input.expectedEnvelope.utf8Bytes>0);
assert.ok(Number.isSafeInteger(input.expectedEnvelope.utf16CodeUnits)&&input.expectedEnvelope.utf16CodeUnits>0);
assert.ok(input&&['records','envelope-1mib'].includes(input.kind));
assert.ok(typeof input.id==='string'&&Number.isSafeInteger(input.recordCount)&&input.recordCount>0);
assert.ok(Number.isSafeInteger(input.expectedReadableCount)&&input.expectedReadableCount>0&&input.expectedReadableCount<=input.recordCount);
if(input.kind==='records'){
  assert.ok([2,20,200].includes(input.recordCount));assert.equal(input.expectedReadableCount,input.recordCount,'small/medium/large cases must exercise readable variants');
}else assert.equal(input.expectedEnvelope?.utf8Bytes,1048576,'stress means FINAL serialized envelope is exactly1MiB');
const KEY='hpfc.saved-scales.v1',LOCK='handpan-cards:saved-scales:v1';
const SOURCE_KEYS=['hpfc','hpfc.scales','hpfc.scales.v3'];
assert.deepEqual(Object.keys(input.sources).sort(),[...SOURCE_KEYS].sort());
assert.deepEqual(Object.keys(input.expectedSources).sort(),[...SOURCE_KEYS].sort());
const account=s=>({utf8Bytes:Buffer.byteLength(s,'utf8'),utf16CodeUnits:s.length,sha256Utf8:sha(Buffer.from(s,'utf8'))});
for(const key of SOURCE_KEYS){
  const raw=input.sources[key],expected=input.expectedSources[key];
  assert.ok(raw===null||typeof raw==='string');
  if(raw===null)assert.equal(expected,null);else assert.deepEqual(account(raw),expected,'independent input accounting '+key);
}
const sourceKey=input.sources['hpfc.scales.v3']!==null?'hpfc.scales.v3':input.sources['hpfc.scales']!==null?'hpfc.scales':null;
assert.ok(sourceKey,'prepared legacy-migration source required, not a preloaded new envelope');
const sourceRows=JSON.parse(input.sources[sourceKey]);assert.ok(Array.isArray(sourceRows));assert.equal(sourceRows.length,input.recordCount);
const helperPath=path.join(REPO,'tests/helpers/cdp.js'),HELPER_SHA='66f7fb2731e92f595b44b79f84092af5f90558649f6058493efab19581bbe6f0';
assert.equal(sha(fs.readFileSync(helperPath)),HELPER_SHA,'reviewed browser helper');
for(const key of ['NODE_OPTIONS','E2E_PORT','HPC_COVERAGE_DIR','NODE_V8_COVERAGE','NODE_SUITE_TIMEOUT','HPFC_CDP_PORT_TIMEOUT_MS'])assert.ok(!process.env[key],'unset inherited '+key);
const helper=require(helperPath);assert.ok(helper.findBrowser(),'required browser, no skip');
const report={case:input.id,kind:input.kind,recordCount:input.recordCount,expectedReadableCount:input.expectedReadableCount,samplesRequired:30,
  sourceSHA256:options['--source-sha'],caseSHA256:options['--case-sha'],helperSHA256:HELPER_SHA,
  expectedEnvelopeSizes:{utf8Bytes:input.expectedEnvelope.utf8Bytes,utf16CodeUnits:input.expectedEnvelope.utf16CodeUnits},
  goldenTemplateSHA256:input.expectedEnvelope.sha256Utf8,
  hashMeaning:'Golden SHA identifies the independent fixed-UUID template only. Actual envelope SHA identifies observed random-UUID bytes; hashes are not compared. Exact UTF8/UTF16 sizes are asserted for every successful case.',
  platform:process.platform,architecture:process.arch,node:process.version,started:new Date().toISOString(),samples:[],documents:[],cleanup:false};
let browser=null,server=null,origin=null,failure=null;
const q=JSON.stringify;
function prelude(){return `(()=>{
  'use strict';
  if(location.origin!==${q(origin)})return;
  const sources=${q(input.sources)},keys=${q(SOURCE_KEYS)},key=${q(KEY)},lockName=${q(LOCK)};
  // Only this fresh owned profile's fixed test origin and known fixture keys.
  localStorage.removeItem(key);
  for(const name of keys){if(sources[name]===null)localStorage.removeItem(name);else localStorage.setItem(name,sources[name]);}
  const timing=window.__svBackendTiming={locks:[],invalid:[],sourceReadyAt:performance.now(),unhandled:[]};
  window.addEventListener('unhandledrejection',event=>timing.unhandled.push(String(event.reason&&event.reason.name||'unhandled rejection')));
  const manager=navigator.locks,nativeRequest=manager&&manager.request;
  if(typeof nativeRequest!=='function'){timing.invalid.push('native locks unavailable');return;}
  Object.defineProperty(manager,'request',{configurable:true,writable:true,value:function(...args){
    if(args[0]!==lockName)return Reflect.apply(nativeRequest,this,args);
    const callback=args[args.length-1];
    if(typeof callback!=='function')return Reflect.apply(nativeRequest,this,args);
    const delegated=args.slice();
    delegated[delegated.length-1]=function(...callbackArgs){
      const row={start:performance.now(),threw:false,thenable:false};let result;
      try{return result=Reflect.apply(callback,this,callbackArgs);}
      catch(error){row.threw=true;row.errorName=String(error&&error.name||'Error');throw error;}
      finally{
        row.callbackEnd=performance.now();row.callbackMs=row.callbackEnd-row.start;
        // Inspect descriptors rather than invoking a possible then getter twice.
        // Unsupported/thenable results invalidate measurement, but ORIGINAL result
        // is returned unchanged so the native lock retains its real lifetime.
        if(result!==null&&(typeof result==='object'||typeof result==='function')){
          try{for(let object=result;object;object=Object.getPrototypeOf(object)){
            const descriptor=Object.getOwnPropertyDescriptor(object,'then');
            if(descriptor){if(descriptor.get||descriptor.set||typeof descriptor.value==='function')row.thenable=true;break;}
          }}catch(error){row.thenable=true;}
        }
        if(row.thenable)timing.invalid.push('asynchronous or accessor callback result: lock lifetime cannot be timed synchronously');
        timing.locks.push(row);row.instrumentedEnd=performance.now();row.instrumentedCallbackMs=row.instrumentedEnd-row.start;
      }
    };
    return Reflect.apply(nativeRequest,this,delegated); // same receiver/options/signal/arguments and exact result
  }});
})();`;}
async function actualDocument(url){
  const expected=new URL(url),session=browser.sessionId;
  const blank=await browser.send('Page.navigate',{url:'about:blank'});assert.ok(!blank.errorText);
  await browser.waitFor('location.href==="about:blank"&&document.readyState==="complete"',{timeout:5000,label:'separate blank document'});
  let navigation=null,load=false,settled=false,resolve,reject;
  const responses=new Map(),finished=new Set(),loaded=new Promise((r,j)=>{resolve=r;reject=j;});loaded.catch(()=>{});
  const ready=()=>{if(settled||!navigation||!load)return;for(const[id,response]of responses){
    if(response.frameId===navigation.frameId&&response.loaderId===navigation.loaderId&&finished.has(id)){settled=true;resolve({requestId:id,...response});return;}}};
  const listener=event=>{try{const m=JSON.parse(event.data);if(m.sessionId!==session)return;const p=m.params||{};
    if(m.method==='Network.responseReceived'&&p.type==='Document')responses.set(p.requestId,p);
    if(m.method==='Network.loadingFinished')finished.add(p.requestId);
    if(m.method==='Network.loadingFailed'&&responses.has(p.requestId)){settled=true;reject(new Error('actual main Document failed: '+p.errorText));}
    if(m.method==='Page.loadEventFired')load=true;ready();}catch(error){settled=true;reject(error);}};
  browser.ws.addEventListener('message',listener);
  const timer=setTimeout(()=>{settled=true;reject(new Error('actual loaded Document did not bind within20000ms'));},20000);
  try{
    navigation=await browser.send('Page.navigate',{url});assert.ok(!navigation.errorText&&navigation.frameId&&navigation.loaderId,'fresh app frame/loader');ready();
    const document=await loaded;assert.equal(document.response.status,200);
    const received=new URL(document.response.url);assert.equal(received.origin,expected.origin);assert.equal(received.pathname,'/');assert.equal(received.search,'');
    assert.equal(!!document.response.fromDiskCache,false);assert.equal(!!document.response.fromServiceWorker,false);
    const body=await browser.send('Network.getResponseBody',{requestId:document.requestId});
    const actual=Buffer.from(body.body,body.base64Encoded?'base64':'utf8');assert.equal(sha(actual),options['--source-sha']);
    const frame=(await browser.send('Page.getFrameTree')).frameTree.frame;assert.equal(frame.id,navigation.frameId);assert.equal(frame.loaderId,navigation.loaderId);
    report.documents.push({requestId:document.requestId,frameId:frame.id,loaderId:frame.loaderId,status:200,bodySHA256:sha(actual),bytes:actual.length});
  }finally{clearTimeout(timer);browser.ws.removeEventListener('message',listener);}
}
function percentile(values,p){assert.ok(values.length);return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];}
(async()=>{
  try{
    server=http.createServer((request,response)=>{
      if(request.method!=='GET'||new URL(request.url,'http://127.0.0.1').pathname!=='/'){response.writeHead(404);response.end();return;}
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store'});response.end(bytes);
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    origin='http://127.0.0.1:'+server.address().port;report.origin=origin;
    browser=await helper.launch({foregroundSettle:true});assert.ok(browser);
    report.browser=await browser.send('Browser.getVersion',{},false);
    console.log('BACKEND_OWNED '+q({pid:browser.proc.pid,pgid:browser.proc.pid,profile:browser.profileDir}));
    await browser.setViewport(900,900,false);await browser.send('Network.enable');await browser.send('Network.setCacheDisabled',{cacheDisabled:true});
    const installed=await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:prelude()});assert.ok(installed.identifier);
    for(let sample=1;sample<=30;sample++){
      await browser.send('Page.bringToFront');await actualDocument(origin+'/');
      await browser.waitFor('typeof initializeSavedCollection==="function"&&!!window.__svBackendTiming',{timeout:15000,label:'actual store script execution'});
      const observed=await browser.eval(`return (async()=>{
        const result=await Promise.resolve(initializeSavedCollection());
        const timing=window.__svBackendTiming;
        const observedInitializationAt=performance.now();
        const raw=localStorage.getItem(${q(KEY)}),source=localStorage.getItem(${q(sourceKey)});
        const before=performance.now(),parsed=JSON.parse(source),parsedAt=performance.now();
        const normalized=parsed.map(record=>readSavedRecord(record)),normalizedAt=performance.now();
        const serialized=savedState?JSON.stringify(savedState):null,serializedAt=performance.now();
        return {result,mode:savedMode,issue:savedIssue,raw,serialized,
          sources:Object.fromEntries(${q(SOURCE_KEYS)}.map(key=>[key,localStorage.getItem(key)])),
          sourceReadyAt:timing.sourceReadyAt,observedInitializationAt,locks:timing.locks,invalid:timing.invalid,unhandled:timing.unhandled,
          componentBench:{parseMs:parsedAt-before,normalizeBuildMs:normalizedAt-parsedAt,serializeMs:serializedAt-normalizedAt,
            parsedRows:parsed.length,readableRows:normalized.filter(row=>row.ok).length},
          registryCount:savedEntries.size,visible:document.visibilityState,origin:location.origin,
          source:${q(sourceKey)}};
      })();`);
      assert.equal(observed.origin,origin);assert.equal(observed.visible,'visible');assert.deepEqual(observed.sources,input.sources,'all legacy source bytes retained');
      assert.deepEqual(observed.invalid,[]);assert.deepEqual(observed.unhandled,[]);
      assert.equal(observed.locks.length,1,'Stage C initialization has exactly one actual migration lock callback');
      const lock=observed.locks[0];assert.equal(lock.thenable,false,'async callback cannot be undertimed');
      assert.ok(Number.isFinite(lock.instrumentedCallbackMs)&&lock.instrumentedCallbackMs>=lock.callbackMs&&lock.callbackMs>=0);
      assert.equal(observed.componentBench.parsedRows,input.recordCount);assert.equal(observed.componentBench.readableRows,input.expectedReadableCount,'fixture really exercises validated records');
      const row={sample,lock,componentBench:observed.componentBench,
        documentToObservedInitializationMs:observed.observedInitializationAt,
        fixtureReadyToObservedInitializationMs:observed.observedInitializationAt-observed.sourceReadyAt};
      if(observed.mode==='durable'&&observed.result.ok&&typeof observed.raw==='string'){
        assert.equal(lock.threw,false);assert.equal(observed.serialized,observed.raw,'acknowledged state equals actual stored envelope');
        const e=JSON.parse(observed.raw);assert.equal(e.schema,1);assert.equal(e.entries.length,input.recordCount);
        assert.equal(observed.registryCount,input.expectedReadableCount);assert.deepEqual(e.migration.raw,input.sources);
        const accounting=account(observed.raw);
        assert.equal(accounting.utf8Bytes,input.expectedEnvelope.utf8Bytes,'independent FINAL envelope UTF8 size');
        assert.equal(accounting.utf16CodeUnits,input.expectedEnvelope.utf16CodeUnits,'independent FINAL envelope UTF16 size');
        if(input.kind==='envelope-1mib'){
          assert.equal(accounting.utf8Bytes,1048576,'FINAL new envelope stress is exactly1MiB');
        }
        const sourceStrings=SOURCE_KEYS.filter(key=>input.sources[key]!==null);
        row.acknowledged=true;row.envelope=accounting;
        row.accounting={legacySourceUTF8Bytes:sourceStrings.reduce((n,key)=>n+Buffer.byteLength(input.sources[key],'utf8'),0),
          legacySourceUTF16CodeUnits:sourceStrings.reduce((n,key)=>n+input.sources[key].length,0),
          rawSnapshotJSONUTF8Bytes:Buffer.byteLength(JSON.stringify(e.migration.raw),'utf8'),
          transformedEntriesJSONUTF8Bytes:Buffer.byteLength(JSON.stringify(e.entries),'utf8')};
        row.accounting.peakStoredValueUTF8Bytes=row.accounting.legacySourceUTF8Bytes+accounting.utf8Bytes;
        row.accounting.peakStoredValueUTF16CodeUnits=row.accounting.legacySourceUTF16CodeUnits+accounting.utf16CodeUnits;
      }else{
        assert.equal(input.kind,'envelope-1mib','2/20/200 variants must initialize durably');
        assert.equal(observed.raw,null,'refused stress migration must leave no partial envelope');
        assert.equal(lock.threw,true);assert.equal(lock.errorName,'QuotaExceededError','only genuine bounded quota refusal qualifies');
        row.acknowledged=false;row.acceptedQuotaRefusal=true;row.mode=observed.mode;row.issue=observed.issue;
      }
      report.samples.push(row);console.log('BACKEND_SAMPLE '+q(row));
    }
    helper.assertNoUncaught();assert.equal(report.samples.length,30);assert.equal(report.documents.length,30);
    const durations=report.samples.map(row=>row.lock.instrumentedCallbackMs);
    report.summary={executed:30,acknowledged:report.samples.filter(row=>row.acknowledged).length,
      quotaRefused:report.samples.filter(row=>row.acceptedQuotaRefusal).length,
      grantedCallbackP95Ms:percentile(durations,.95),grantedCallbackMaxMs:Math.max(...durations),
      parseBenchP95Ms:percentile(report.samples.map(row=>row.componentBench.parseMs),.95),
      normalizeBuildBenchP95Ms:percentile(report.samples.map(row=>row.componentBench.normalizeBuildMs),.95),
      serializeBenchP95Ms:percentile(report.samples.map(row=>row.componentBench.serializeMs),.95),
      documentToObservedInitializationP95Ms:percentile(report.samples.map(row=>row.documentToObservedInitializationMs),.95),
      fixtureReadyToObservedInitializationP95Ms:percentile(report.samples.map(row=>row.fixtureReadyToObservedInitializationMs),.95)};
    if(input.kind==='records'){
      assert.equal(report.summary.acknowledged,30);assert.ok(report.summary.grantedCallbackP95Ms<=50,'approved p95 lock callback budget50ms');
      assert.ok(report.summary.grantedCallbackMaxMs<=100,'approved max lock callback budget100ms');
    }
  }catch(error){failure=error;console.error(error.stack||String(error));}
  finally{
    let browserClean=!browser,serverClean=!server;
    if(browser){const profile=browser.profileDir;try{await browser.close();assert.equal(fs.existsSync(profile),false);browserClean=true;}catch(error){failure ||=error;}}
    if(server){try{await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});serverClean=true;}catch(error){failure ||=error;}}
    report.cleanup=browserClean&&serverClean;report.finished=new Date().toISOString();report.status=failure?'FAILED':'PASS';
    report.limits='Owned headless Chromium/loopback origin/fallback fonts/900x900 only. Native Web Lock delegates receiver/options/signal/arguments/result; wrapper overhead is included in instrumented callback duration. The wrapper intentionally stays synchronous and is not an async function: a thenable/accessor callback result invalidates timing without changing its native result/lifetime; measuring return time alone would undercount asynchronous lock ownership. Execution still requires the sole browser lease and the external reviewed supervisor; this probe adds no deadline or concurrency authority. Callback walltime excludes native grant/release scheduling. Parse/normalize-build/serialize are separate pure component benches, not claimed subphases of the same commit. Observed initialization includes document/driver observation delay. Stored-value byte totals are accounting, not process-memory or browser-quota guarantees. Thirty samples include cold and warm runs; no outlier deletion. UI selection timing/Safari/physical device/full Mac suite remain separate.';
    if(failure)report.error=String(failure.stack||failure);
    fs.writeFileSync(OUT+'.part',JSON.stringify(report,null,2),{flag:'wx'});
    try {
      // Same-parent hard link publishes the complete file atomically and refuses
      // EEXIST, unlike rename which can overwrite a destination created mid-run.
      fs.linkSync(OUT+'.part',OUT);
      fs.unlinkSync(OUT+'.part');
    } catch (error) {
      console.error('BACKEND_PUBLICATION_FAILED '+String(error.stack||error));
      process.exitCode=1;
      return;
    }
    console.log('BACKEND_SUMMARY '+q({status:report.status,executed:report.samples.length,documents:report.documents.length,cleanup:report.cleanup,summary:report.summary||null,out:OUT}));
    if(failure||!report.cleanup)process.exitCode=1;
  }
})();
