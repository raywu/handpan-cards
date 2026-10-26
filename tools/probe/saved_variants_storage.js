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
const KEY='hpfc.saved-scales.v1',LOCK='handpan-cards:saved-scales:v1',STORE='collections',RECORD='current';
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
// Independently cleared stderr-drain repair helper. Keep this exact pin; a
// later helper change needs fresh review, never bypass a mismatch.
const helperPath=path.join(REPO,'tests/helpers/cdp.js'),HELPER_SHA='178e034c3d9395bd92a7250b50b8ec5858bb177bb6678e500870699701b50826';
assert.equal(sha(fs.readFileSync(helperPath)),HELPER_SHA,'reviewed browser helper');
for(const key of ['NODE_OPTIONS','E2E_PORT','HPC_COVERAGE_DIR','NODE_V8_COVERAGE','NODE_SUITE_TIMEOUT','HPFC_CDP_PORT_TIMEOUT_MS'])assert.ok(!process.env[key],'unset inherited '+key);
const helper=require(helperPath);assert.ok(helper.findBrowser(),'required browser, no skip');
const report={case:input.id,kind:input.kind,recordCount:input.recordCount,expectedReadableCount:input.expectedReadableCount,samplesRequired:30,
  sourceSHA256:options['--source-sha'],caseSHA256:options['--case-sha'],helperSHA256:HELPER_SHA,
  measurementContract:'native-idb-completion-and-async-lock-lifetime-v1',
  expectedEnvelopeSizes:{utf8Bytes:input.expectedEnvelope.utf8Bytes,utf16CodeUnits:input.expectedEnvelope.utf16CodeUnits},
  goldenTemplateSHA256:input.expectedEnvelope.sha256Utf8,
  hashMeaning:'Golden SHA identifies the independent fixed-UUID template only. Actual envelope SHA identifies observed random-UUID bytes; hashes are not compared. Exact UTF8/UTF16 sizes are asserted for every successful case.',
  platform:process.platform,architecture:process.arch,node:process.version,started:new Date().toISOString(),samples:[],documents:[],resets:[],cleanup:false};
let browser=null,server=null,origin=null,failure=null;
const q=JSON.stringify;
function prelude(){return `(()=>{
  'use strict';
  if(location.origin!==${q(origin)})return;
  const sources=${q(input.sources)},keys=${q(SOURCE_KEYS)},key=${q(KEY)};
  localStorage.removeItem(key);
  for(const name of keys){if(sources[name]===null)localStorage.removeItem(name);else localStorage.setItem(name,sources[name]);}
  const timing=window.__svBackendTiming={locks:[],opens:[],transactions:[],invalid:[],sourceReadyAt:performance.now(),unhandled:[],phase:'application'};
  window.addEventListener('unhandledrejection',event=>timing.unhandled.push(String(event.reason&&event.reason.name||'unhandled rejection')));
  const now=()=>performance.now(),errorName=error=>String(error&&error.name||'Error');
  const nativeThen=Promise.prototype.then;
  // Observe plain native Promise settlement, never replace the Promise returned
  // to Web Locks or to the application. Unsupported custom thenables invalidate
  // timing instead of invoking their then getter or reporting return-time as ACK.
  // Rejection handlers mark observed original Promises handled, suppressing their
  // unhandledrejection telemetry. Identity preservation does not make an empty
  // telemetry array proof that the application handled those rejections itself.
  const observePromise=(value,fulfilled,rejected)=>{
    try{Reflect.apply(nativeThen,value,[fulfilled,rejected]);return true;}
    catch(error){return false;}
  };
  const manager=navigator.locks,nativeRequest=manager&&manager.request;
  if(typeof nativeRequest!=='function')timing.invalid.push('native locks unavailable');
  else Object.defineProperty(manager,'request',{configurable:true,writable:true,value:function(...args){
    const callback=args[args.length-1],requestedAt=now();
    if(typeof callback!=='function')return Reflect.apply(nativeRequest,this,args);
    const delegated=args.slice(),requestRow={name:String(args[0]),requestedAt,phase:timing.phase};
    timing.locks.push(requestRow);
    delegated[delegated.length-1]=function(...callbackArgs){
      const row=requestRow;row.start=now();row.grantWaitMs=row.start-requestedAt;row.threw=false;let result;
      const settle=(status,error)=>{
        row.settledAt=now();row.status=status;if(error)row.errorName=errorName(error);
        row.lifetimeMs=row.settledAt-row.start;
        row.instrumentedEnd=now();row.instrumentedLifetimeMs=row.instrumentedEnd-row.start;
      };
      try{result=Reflect.apply(callback,this,callbackArgs);}
      catch(error){row.threw=true;row.callbackReturnAt=now();row.synchronousCallbackMs=row.callbackReturnAt-row.start;settle('threw',error);throw error;}
      row.callbackReturnAt=now();row.synchronousCallbackMs=row.callbackReturnAt-row.start;
      if(result!==null&&(typeof result==='object'||typeof result==='function')){
        row.async=observePromise(result,()=>settle('fulfilled'),error=>settle('rejected',error));
        if(!row.async)timing.invalid.push('callback returned unsupported non-native-Promise object/thenable');
      }else{row.async=false;settle('returned');}
      return result; // exact callback result; same callback receiver and arguments
    };
    const nativeResult=Reflect.apply(nativeRequest,this,delegated);
    if(!observePromise(nativeResult,()=>{requestRow.requestSettledAt=now();},error=>{requestRow.requestSettledAt=now();requestRow.requestErrorName=errorName(error);}))
      timing.invalid.push('native lock request did not return observable native Promise');
    return nativeResult; // exact request Promise; same receiver/options/signal
  }});
  if(!window.indexedDB||!window.IDBDatabase||!window.IDBObjectStore){timing.invalid.push('native IndexedDB unavailable');return;}
  const rows=new WeakMap();
  const watchTransaction=(tx,creationStartAt,creationBoundary)=>{
    if(rows.has(tx))return rows.get(tx);
    const row={id:timing.transactions.length+1,db:tx.db.name,dbVersion:tx.db.version,
      stores:Array.from(tx.objectStoreNames),mode:tx.mode,durability:tx.durability||'unspecified',phase:timing.phase,
      creationStartAt,creationReturnedAt:now(),creationBoundary,requests:[],errors:[]};
    rows.set(tx,row);timing.transactions.push(row);
    tx.addEventListener('error',event=>row.errors.push({at:now(),name:errorName(event.target&&event.target.error||tx.error)}));
    for(const type of ['complete','abort'])tx.addEventListener(type,()=>{
      row.settledAt=now();row.status=type;row.durationMs=row.settledAt-row.creationStartAt;row.storesAtSettlement=Array.from(tx.objectStoreNames);
      if(tx.error)row.errorName=errorName(tx.error);
      if(Number.isFinite(row.firstReadSuccessAt))row.creationToFirstReadSuccessMs=row.firstReadSuccessAt-row.creationStartAt;
      if(Number.isFinite(row.firstPutRequestedAt)&&Number.isFinite(row.firstReadSuccessAt))row.firstReadToPutRequestMs=row.firstPutRequestedAt-row.firstReadSuccessAt;
      if(Number.isFinite(row.firstPutRequestedAt))row.putRequestToSettlementMs=row.settledAt-row.firstPutRequestedAt;
    });
    return row;
  };
  const nativeTransaction=IDBDatabase.prototype.transaction;
  Object.defineProperty(IDBDatabase.prototype,'transaction',{configurable:true,writable:true,value:function(...args){
    const start=now();let tx;
    try{tx=Reflect.apply(nativeTransaction,this,args);}
    catch(error){timing.invalid.push('transaction creation threw '+errorName(error));throw error;}
    watchTransaction(tx,start,'native-transaction-call');return tx;
  }});
  const nativeOpen=indexedDB.open;
  Object.defineProperty(indexedDB,'open',{configurable:true,writable:true,value:function(...args){
    const row={db:String(args[0]),requestedVersion:args.length>1?args[1]:null,phase:timing.phase,start:now(),events:[]};
    timing.opens.push(row);let request;
    try{request=Reflect.apply(nativeOpen,this,args);}
    catch(error){row.errorName=errorName(error);row.status='threw';throw error;}
    request.addEventListener('upgradeneeded',event=>{
      row.events.push({type:'upgradeneeded',at:now(),oldVersion:event.oldVersion,newVersion:event.newVersion});
      watchTransaction(request.transaction,now(),'upgrade-event-observed');
    });
    request.addEventListener('blocked',()=>row.events.push({type:'blocked',at:now()}));
    request.addEventListener('success',()=>{row.status='success';row.settledAt=now();row.version=request.result.version;row.stores=Array.from(request.result.objectStoreNames);});
    request.addEventListener('error',()=>{row.status='error';row.settledAt=now();row.errorName=errorName(request.error);});
    return request;
  }});
  for(const operation of ['get','getKey','put']){
    const original=IDBObjectStore.prototype[operation];
    Object.defineProperty(IDBObjectStore.prototype,operation,{configurable:true,writable:true,value:function(...args){
      const tx=watchTransaction(this.transaction,now(),'first-request-observed'),start=now();
      const row={operation,store:this.name,start};tx.requests.push(row);
      if(operation==='put'){tx.firstPutRequestedAt??=start;row.valueKind=typeof args[0];if(typeof args[0]==='string')row.valueUTF16CodeUnits=args[0].length;}
      else tx.firstReadRequestedAt??=start;
      let request;try{request=Reflect.apply(original,this,args);}
      catch(error){row.status='threw';row.errorName=errorName(error);throw error;}
      request.addEventListener('success',()=>{row.status='success';row.settledAt=now();
        if(operation==='put')tx.firstPutSuccessAt??=row.settledAt;else tx.firstReadSuccessAt??=row.settledAt;});
      request.addEventListener('error',()=>{row.status='error';row.settledAt=now();row.errorName=errorName(request.error);});
      return request;
    }});
  }
})();`;}
async function actualDocument(url,sample){
  const expected=new URL(url),session=browser.sessionId;
  const blank=await browser.send('Page.navigate',{url:'about:blank'});assert.ok(!blank.errorText);
  await browser.waitFor('location.href==="about:blank"&&document.readyState==="complete"',{timeout:5000,label:'separate blank document'});
  // Every sample starts from genuinely fresh native IDB, after destroying the
  // prior page. Never clear a caller-supplied site or a signed-in browser profile.
  const owned=new URL(origin);
  assert.equal(owned.protocol,'http:');assert.equal(owned.hostname,'127.0.0.1');
  assert.equal(Number(owned.port),server.address().port);assert.equal(expected.origin,origin);
  assert.equal(owned.origin,origin);assert.equal(owned.pathname,'/');assert.equal(owned.username,'');assert.equal(owned.password,'');
  await browser.send('Storage.clearDataForOrigin',{origin,storageTypes:'indexeddb'});
  report.resets.push({sample,origin,storageTypes:'indexeddb',afterBlank:true,cdpAcknowledged:true});
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
    report.documents.push({sample,requestId:document.requestId,frameId:frame.id,loaderId:frame.loaderId,status:200,bodySHA256:sha(actual),bytes:actual.length});
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
      await browser.send('Page.bringToFront');await actualDocument(origin+'/',sample);
      await browser.waitFor('typeof initializeSavedCollection==="function"&&!!window.__svBackendTiming',{timeout:15000,label:'actual store script execution'});
      const observed=await browser.eval(`return (async()=>{
        const result=await Promise.resolve(initializeSavedCollection());
        const timing=window.__svBackendTiming,observedInitializationAt=performance.now();
        timing.phase='verification';
        // A separate native readonly transaction proves actual record existence
        // and value only at complete. No app cache/localStorage mirror is read.
        const persisted=await new Promise((resolve,reject)=>{
          const request=indexedDB.open(${q(KEY)});let absentProbe=false;
          request.onupgradeneeded=event=>{
            if(event.oldVersion!==0){reject(new Error('verification unexpected upgrade'));return;}
            absentProbe=true;request.transaction.abort();
          };
          request.onblocked=()=>reject(new Error('verification open blocked'));
          request.onerror=()=>absentProbe&&request.error&&request.error.name==='AbortError'
            ?resolve({present:false,raw:null,rawType:'undefined',databaseAbsent:true}):reject(request.error||new Error('verification open failed'));
          request.onsuccess=()=>{
            const db=request.result;let settled=false,tx;
            const fail=error=>{if(settled)return;settled=true;db.close();reject(error);};
            try{
              if(db.name!==${q(KEY)}||db.version!==1||db.objectStoreNames.length!==1||!db.objectStoreNames.contains(${q(STORE)}))throw new Error('verification unexpected database schema');
              tx=db.transaction(${q(STORE)},'readonly');const store=tx.objectStore(${q(STORE)});
              if(store.keyPath!==null||store.autoIncrement!==false)throw new Error('verification unexpected store schema');
              let value,key;store.get(${q(RECORD)}).onsuccess=event=>{value=event.target.result;};
              store.getKey(${q(RECORD)}).onsuccess=event=>{key=event.target.result;};
              tx.onabort=()=>fail(tx.error||new Error('verification transaction aborted'));
              tx.onerror=()=>{};
              tx.oncomplete=()=>{
                if(settled)return;settled=true;db.close();
                if(key!==undefined&&key!==${q(RECORD)}){reject(new Error('verification wrong existence key'));return;}
                resolve({present:key!==undefined,raw:value===undefined?null:value,rawType:typeof value,
                  database:{name:db.name,version:db.version,stores:Array.from(db.objectStoreNames)},
                  store:{name:store.name,keyPath:store.keyPath,autoIncrement:store.autoIncrement}});
              };
            }catch(error){if(tx)try{tx.abort();}catch(_){}fail(error);}
          };
        });
        timing.phase='component-bench';
        const source=localStorage.getItem(${q(sourceKey)});
        const before=performance.now(),parsed=JSON.parse(source),parsedAt=performance.now();
        const normalized=parsed.map(record=>readSavedRecord(record)),normalizedAt=performance.now();
        const serialized=savedState?JSON.stringify(savedState):null,serializedAt=performance.now();
        return {result,mode:savedMode,issue:savedIssue,persisted,serialized,
          legacyExperimentalEnvelope:localStorage.getItem(${q(KEY)}),
          sources:Object.fromEntries(${q(SOURCE_KEYS)}.map(key=>[key,localStorage.getItem(key)])),
          sourceReadyAt:timing.sourceReadyAt,observedInitializationAt,locks:timing.locks,opens:timing.opens,transactions:timing.transactions,
          invalid:timing.invalid,unhandled:timing.unhandled,
          componentBench:{parseMs:parsedAt-before,normalizeBuildMs:normalizedAt-parsedAt,serializeMs:serializedAt-normalizedAt,
            parsedRows:parsed.length,readableRows:normalized.filter(row=>row.ok).length},
          registryCount:savedEntries.size,visible:document.visibilityState,origin:location.origin,source:${q(sourceKey)}};
      })();`);
      report.pendingSample={sample,locks:observed.locks,opens:observed.opens,transactions:observed.transactions,
        persistedMetadata:{...observed.persisted,raw:undefined},sourceDocument:report.documents.at(-1),
        actualEnvelope:typeof observed.persisted.raw==='string'?account(observed.persisted.raw):null,
        invalid:observed.invalid,unhandled:observed.unhandled,mode:observed.mode,issue:observed.issue};
      assert.equal(observed.origin,origin);assert.equal(observed.visible,'visible');assert.deepEqual(observed.sources,input.sources,'all legacy source bytes retained');
      assert.deepEqual(observed.invalid,[]);assert.deepEqual(observed.unhandled,[]);
      assert.equal(observed.legacyExperimentalEnvelope,null,'no new-format localStorage mirror');
      assert.ok(observed.transactions.length,'actual native transactions were observed');
      for(const tx of observed.transactions){
        assert.equal(tx.db,KEY,'every observed native transaction belongs to the documented database');
        assert.ok(['application','verification'].includes(tx.phase),'no unexplained transaction phase');
        assert.ok(['complete','abort'].includes(tx.status),'every native transaction settled');
        assert.ok(Number.isFinite(tx.durationMs)&&tx.durationMs>=0);
        assert.ok(tx.storesAtSettlement.every(name=>name===STORE),'no hidden store transaction');
      }
      for(const opened of observed.opens){assert.equal(opened.db,KEY);assert.ok(['application','verification'].includes(opened.phase));assert.ok(['success','error'].includes(opened.status));}
      const applicationTransactions=observed.transactions.filter(tx=>tx.phase==='application');
      const verificationTransactions=observed.transactions.filter(tx=>tx.phase==='verification');
      assert.equal(applicationTransactions.length+verificationTransactions.length,observed.transactions.length);
      const allCounts={opens:observed.opens.length,transactions:observed.transactions.length,
        applicationTransactions:applicationTransactions.length,verificationTransactions:verificationTransactions.length,
        reads:observed.transactions.reduce((sum,tx)=>sum+tx.requests.filter(request=>request.operation!=='put').length,0),
        puts:observed.transactions.reduce((sum,tx)=>sum+tx.requests.filter(request=>request.operation==='put').length,0),
        completed:observed.transactions.filter(tx=>tx.status==='complete').length,aborted:observed.transactions.filter(tx=>tx.status==='abort').length};
      assert.equal(observed.locks.length,1,'Stage C initialization has exactly one actual migration lock callback');
      const lock=observed.locks[0];assert.equal(lock.name,LOCK);assert.equal(lock.phase,'application');
      assert.equal(lock.async,true,'native migration callback must retain its asynchronous lifetime');
      assert.ok(Number.isFinite(lock.instrumentedLifetimeMs)&&lock.instrumentedLifetimeMs>=lock.lifetimeMs&&lock.lifetimeMs>=lock.synchronousCallbackMs);
      assert.ok(Number.isFinite(lock.requestSettledAt),'native request Promise settlement observed');
      assert.equal(observed.componentBench.parsedRows,input.recordCount);assert.equal(observed.componentBench.readableRows,input.expectedReadableCount,'fixture really exercises validated records');
      // Adapter sequence to verify independently on an absent database: abort the
      // existence probe upgrade without schema, then (under one lock) create
      // schema, validate metadata with an empty readonly tx, and compare/put.
      // The verification open/readonly tx is explicit extra probe work.
      assert.deepEqual(applicationTransactions.map(tx=>tx.mode),['versionchange','versionchange','readonly','readwrite'],'exact application transaction sequence; extras require review');
      assert.deepEqual(verificationTransactions.map(tx=>tx.mode),['readonly']);
      assert.deepEqual(applicationTransactions.map(tx=>tx.requests.map(request=>request.operation).sort()),[[],[],[],['get','getKey','put']]);
      assert.deepEqual(verificationTransactions[0].requests.map(request=>request.operation).sort(),['get','getKey']);
      assert.equal(applicationTransactions[0].status,'abort','known-absence probe must not create schema');
      assert.deepEqual(applicationTransactions[0].storesAtSettlement,[]);
      assert.equal(applicationTransactions[1].status,'complete');assert.equal(applicationTransactions[2].status,'complete');
      assert.equal(verificationTransactions[0].status,'complete');
      assert.deepEqual(allCounts,{opens:3,transactions:5,applicationTransactions:4,verificationTransactions:1,reads:4,puts:1,
        completed:applicationTransactions[3].status==='complete'?4:3,aborted:applicationTransactions[3].status==='abort'?2:1});
      const row={sample,lock,opens:observed.opens,transactions:observed.transactions,allCounts,persistedMetadata:{...observed.persisted,raw:undefined},sourceDocument:report.documents.at(-1),componentBench:observed.componentBench,
        documentToObservedInitializationMs:observed.observedInitializationAt,
        fixtureReadyToObservedInitializationMs:observed.observedInitializationAt-observed.sourceReadyAt};
      if(observed.mode==='durable'&&observed.result.ok&&observed.persisted.present&&observed.persisted.rawType==='string'){
        const raw=observed.persisted.raw;
        assert.equal(lock.threw,false);assert.equal(observed.serialized,raw,'acknowledged state equals actual stored envelope');
        const e=JSON.parse(raw);assert.equal(e.schema,1);assert.equal(e.entries.length,input.recordCount);
        assert.equal(observed.registryCount,input.expectedReadableCount);assert.deepEqual(e.migration.raw,input.sources);
        const accounting=account(raw);
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
        assert.equal(observed.persisted.present,false,'refused stress migration must leave no partial current record');
        assert.equal(observed.persisted.raw,null);assert.equal(observed.mode,'protected','failed migration remains protected until explicit owner temporary action');
        const nativeErrors=[...observed.opens.filter(row=>row.phase==='application').flatMap(row=>row.errorName?[row.errorName]:[]),
          ...applicationTransactions.flatMap(tx=>[...(tx.errorName?[tx.errorName]:[]),...tx.errors.map(error=>error.name),...tx.requests.flatMap(request=>request.errorName?[request.errorName]:[])])];
        const writeTransaction=applicationTransactions[3];
        assert.equal(writeTransaction.status,'abort','only migration readwrite quota refusal is accepted');
        const writeErrors=[...(writeTransaction.errorName?[writeTransaction.errorName]:[]),...writeTransaction.errors.map(error=>error.name),
          ...writeTransaction.requests.flatMap(request=>request.errorName?[request.errorName]:[])];
        assert.ok(writeErrors.includes('QuotaExceededError'),'native migration readwrite transaction must prove quota refusal');
        assert.ok(nativeErrors.every(name=>['QuotaExceededError','AbortError'].includes(name)),'unrelated native error cannot masquerade as quota refusal');
        row.nativeErrors=nativeErrors;
        row.acknowledged=false;row.acceptedQuotaRefusal=true;row.mode=observed.mode;row.issue=observed.issue;
      }
      report.samples.push(row);delete report.pendingSample;console.log('BACKEND_SAMPLE '+q(row));
    }
    helper.assertNoUncaught();assert.equal(report.samples.length,30);assert.equal(report.documents.length,30);assert.equal(report.resets.length,30);
    const durations=report.samples.map(row=>row.lock.instrumentedLifetimeMs);
    report.summary={executed:30,acknowledged:report.samples.filter(row=>row.acknowledged).length,
      quotaRefused:report.samples.filter(row=>row.acceptedQuotaRefusal).length,
      grantedEntrySynchronousSpanP95Ms:percentile(report.samples.map(row=>row.lock.synchronousCallbackMs),.95),
      grantedPostReturnResidualP95Ms:percentile(report.samples.map(row=>row.lock.lifetimeMs-row.lock.synchronousCallbackMs),.95),
      nativeGrantWaitP95Ms:percentile(report.samples.map(row=>row.lock.grantWaitMs),.95),
      grantedLifetimeP95Ms:percentile(durations,.95),grantedLifetimeMaxMs:Math.max(...durations),
      parseBenchP95Ms:percentile(report.samples.map(row=>row.componentBench.parseMs),.95),
      normalizeBuildBenchP95Ms:percentile(report.samples.map(row=>row.componentBench.normalizeBuildMs),.95),
      serializeBenchP95Ms:percentile(report.samples.map(row=>row.componentBench.serializeMs),.95),
      documentToObservedInitializationP95Ms:percentile(report.samples.map(row=>row.documentToObservedInitializationMs),.95),
      fixtureReadyToObservedInitializationP95Ms:percentile(report.samples.map(row=>row.fixtureReadyToObservedInitializationMs),.95)};
    // These subsets are explicit summary views only; every original row and
    // aggregate allCounts remain in each sample, including aborts/extras.
    report.summary.nativeTransactions={};
    for(const phase of ['application','verification'])for(const mode of ['versionchange','readonly','readwrite']){
      const rows=report.samples.flatMap(sample=>sample.transactions.filter(tx=>tx.phase===phase&&tx.mode===mode));
      if(!rows.length)continue;
      const entry={count:rows.length,complete:rows.filter(tx=>tx.status==='complete').length,abort:rows.filter(tx=>tx.status==='abort').length,
        durationP95Ms:percentile(rows.map(tx=>tx.durationMs),.95),durationMaxMs:Math.max(...rows.map(tx=>tx.durationMs))};
      for(const field of ['creationToFirstReadSuccessMs','firstReadToPutRequestMs','putRequestToSettlementMs']){
        const spans=rows.map(tx=>tx[field]).filter(Number.isFinite);
        if(spans.length)entry[field]={count:spans.length,p95:percentile(spans,.95),max:Math.max(...spans)};
      }
      report.summary.nativeTransactions[phase+':'+mode]=entry;
    }
    if(input.kind==='records'){
      assert.equal(report.summary.acknowledged,30);assert.ok(report.summary.grantedLifetimeP95Ms<=50,'approved p95 async lock lifetime budget50ms');
      assert.ok(report.summary.grantedLifetimeMaxMs<=100,'approved max async lock lifetime budget100ms');
    }
  }catch(error){failure=error;if(report.pendingSample){report.failedSample=report.pendingSample;delete report.pendingSample;}console.error(error.stack||String(error));}
  finally{
    let browserClean=!browser,serverClean=!server;
    if(browser){const profile=browser.profileDir;try{await browser.close();assert.equal(fs.existsSync(profile),false);browserClean=true;}catch(error){failure ||=error;}}
    if(server){try{await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});serverClean=true;}catch(error){failure ||=error;}}
    report.cleanup=browserClean&&serverClean;report.finished=new Date().toISOString();report.status=failure?'FAILED':'PASS';
    report.limits='Owned headless Chromium/loopback origin/fallback fonts/900x900 only. Native Web Lock wrappers preserve callback receiver/arguments, request receiver/options/signal and exact callback/request Promise objects. Native Promise observers measure entry through settlement conservatively including observer overhead; non-native-Promise object/thenable results invalidate measurement. Rejection observers mark those original Promises handled and suppress their unhandledrejection telemetry, so an empty unhandled list is not proof of app rejection handling. Callback lifetime excludes final native release scheduling; request settlement and native grant wait are recorded separately. Initial synchronous entry span is not total CPU time; post-return residual includes both async waiting and resumed synchronous work. All native IDB transaction/open/request metadata is retained, with application and separate verification phases explicit; upgrade creation is first observed at upgradeneeded, normal creation spans native transaction invocation to complete/abort. ACK proves API transaction completion, not physical disk flush. Accepted stress quota refusal is confined to the migration readwrite transaction and remains protected without a partial current record; schema/open quota fails the exact sequence rather than qualifying. Failed-sample transaction metadata requires eval to return; eval timeout may leave only prior Document/reset evidence. Each sample clears only indexeddb on the exact owned loopback origin after about:blank. Parse/normalize-build/serialize are separate pure component benches, not subphases of the same commit. Observed initialization includes document/driver observation delay. Stored-value byte totals are accounting, not process-memory or browser-quota guarantees. Thirty samples include cold/warm work without outlier deletion; the unchanged50ms p95/100ms max gate now applies to async lock lifetime, not old synchronous callback CPU time. Sole browser lease and reviewed external supervisor remain required. UI input-to-paint within an observed frame, real/fallback fonts, locale/Safari/device and full Mac qualification remain separate.';
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
