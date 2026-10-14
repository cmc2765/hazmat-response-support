/* EMERGENZ Monitoring V1 — manual observations, never simulated telemetry. */
(() => {
  'use strict';
  const KEYS = {
    inventory: 'hazmatiq_monitor_inventory',
    assignments: 'hazmatiq_incident_monitor_assignments',
    readings: 'hazmatiq_monitor_readings',
    activity: 'hazmatiq_monitor_activity_log'
  };
  const STARTERS = [
    ...Array.from({length:4}, (_,i)=>['MultiRAE',i+1,'Honeywell / RAE Systems']),
    ...Array.from({length:2}, (_,i)=>['MultiRAE Pro',i+1,'Honeywell / RAE Systems']),
    ...Array.from({length:4}, (_,i)=>['AreaRAE',i+1,'Honeywell / RAE Systems']),
    ['Ludlum RAD',null,'Ludlum Measurements'],
    ...Array.from({length:2}, (_,i)=>['ToxiRAE',i+1,'Honeywell / RAE Systems']),
    ...Array.from({length:4}, (_,i)=>['RadEye',i+1,'Thermo Scientific'])
  ];
  const PRODUCT_REFERENCE = {
    'MultiRAE': {src:'https://s7d1.scene7.com/is/image/Honeywell65/his-rae-multirae-front-hires?wid=190', url:'https://automation.honeywell.com/us/en/products/sensing-solutions/gas-and-flame-detection/portables/photoionization-detectors-pid/multirae-portable-multi-gas-monitor', verified:true},
    'MultiRAE Pro': {src:'https://s7d1.scene7.com/is/image/Honeywell65/his-rae-multirae-pro-front-hires?wid=190', url:'https://automation.honeywell.com/us/en/products/sensing-solutions/gas-and-flame-detection/portables/multi-gas/multirae-pro-portable-multi-gas-monitor', verified:true},
    'AreaRAE': {url:'https://automation.honeywell.com/us/en/products/sensing-solutions/gas-and-flame-detection/portables/transportable-area-monitoring/arearae-pro-portable-gas-monitor'},
    'ToxiRAE': {url:'https://automation.honeywell.com/us/en/products/sensing-solutions/gas-and-flame-detection/portables'},
    'Ludlum RAD': {url:'https://ludlums.com/products/health-physics/category/survey-meters-mp'},
    'RadEye': {url:'https://www.thermofisher.com/TFS-Assets/LSG/brochures/D16620~.pdf'}
  };
  const SENSOR_UNITS = {
    'NH3':['ppm'], 'Cl2':['ppm'], 'CO':['ppm'], 'H2S':['ppm'], 'SO2':['ppm'],
    'HCN':['ppm'], 'VOC / PID':['ppm','ppb'], 'O2':['%'], 'LEL':['% LEL'],
    'Gamma Dose Rate':['µSv/h','mR/h','mSv/h','µR/h'],
    'Radiation Counts':['cpm','cps'], 'Other':['ppm','ppb','%','% LEL','µSv/h','mR/h','cpm','cps']
  };
  const $ = (id) => document.getElementById(id);
  const uid = () => window.crypto?.randomUUID?.() || 'm-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const load = (key) => {
    try { const x=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(x) ? x.filter(v=>v&&typeof v==='object') : []; }
    catch { return []; }
  };
  function save(key, rows) {
    try { localStorage.setItem(key,JSON.stringify(rows)); return true; }
    catch { status('Local save failed. Browser storage may be unavailable or full.'); return false; }
  }
  function status(s) { if ($('monitor-workspace-status')) $('monitor-workspace-status').textContent=s; }
  const numbers = (a,b) => Number.isFinite(a)&&Number.isFinite(b)&&a>=-90&&a<=90&&b>=-180&&b<=180;
  const pointOf = (assignment) => assignment && numbers(assignment.latitude,assignment.longitude)
    ? {lat:assignment.latitude,lon:assignment.longitude} : null;
  const h = (tag, cls, txt) => {
    const e=document.createElement(tag);
    if (cls) e.className=cls;
    if (txt!==undefined) e.textContent=txt;
    return e;
  };
  const dateText = (value) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : 'No reading';
  const maps = {instance:null, markers:[], selectedId:null};
  let inventory=[], assignments=[], readings=[], activity=[], filter='all', search='', initialized=false;

  function seed() {
    inventory=load(KEYS.inventory);
    let changed=false;
    STARTERS.forEach(([family,n,manufacturer])=>{
      const name=n===null?family:family+' '+n;
      const id='emergenz-starter-'+family.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+(n??'rad');
      if (inventory.some(v=>v.id===id||(v.deviceName||'').trim().toLowerCase()===name.toLowerCase())) return;
      inventory.push({
        id,
        deviceName:name, manufacturer, model: family, serialNumber:'', sensorPackage:'',
        assignedUnit:'', primaryUse:'', status:'Available', readinessDataMode:'Unverified',
        sourceSystem:'EMERGENZ Starter Inventory', sourceMode:'Manual Reference',
        notes:'Model-specific readiness, serial number and sensor package not verified.',
        createdAt:new Date().toISOString()
      });
      changed=true;
    });
    if(changed && !save(KEYS.inventory,inventory)) status('Starter inventory is currently session-only; local storage unavailable.');
    assignments=load(KEYS.assignments); readings=load(KEYS.readings); activity=load(KEYS.activity);
  }
  function activeAssignment(id) { return assignments.find(a=>a.monitorId===id) || null; }
  function latestReading(a) {
    if(!a) return null;
    return readings.filter(r=>r.assignmentId===a.id).sort((x,y)=>Date.parse(y.dateTime||0)-Date.parse(x.dateTime||0))[0]||null;
  }
  function latestFor(id) { return latestReading(activeAssignment(id)); }
  function readingText(r) { return r ? [r.sensor,r.readingValue,r.unit].filter(v=>v!==undefined&&v!=='').join(' ') : 'NO READINGS RECORDED'; }
  function familyOf(item) {
    const n=(item.model||item.deviceName||'').toLowerCase();
    if(n.includes('multirae lite')) return '';
    if(n.includes('multirae pro')) return 'MultiRAE Pro';
    if(n.includes('multirae')) return 'MultiRAE';
    if(n.includes('arearae')) return 'AreaRAE';
    if(n.includes('toxirae')) return 'ToxiRAE';
    if(n.includes('ludlum')) return 'Ludlum RAD';
    if(n.includes('radeye')) return 'RadEye';
    return '';
  }
  function setUnitPhoto(box,item) {
    const fam=familyOf(item), ref=PRODUCT_REFERENCE[fam];
    box.replaceChildren();
    if(ref?.verified) {
      const image=h('img','monitor-unit-photo'); image.src=ref.src; image.alt=fam+' manufacturer reference product photograph'; image.loading='lazy';
      image.onerror=()=>{image.remove(); box.append(h('span','monitor-image-pending','IMAGE UNAVAILABLE'));};
      box.append(image);
    } else box.append(h('span','monitor-image-pending','MODEL PHOTO PENDING'));
    const link=h('a','monitor-photo-source',ref ? 'MFR REFERENCE ↗' : 'MODEL UNVERIFIED');
    if(ref?.url) {link.href=ref.url;link.target='_blank';link.rel='noopener noreferrer';}
    else link.setAttribute('aria-disabled','true');
    box.append(link);
  }
  function emit() {
    window.dispatchEvent(new CustomEvent('emergenz:monitoring-updated'));
  }
  function refreshAll() {
    const selection=$('monitor-entry-device')?.value||'';
    seed(); renderCounts(); renderUnits(); renderReadings(); renderReadingOptions();
    if(selection && inventory.some(m=>m.id===selection))$('monitor-entry-device').value=selection;
    renderMapMarkers();emit();
  }
  function renderCounts() {
    const total=inventory.length;
    const deployed=inventory.filter(v=>activeAssignment(v.id)).length;
    const available=inventory.filter(v=>!activeAssignment(v.id) && v.status!=='Out of Service').length;
    // Current alarms are derived from the most recent observation per deployed unit,
    // never accumulated from historical alarm readings.
    const activeAlarms=assignments.filter(a=>latestReading(a)?.alarmState==='Alarm').length;
    const mapped=mappedMonitors().length;
    const items={ 'monitor-total-count':total,'monitor-deployed-count':deployed,'monitor-available-count':available,
      'monitor-readings-count':readings.filter(r=>r.dataMode==='Manual'||!r.dataMode).length,
      'monitor-alarm-count':activeAlarms,'monitor-location-count':mapped};
    Object.entries(items).forEach(([id,n])=>{ if($(id)) $(id).textContent=String(Math.max(0,n)); });
  }
  function renderUnits() {
    const host=$('monitor-console-units'); if(!host) return;
    host.replaceChildren();
    const list=inventory.filter(item=>{
      const assignment=activeAssignment(item.id);
      if(filter==='deployed'&&!assignment) return false;
      if(filter==='available'&&(assignment||item.status==='Out of Service')) return false;
      if(filter==='manual'&&!latestFor(item.id)) return false;
      if(filter==='oos'&&item.status!=='Out of Service') return false;
      return [item.deviceName,item.model,assignment?.team,assignment?.location].join(' ').toLowerCase().includes(search);
    });
    for(const item of list){
      const a=activeAssignment(item.id), r=latestReading(a);
      const card=h('article','monitor-unit-card'); card.dataset.id=item.id;
      const photo=h('div','monitor-unit-photo-wrap');setUnitPhoto(photo,item);
      const body=h('div','monitor-unit-body');
      const head=h('div','monitor-unit-head');head.append(h('h3','',item.deviceName));
      head.append(h('span','monitor-unit-state '+(a?(r?'is-manual':'is-deployed'):item.status==='Out of Service'?'is-oos':'is-available'),
        a?(r?'MANUAL DATA':'DEPLOYED'):item.status==='Out of Service'?'OUT OF SERVICE':'AVAILABLE'));
      body.append(head,h('p','monitor-model-label',[item.manufacturer,item.model].filter(Boolean).join(' • ')));
      const info=h('div','monitor-unit-info');
      [['ASSIGNED TO',a?.team||'Not assigned'],['DEPLOYMENT',a?.role||'Not deployed'],
        ['LOCATION',a?.location||'Not assigned'],['LATEST READING',readingText(r)],
        ['OBSERVED',dateText(r?.dateTime)]].forEach(([k,v])=>{
          const block=h('div','');block.append(h('small','',k),h('strong','',v));info.append(block);
        });
      body.append(info);
      const actions=h('div','monitor-unit-actions');
      const entry=h('button','monitor-btn-primary','ENTER READING');entry.type='button';
      entry.addEventListener('click',()=>prepareReading(item.id));
      const assign=h('button','monitor-btn-secondary',a?'EDIT DEPLOYMENT':'DEPLOY UNIT');assign.type='button';
      assign.addEventListener('click',()=>openDeployment(item.id));
      const map=h('button','monitor-btn-plain','VIEW ON MAP');map.type='button';
      map.disabled=!pointOf(a);map.title=map.disabled?'Enter actual deployment coordinates to map this unit':'Center this unit on the map';
      map.addEventListener('click',()=>focusMap(item.id));
      const edit=h('button','monitor-btn-plain','EDIT DETAILS');edit.type='button';
      edit.addEventListener('click',()=>openUnitDialog(item.id));
      actions.append(entry,assign,map,edit);body.append(actions);card.append(photo,body);host.append(card);
    }
    if(!list.length)host.append(h('div','monitor-list-empty','No monitors match this filter.'));
  }
  function renderReadingOptions() {
    const select=$('monitor-entry-device');if(!select)return;
    const was=select.value;select.replaceChildren();
    select.add(new Option('Select monitor',''));
    inventory.forEach(m=>select.add(new Option(m.deviceName,m.id)));
    if(inventory.some(m=>m.id===was))select.value=was;
  }
  function updateUnits() {
    const s=$('monitor-entry-sensor'), u=$('monitor-entry-units');
    if(!s||!u)return;
    const options=SENSOR_UNITS[s.value]||SENSOR_UNITS.Other;
    u.replaceChildren(...options.map(v=>new Option(v,v)));
  }
  function prepareReading(deviceId) {
    const item=inventory.find(m=>m.id===deviceId);if(!item)return;
    const a=activeAssignment(deviceId);
    if(!a){openDeployment(deviceId);status('Assign this monitor to a deployment before recording incident readings.');return;}
    $('monitor-entry-device').value=deviceId;
    $('monitor-entry-location').value=a.location||'';
    $('monitor-entry-time').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    $('monitor-entry-value').value='';
    $('monitor-entry-notes').value='';
    $('monitor-manual-form').scrollIntoView({behavior:'smooth',block:'center'});
    $('monitor-entry-value').focus();
  }

  function openUnitDialog(id='') {
    const item=inventory.find(m=>m.id===id);
    $('monitor-unit-title').textContent=item?'EDIT MONITOR — '+item.deviceName:'ADD MONITOR';
    $('monitor-unit-id').value=item?.id||'';
    $('monitor-unit-name').value=item?.deviceName||'';
    $('monitor-unit-manufacturer').value=item?.manufacturer||'';
    $('monitor-unit-model').value=item?.model||'';
    $('monitor-unit-serial').value=item?.serialNumber||'';
    $('monitor-unit-sensors').value=item?.sensorPackage||'';
    $('monitor-unit-status').value=['Available','Out of Service','Unknown'].includes(item?.status)?item.status:'Available';
    $('monitor-unit-dialog').showModal();
    $('monitor-unit-name').focus();
  }
  function saveUnit(e) {
    e.preventDefault();
    const name=$('monitor-unit-name').value.trim();
    const id=$('monitor-unit-id').value||uid();
    if(!name){status('Unit name is required.');return;}
    if(inventory.some(m=>m.id!==id&&m.deviceName?.trim().toLowerCase()===name.toLowerCase())){
      status('Another monitor already has that name.');return;
    }
    const previous=inventory.find(m=>m.id===id)||{};
    const item={...previous,id,deviceName:name,manufacturer:$('monitor-unit-manufacturer').value.trim(),
      model:$('monitor-unit-model').value.trim(),serialNumber:$('monitor-unit-serial').value.trim(),
      sensorPackage:$('monitor-unit-sensors').value.trim(),status:$('monitor-unit-status').value,
      sourceSystem:previous.sourceSystem||'Manual EMERGENZ Entry',readinessDataMode:'Unverified',
      updatedAt:new Date().toISOString()};
    const next=inventory.some(m=>m.id===id)?inventory.map(m=>m.id===id?item:m):[...inventory,item];
    if(!save(KEYS.inventory,next))return;
    inventory=next;$('monitor-unit-dialog').close();refreshAll();status(name+' inventory details saved.');
  }
  function openDeployment(deviceId) {
    const item=inventory.find(m=>m.id===deviceId);
    if(!item)return;
    const a=activeAssignment(deviceId);
    $('monitor-deploy-id').value=deviceId;
    $('monitor-deploy-title').textContent=(a?'EDIT DEPLOYMENT — ':'DEPLOY — ')+item.deviceName;
    $('monitor-deploy-team').value=a?.team||'';
    $('monitor-deploy-role').value=a?.role||'';
    $('monitor-deploy-location').value=a?.location||'';
    $('monitor-deploy-lat').value=a?.latitude??'';
    $('monitor-deploy-lon').value=a?.longitude??'';
    $('monitor-deploy-notes').value=a?.notes||'';
    $('monitor-undeploy').hidden=!a;
    $('monitor-deploy-dialog').showModal();
  }
  function saveDeployment(e) {
    e.preventDefault();
    const id=$('monitor-deploy-id').value, item=inventory.find(m=>m.id===id);if(!item)return;
    const latText=$('monitor-deploy-lat').value.trim(),lonText=$('monitor-deploy-lon').value.trim();
    if(Boolean(latText)!==Boolean(lonText)){status('Provide both latitude and longitude or leave both blank.');return;}
    const lat=latText?Number(latText):null, lon=lonText?Number(lonText):null;
    if(latText&&!numbers(lat,lon)){status('Deployment coordinates are outside valid ranges.');return;}
    const team=$('monitor-deploy-team').value.trim(),role=$('monitor-deploy-role').value.trim();
    const location=$('monitor-deploy-location').value.trim();
    if(!team||!role||!location){status('Team, deployment role, and location are required.');return;}
    const existing=activeAssignment(id);
    const next={...existing,id:existing?.id||uid(),monitorId:id,deviceName:item.deviceName,manufacturer:item.manufacturer,
      model:item.model,team,role,location,latitude:lat,longitude:lon,notes:$('monitor-deploy-notes').value.trim(),
      sourceSystem:'Manual EMERGENZ Entry',dataMode:'Manual / No live connection',updatedAt:new Date().toISOString()};
    const nextAssignments=existing?assignments.map(a=>a.id===existing.id?next:a):[...assignments,next];
    if(!save(KEYS.assignments,nextAssignments))return;
    assignments=nextAssignments;
    logAction(next,'Monitor '+(existing?'assignment updated':'deployed'));
    $('monitor-deploy-dialog').close();refreshAll();
    status(item.deviceName+' deployment saved. '+(latText?'Map marker available.':'Add coordinates to display on maps.'));
  }
  function undeploy() {
    const id=$('monitor-deploy-id').value,a=activeAssignment(id);
    if(!a)return;
    if(!window.confirm('Remove '+a.deviceName+' from its deployment? Historical readings are retained.'))return;
    const next=assignments.filter(x=>x.id!==a.id);
    if(!save(KEYS.assignments,next))return;
    assignments=next;logAction(a,'Monitor removed from deployment');
    $('monitor-deploy-dialog').close();refreshAll();status(a.deviceName+' is now available.');
  }
  function logAction(a,label,r) {
    activity.push({id:uid(),dateTime:new Date().toISOString(),monitorName:a.deviceName,monitorId:a.monitorId,
      assignmentId:a.id,role:a.role,location:a.location,entryType:label,
      sensor:r?.sensor||'',readingValue:r?.readingValue||'',unit:r?.unit||'',alarmState:r?.alarmState||'Unknown',
      enteredBy:r?.enteredBy||'',notes:r?.notes||'',includeInReport:true,createdAt:new Date().toISOString()});
    save(KEYS.activity,activity);
  }
  function saveReading(e) {
    e.preventDefault();
    const id=$('monitor-entry-device').value,a=activeAssignment(id);
    if(!a){status('Assign a deployment to this monitor before recording an incident reading. Select DEPLOY UNIT in the monitor list.');return;}
    const model=familyOf(inventory.find(v=>v.id===id)||{});
    const sensor=$('monitor-entry-sensor').value;
    const radiationDevice=model==='Ludlum RAD'||model==='RadEye';
    const radiationSensor=sensor==='Gamma Dose Rate'||sensor==='Radiation Counts';
    if(radiationDevice && !radiationSensor && sensor!=='Other'){
      status('Verify the device: a radiation survey meter does not report this gas-sensor parameter.');return;
    }
    if(!radiationDevice && radiationSensor){
      status('Select a radiological instrument for a radiation measurement.');return;
    }
    const raw=$('monitor-entry-value').value.trim(), v=Number(raw);
    if(raw===''||!Number.isFinite(v)){status('Enter a valid numeric observation.');return;}
    const time=$('monitor-entry-time').value;
    if(!time||!Number.isFinite(Date.parse(time))){status('A valid observation time is required.');return;}
    const record={id:uid(),assignmentId:a.id,monitorId:id,monitorName:a.deviceName,
      dateTime:new Date(time).toISOString(),sensor:$('monitor-entry-sensor').value,readingValue:String(v),
      unit:$('monitor-entry-units').value,location:$('monitor-entry-location').value.trim()||a.location,
      enteredBy:$('monitor-entry-reporter').value.trim(),notes:$('monitor-entry-notes').value.trim(),
      alarmState:$('monitor-entry-alarm').value,dataMode:'Manual',
      createdAt:new Date().toISOString(),includeInReport:true};
    if(!save(KEYS.readings,[...readings,record]))return;
    readings.push(record);logAction(a,'Manual reading recorded',record);
    refreshAll();status(record.monitorName+' reading recorded as MANUAL at '+dateText(record.dateTime)+'.');
    $('monitor-entry-value').value='';$('monitor-entry-value').focus();
  }
  function renderReadings() {
    const body=$('monitor-recent-body');if(!body)return;
    body.replaceChildren();
    [...readings].sort((a,b)=>Date.parse(b.dateTime||0)-Date.parse(a.dateTime||0)).slice(0,12).forEach(r=>{
      const tr=h('tr');
      [dateText(r.dateTime),r.monitorName,r.sensor,r.readingValue,r.unit,r.location||'Unspecified',r.dataMode||'Manual'].forEach(v=>tr.append(h('td','',v||'—')));
      body.append(tr);
    });
    $('monitor-reading-empty').hidden=readings.length>0;
  }
  function mappedMonitors() {
    return assignments.filter(a=>pointOf(a)).map(a=>{
      const r=latestReading(a);
      return {id:a.id,monitorId:a.monitorId,deviceName:a.deviceName,assignmentRole:a.role,
        team:a.team,deploymentLocation:a.location,latestReadingSummary:readingText(r),
        observedAt:r?.dateTime||null,dataMode:r?.dataMode||'No readings',alarmState:r?.alarmState||'Unknown',
        latitude:a.latitude,longitude:a.longitude,sourceSystem:a.sourceSystem||'Manual'};
    });
  }
  window.getHazMatIQMonitorMarkers=mappedMonitors;
  function ensureMap() {
    const rows=mappedMonitors();
    // Show an ordinary geographic basemap without inventing a monitor, plume or incident.
    $('monitor-map-empty').hidden=rows.length>0;
    if(!window.maplibregl){status('MapLibre unavailable. Monitor data remains saved.');return;}
    if(maps.instance)return;
    const first=rows[0];
    const style={version:8,sources:{satellite:{type:'raster',tiles:[
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],tileSize:256,maxzoom:19}},layers:[{id:'satellite',type:'raster',source:'satellite'}]};
    try{
      maps.instance=new maplibregl.Map({container:'monitor-map-canvas',style,
        center:first?[first.longitude,first.latitude]:[-95.7,37.1],zoom:first?15:4});
      maps.instance.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
      maps.instance.on('error',()=>{status('Monitoring basemap unavailable; saved coordinates remain accessible.');});
      maps.instance.on('load',renderMapMarkers);
    }catch{status('Monitoring map could not initialize; readings remain accessible.');}
  }
  function renderMapMarkers() {
    const rows=mappedMonitors();
    $('monitor-map-empty').hidden=rows.length>0;
    if(!maps.instance)ensureMap();
    if(!maps.instance)return;
    maps.markers.forEach(m=>m.remove());maps.markers=[];
    rows.forEach(p=>{
      const node=h('button','monitor-map-pin',p.alarmState==='Alarm'?'!':'M');
      if(p.alarmState==='Alarm')node.classList.add('monitor-map-pin-alert');
      node.type='button';node.title=p.deviceName+' • '+p.latestReadingSummary;
      node.addEventListener('click',()=>focusMap(p.monitorId,false));
      const marker=new maplibregl.Marker({element:node}).setLngLat([p.longitude,p.latitude]).addTo(maps.instance);
      maps.markers.push(marker);
    });
    if($('monitor').classList.contains('active')) requestAnimationFrame(()=>maps.instance?.resize());
    const count=$('monitor-mapped-count');if(count)count.textContent=rows.length+' LOCATED';
  }
  function focusMap(id,scroll=true) {
    const a=activeAssignment(id), p=pointOf(a);
    if(!p){status('Map location unavailable. Add valid coordinates in Deployment.');return;}
    ensureMap();
    if(maps.instance){maps.instance.resize();maps.instance.flyTo({center:[p.lon,p.lat],zoom:Math.max(15,maps.instance.getZoom()),essential:true});}
    const r=latestReading(a);
    const panel=$('monitor-map-selection');
    panel.replaceChildren(h('strong','',a.deviceName),h('span','',a.team+' • '+a.location),
      h('span','',readingText(r)),h('small','',r?'Manual • '+dateText(r.dateTime):'No readings recorded'));
    panel.hidden=false;
    if(scroll)$('monitor-map-panel').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function init() {
    if(initialized)return;
    initialized=true;seed();
    document.querySelectorAll('[data-monitor-filter]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        filter=btn.dataset.monitorFilter;
        document.querySelectorAll('[data-monitor-filter]').forEach(x=>x.classList.toggle('active',x===btn));
        renderUnits();
      });
    });
    $('monitor-search').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();renderUnits();});
    $('monitor-add-unit').addEventListener('click',()=>openUnitDialog());
    $('monitor-unit-form').addEventListener('submit',saveUnit);
    $('monitor-unit-cancel').addEventListener('click',()=>$('monitor-unit-dialog').close());
    $('monitor-entry-sensor').addEventListener('change',updateUnits); updateUnits();
    $('monitor-entry-device').addEventListener('change',e=>{
      const a=activeAssignment(e.target.value); $('monitor-entry-location').value=a?.location||'';
    });
    $('monitor-manual-form').addEventListener('submit',saveReading);
    $('monitor-deployment-form').addEventListener('submit',saveDeployment);
    $('monitor-undeploy').addEventListener('click',undeploy);
    $('monitor-deploy-cancel').addEventListener('click',()=>$('monitor-deploy-dialog').close());
    $('monitor-map-recenter').addEventListener('click',()=>{
      const rows=mappedMonitors();if(rows.length)focusMap(rows[0].monitorId,false);
    });
    $('monitor-map-style')?.addEventListener('change',e=>{
      if (!maps.instance) return;
      const satellite={version:8,sources:{satellite:{type:'raster',tiles:[
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],tileSize:256,maxzoom:19}},layers:[{id:'satellite',type:'raster',source:'satellite'}]};
      maps.instance.setStyle(e.target.value==='street'
        ? 'https://tiles.openfreemap.org/styles/liberty'
        : satellite);
    });
    $('monitor-open-live-map').addEventListener('click',()=>{
      const rows=mappedMonitors();
      const target=rows.length?{latitude:rows[0].latitude,longitude:rows[0].longitude}:{};
      window.HazMatIQ ||= {};
      window.HazMatIQ.pendingMonitorMapFocus=target;
      document.querySelector('.app-primary-nav [data-view="map"]')?.click();
      window.dispatchEvent(new CustomEvent('emergenz:focus-monitor-live-map',{detail:target}));
      if(!rows.length)status('Live Map opened. No field monitors have documented coordinates yet.');
    });
    window.addEventListener('storage',(e)=>{if(Object.values(KEYS).includes(e.key)){refreshAll();}});
    window.addEventListener('emergenz:monitoring-open',e=>{if(e.detail?.monitorId)focusMap(e.detail.monitorId);});
    refreshAll();
  }
  window.HazMatIQ ||= {};
  window.HazMatIQ.initializeEquipmentPage=()=>{
    if(!initialized)init();
    if(maps.instance)requestAnimationFrame(()=>maps.instance.resize());
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();