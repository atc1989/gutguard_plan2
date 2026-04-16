/* STATE */
var curType = null, curWeek = 1;
var currentUser = null;
var childPlans = {member:[],leader:[],squad:[],platoon:[],o1:[]};
var savedPlansCache = {scopeId:null, plans:null};
var reviewQueueCache = {scopeId:null, plans:null};
var PARENT_ROLE = {member:'leader',leader:'squad',squad:'platoon',platoon:'o1',o1:null};
function makePlanMeta(){return {planId:null,status:'submitted',lastSavedAt:null};}
var planMeta = {
  member:makePlanMeta(),
  leader:makePlanMeta(),
  squad:makePlanMeta(),
  platoon:makePlanMeta(),
  o1:makePlanMeta()
};
var formDirty=false;
var draftAutosaveTimer=null;
var suppressDraftPersistence=false;

function getDraftScopeId(){
  return currentUser&&currentUser.id?currentUser.id:'guest';
}
function setFormDirty(nextValue, skipStatusRefresh){
  formDirty=!!nextValue;
  if(curType&&!skipStatusRefresh)updateSaveStatus(curType);
}
function clearDraftAutosaveTimer(){
  if(draftAutosaveTimer){
    clearTimeout(draftAutosaveTimer);
    draftAutosaveTimer=null;
  }
}
function persistLocalDraft(options){
  if(!curType||suppressDraftPersistence||!(window.GutguardPlanModel&&window.GutguardPlanModel.collectPlanData&&window.GutguardPlanModel.saveLocalDraft))return null;
  var plan=window.GutguardPlanModel.collectPlanData(curType,planMeta[curType]);
  plan.status=(planMeta[curType]&&planMeta[curType].planId)
    ?((planMeta[curType]&&planMeta[curType].status)||'submitted')
    :'draft';
  if(!(window.GutguardPlanModel.hasMeaningfulPlanData&&window.GutguardPlanModel.hasMeaningfulPlanData(plan))){
    if(window.GutguardPlanModel.clearLocalDraft)window.GutguardPlanModel.clearLocalDraft(curType,getDraftScopeId());
    return null;
  }
  return window.GutguardPlanModel.saveLocalDraft(curType,plan,planMeta[curType],getDraftScopeId());
}
function scheduleDraftAutosave(){
  if(!curType||suppressDraftPersistence)return;
  clearDraftAutosaveTimer();
  draftAutosaveTimer=setTimeout(function(){
    var savedDraft=persistLocalDraft();
    if(savedDraft&&curType)updateSaveStatus(curType,{message:'Unsaved changes are stored locally on this device.',tone:'n-warn',detail:savedDraft.saved_at?'Local draft updated: '+formatSavedAt(savedDraft.saved_at):''});
  },500);
}
function clearLocalDraftForType(type){
  clearDraftAutosaveTimer();
  if(window.GutguardPlanModel&&window.GutguardPlanModel.clearLocalDraft){
    window.GutguardPlanModel.clearLocalDraft(type,getDraftScopeId());
  }
}
function restoreLocalDraft(type, preferredPlanId){
  if(!(window.GutguardPlanModel&&window.GutguardPlanModel.getLocalDraft&&window.GutguardPlanModel.hydratePlanData))return false;
  var draft=window.GutguardPlanModel.getLocalDraft(type,getDraftScopeId());
  if(!draft||!draft.plan)return false;
  var draftPlanId=(draft.meta&&draft.meta.planId)||(draft.plan&&draft.plan.id)||null;
  if(preferredPlanId&&draftPlanId!==preferredPlanId)return false;
  if(preferredPlanId===null&&draftPlanId)return false;
  suppressDraftPersistence=true;
  try{
    window.GutguardPlanModel.hydratePlanData(type,draft.plan);
  }finally{
    suppressDraftPersistence=false;
  }
  planMeta[type]={
    planId:draftPlanId,
    status:(draft.meta&&draft.meta.status)||(draft.plan&&draft.plan.status)||'draft',
    lastSavedAt:(draft.meta&&draft.meta.lastSavedAt)||null
  };
  setFormDirty(true,true);
  updateSaveStatus(type,{message:'Restored unsaved local changes from this device.',tone:'n-warn',detail:draft.saved_at?'Local draft updated: '+formatSavedAt(draft.saved_at):''});
  return true;
}
function attachDraftTracking(){
  var root=document.getElementById('forminner');
  if(!root)return;
  if(root.dataset.draftTrackingAttached==='true')return;
  root.dataset.draftTrackingAttached='true';
  root.addEventListener('input',function(){
    if(suppressDraftPersistence)return;
    setFormDirty(true,true);
    refreshSubmitButtonState(curType);
    scheduleDraftAutosave();
  });
  root.addEventListener('change',function(){
    if(suppressDraftPersistence)return;
    setFormDirty(true,true);
    refreshSubmitButtonState(curType);
    scheduleDraftAutosave();
  });
}

// wkData[type][week][activity] = {leads,att,pi,sales,date,...}
var wkData = {member:{},leader:{},squad:{},platoon:{},o1:{}};
var calEvts = {member:{},leader:{},squad:{},platoon:{},o1:{}};

// Consolidation: subMembers[type] = [{name, pi, sales, leads, att, evt, role}]
var subMembers = {member:[],leader:[],squad:[],platoon:[],o1:[]};

// Target inputs [type] = {pi, sales}
var targets = {member:{pi:0,sales:0},leader:{pi:0,sales:0},squad:{pi:0,sales:0},platoon:{pi:0,sales:0},o1:{pi:0,sales:0}};

var ACTIVITIES = {
  member:  ['Invite / Prospect','Product Presentation','Business Presentation','Training','Testimonial Session','Leader Fellowship','Big Event'],
  leader:  ['Product Presentation','Business Presentation','Training','Testimonial Session','Leader Fellowship','Big Event','Team Meeting'],
  squad:   ['Product Presentation','Business Presentation','Training','Testimonial Session','Leader Fellowship','Big Event','Squad Meeting'],
  platoon: ['Product Presentation','Business Presentation','Training','Big Event','Platoon Meeting','Leader Fellowship'],
  o1:      ['Product Presentation','Business Presentation','Training','Testimonial Session','Leader Fellowship','Big Event','Planning Workshop']
};

var EXTRA_COLS = {
  member:  [{key:'notes',label:'Notes',type:'txt'}],
  leader:  [{key:'assigned',label:'Assigned Members',type:'txt'},{key:'venue',label:'Venue',type:'txt'}],
  squad:   [{key:'leader',label:'Resp. Leader',type:'txt'},{key:'venue',label:'Venue',type:'txt'}],
  platoon: [{key:'leader',label:'Resp. Leader',type:'txt'},{key:'venue',label:'Venue',type:'txt'}],
  o1:      [{key:'leader',label:'Assigned Leader',type:'txt'},{key:'venue',label:'Venue',type:'txt'}]
};

var SUB_ROLES = {
  leader:'Member', squad:'Team Leader', platoon:'Squad Leader', o1:'Platoon Leader', member:null
};

function todayStr(){var n=new Date(),p=v=>String(v).padStart(2,'0');return n.getFullYear()+'-'+p(n.getMonth()+1)+'-'+p(n.getDate());}
function formatSavedAt(value){
  if(!value)return '';
  var d=new Date(value);
  if(isNaN(d.getTime()))return '';
  return d.toLocaleString();
}
function clearNode(el){
  while(el&&el.firstChild)el.removeChild(el.firstChild);
}
function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
function renderPlanMeta(metaEl,label,planId,savedAt){
  clearNode(metaEl);
  if(!planId)return;
  metaEl.appendChild(document.createTextNode(label+': '));
  var code=document.createElement('code');
  code.textContent=planId;
  metaEl.appendChild(code);
  if(savedAt){
    metaEl.appendChild(document.createTextNode(' | Last saved: '+formatSavedAt(savedAt)));
  }
}
function setStatusText(el,text,strongText){
  clearNode(el);
  el.appendChild(document.createTextNode(text));
  if(strongText){
    var strong=document.createElement('strong');
    strong.textContent=strongText;
    el.appendChild(strong);
  }
}
function setSelectMessage(selectEl,message){
  clearNode(selectEl);
  var option=document.createElement('option');
  option.value='';
  option.textContent=message;
  selectEl.appendChild(option);
}
function setSavedPlansMessage(listEl,message){
  clearNode(listEl);
  var empty=document.createElement('div');
  empty.className='saved-plan-empty';
  empty.textContent=message;
  listEl.appendChild(empty);
}
function getParentSelectState(type){
  var selectEl=document.getElementById(type+'-parent-plan-id');
  if(!selectEl){
    return {selectEl:null,parentState:'missing',value:'',hasMatchingOption:false};
  }
  var value=selectEl.value||'';
  var hasMatchingOption=false;
  Array.from(selectEl.options||[]).forEach(function(option){
    if(option.value&&option.value===value)hasMatchingOption=true;
  });
  return {
    selectEl:selectEl,
    parentState:selectEl.dataset.parentState||'',
    value:value,
    hasMatchingOption:hasMatchingOption
  };
}
function hasValidParentSelection(type){
  if(!PARENT_ROLE[type]) return true;
  var state=getParentSelectState(type);
  if(!state.selectEl) return false;
  if(state.parentState!=='loaded') return false;
  return !!(state.value&&state.hasMatchingOption);
}
function getFriendlySaveError(err){
  var raw=(err&&err.message)?String(err.message):'';
  if(/row-level security policy.*plans/i.test(raw)){
    if(curType&&PARENT_ROLE[curType]){
      if(curType==='member'){
        return 'Supabase blocked this save because the selected parent plan is not valid under the current schema. The plan saves under the currently signed-in email, not the typed full name. Sign in as the actual member account, rerun supabase-schema.sql, make sure the parent account has already saved a leader plan, then sign in again and reselect the parent plan.';
      }
      if(curType==='leader'||curType==='squad'||curType==='platoon'){
        return 'Supabase blocked this save because the selected parent plan is not valid under the current schema. The plan saves under the currently signed-in email, not the typed full name. Sign in as the actual '+TYPE_LABEL[curType]+' account, rerun supabase-schema.sql and supabase-hierarchy-link-directory.sql, make sure the parent account has already saved its plan, then sign in again and reselect the parent plan.';
      }
    }
    return 'Supabase blocked this save under the current Row Level Security rules. The plan saves under the currently signed-in email, not the typed full name. Confirm you are signed in to the correct account and reran the latest supabase-schema.sql.';
  }
  return raw||'Failed to save plan.';
}
function getPlanStatusClass(status){
  var normalized=(status||'submitted').toLowerCase().replace(/[^a-z0-9]+/g,'_');
  return normalized||'submitted';
}
function buildSavedPlanCard(plan){
  var card=document.createElement('div');
  card.className='saved-plan-card';

  var top=document.createElement('div');
  top.className='saved-plan-top';

  var role=document.createElement('div');
  role.className='saved-plan-role';
  role.textContent=TYPE_LABEL[plan.role_type]||plan.role_type;
  top.appendChild(role);

  var status=document.createElement('div');
  status.className='saved-plan-status '+getPlanStatusClass(plan.status);
  status.textContent=plan.status||'submitted';
  top.appendChild(status);
  card.appendChild(top);

  var name=document.createElement('div');
  name.className='saved-plan-name';
  name.textContent=plan.full_name||'(No Name)';
  card.appendChild(name);

  var updated=plan.updated_at?formatSavedAt(plan.updated_at):(plan.created_at?formatSavedAt(plan.created_at):'');
  var meta=document.createElement('div');
  meta.className='saved-plan-meta';
  meta.textContent=(updated?'Updated: '+updated:'Never updated');
  card.appendChild(meta);

  var idMeta=document.createElement('div');
  idMeta.className='saved-plan-meta';
  idMeta.style.marginTop='.25rem';
  idMeta.appendChild(document.createTextNode('Plan ID: '));
  var code=document.createElement('code');
  code.textContent=plan.id;
  idMeta.appendChild(code);
  card.appendChild(idMeta);

  if(plan.owner_role||plan.parent_plan_id){
    var extraMeta=document.createElement('div');
    extraMeta.className='saved-plan-meta';
    extraMeta.style.marginTop='.25rem';
    var parts=[];
    if(plan.owner_role)parts.push('Owner role: '+(TYPE_LABEL[plan.owner_role]||plan.owner_role));
    if(plan.parent_plan_id)parts.push('Parent linked');
    if(plan.reviewed_at)parts.push('Reviewed: '+formatSavedAt(plan.reviewed_at));
    extraMeta.textContent=parts.join(' | ');
    card.appendChild(extraMeta);
  }
  if(plan.review_notes){
    var reviewMeta=document.createElement('div');
    reviewMeta.className='saved-plan-meta';
    reviewMeta.style.marginTop='.35rem';
    reviewMeta.textContent='Review note: '+plan.review_notes;
    card.appendChild(reviewMeta);
  }

  var actions=document.createElement('div');
  actions.className='saved-plan-actions';
  var openBtn=document.createElement('button');
  openBtn.className='btn btp';
  openBtn.type='button';
  openBtn.textContent='Open';
  openBtn.addEventListener('click',function(){
    openSavedPlan(plan.id,plan.role_type);
  });
  actions.appendChild(openBtn);
  var duplicateBtn=document.createElement('button');
  duplicateBtn.className='btn bto';
  duplicateBtn.type='button';
  duplicateBtn.textContent='Duplicate';
  duplicateBtn.addEventListener('click',function(){
    duplicateSavedPlan(plan.id,plan.role_type);
  });
  actions.appendChild(duplicateBtn);
  if((plan.status||'submitted').toLowerCase()==='draft'){
    var deleteBtn=document.createElement('button');
    deleteBtn.className='btn btn-danger-lite';
    deleteBtn.type='button';
    deleteBtn.textContent='Delete Draft';
    deleteBtn.addEventListener('click',function(){
      deleteSavedPlan(plan.id,plan.role_type);
    });
    actions.appendChild(deleteBtn);
  }
  card.appendChild(actions);

  return card;
}
function buildReviewQueueCard(plan){
  var card=buildSavedPlanCard(plan);
  var actions=card.querySelector('.saved-plan-actions');
  if(!actions)return card;
  clearNode(actions);

  var openBtn=document.createElement('button');
  openBtn.className='btn btp';
  openBtn.type='button';
  openBtn.textContent='Open';
  openBtn.addEventListener('click',function(){
    openSavedPlan(plan.id,plan.role_type);
  });
  actions.appendChild(openBtn);

  var approveBtn=document.createElement('button');
  approveBtn.className='btn btn-success-lite';
  approveBtn.type='button';
  approveBtn.textContent='Approve';
  approveBtn.addEventListener('click',function(){
    submitPlanReview(plan,'approved');
  });
  actions.appendChild(approveBtn);

  var revisionBtn=document.createElement('button');
  revisionBtn.className='btn btn-danger-lite';
  revisionBtn.type='button';
  revisionBtn.textContent='Needs Revision';
  revisionBtn.addEventListener('click',function(){
    submitPlanReview(plan,'needs_revision');
  });
  actions.appendChild(revisionBtn);

  return card;
}
function resetSavedPlansCache(){
  savedPlansCache={scopeId:getDraftScopeId(),plans:null};
  reviewQueueCache={scopeId:getDraftScopeId(),plans:null};
}
async function fetchSavedPlans(forceRefresh){
  var scopeId=getDraftScopeId();
  if(!forceRefresh&&savedPlansCache.scopeId===scopeId&&Array.isArray(savedPlansCache.plans)){
    return savedPlansCache.plans.slice();
  }
  var plans=await window.GutguardPlanApi.listPlans(null);
  savedPlansCache={scopeId:scopeId,plans:plans.slice()};
  return plans;
}
async function fetchReviewQueue(forceRefresh){
  var scopeId=getDraftScopeId();
  if(!forceRefresh&&reviewQueueCache.scopeId===scopeId&&Array.isArray(reviewQueueCache.plans)){
    return reviewQueueCache.plans.slice();
  }
  var plans=await window.GutguardPlanApi.listReviewQueue();
  reviewQueueCache={scopeId:scopeId,plans:plans.slice()};
  return plans;
}
function filterSavedPlans(plans){
  var roleEl=document.getElementById('saved-plans-filter');
  var statusEl=document.getElementById('saved-plans-status');
  var searchEl=document.getElementById('saved-plans-search');
  var roleType=roleEl?roleEl.value:'';
  var statusFilter=statusEl?statusEl.value:'';
  var searchTerm=searchEl&&searchEl.value?searchEl.value.trim().toLowerCase():'';
  return (plans||[]).filter(function(plan){
    if(roleType&&plan.role_type!==roleType)return false;
    if(statusFilter&&(plan.status||'submitted')!==statusFilter)return false;
    if(!searchTerm)return true;
    var haystack=[
      plan.full_name||'',
      plan.id||'',
      plan.status||'',
      TYPE_LABEL[plan.role_type]||plan.role_type||'',
      TYPE_LABEL[plan.owner_role]||plan.owner_role||'',
      plan.parent_plan_id?'parent linked':''
    ].join(' ').toLowerCase();
    return haystack.indexOf(searchTerm)!==-1;
  });
}
function renderSavedPlanStats(allPlans, filteredPlans){
  var container=document.getElementById('saved-plan-stats');
  if(!container) return;
  var plans=Array.isArray(allPlans)?allPlans:[];
  var visiblePlans=Array.isArray(filteredPlans)?filteredPlans:plans;
  var submittedCount=plans.filter(function(plan){return (plan.status||'submitted').toLowerCase()==='submitted';}).length;
  var draftCount=plans.filter(function(plan){return (plan.status||'submitted').toLowerCase()==='draft';}).length;
  var newestPlan=plans.slice().sort(function(a,b){
    var aTime=Date.parse(a.updated_at||a.created_at||0)||0;
    var bTime=Date.parse(b.updated_at||b.created_at||0)||0;
    return bTime-aTime;
  })[0]||null;
  var stats=[
    {
      label:'Total Plans',
      value:String(plans.length),
      meta:visiblePlans.length===plans.length? 'All saved records' : ('Filtered view: '+visiblePlans.length)
    },
    {
      label:'Submitted',
      value:String(submittedCount),
      meta:'Submitted plans ready to reopen'
    },
    {
      label:'Drafts',
      value:String(draftCount),
      meta:'Drafts still pending completion'
    },
    {
      label:'Last Updated',
      value:newestPlan?(TYPE_LABEL[newestPlan.role_type]||newestPlan.role_type||'-'):'-',
      meta:newestPlan&& (newestPlan.updated_at||newestPlan.created_at)
        ?('Updated '+formatSavedAt(newestPlan.updated_at||newestPlan.created_at))
        :'No saved activity yet'
    }
  ];
  clearNode(container);
  stats.forEach(function(stat){
    var card=document.createElement('div');
    card.className='saved-plan-stat-card';
    var label=document.createElement('div');
    label.className='saved-plan-stat-label';
    label.textContent=stat.label;
    var value=document.createElement('div');
    value.className='saved-plan-stat-value';
    value.textContent=stat.value;
    var meta=document.createElement('div');
    meta.className='saved-plan-stat-meta';
    meta.textContent=stat.meta;
    card.appendChild(label);
    card.appendChild(value);
    card.appendChild(meta);
    container.appendChild(card);
  });
}
function updateSaveStatus(type, state){
  var statusEl=document.getElementById(type+'-save-state');
  var metaEl=document.getElementById(type+'-save-meta');
  if(!statusEl||!metaEl)return;
  var apiReady=!!(window.GutguardPlanApi&&window.GutguardPlanApi.isConfigured&&window.GutguardPlanApi.isConfigured());
  var storedRef=window.GutguardPlanModel&&window.GutguardPlanModel.getStoredPlanRef?window.GutguardPlanModel.getStoredPlanRef(type,getDraftScopeId()):null;
  var localDraft=window.GutguardPlanModel&&window.GutguardPlanModel.getLocalDraft?window.GutguardPlanModel.getLocalDraft(type,getDraftScopeId()):null;
  var meta=planMeta[type]||makePlanMeta();
  var tone='n-info';
  var message='';
  var detail='';

  if(state&&state.message){
    tone=state.tone||tone;
    message=state.message;
    detail=state.detail||'';
  }else if(!apiReady){
    tone='n-danger';
    message='Supabase is not configured yet. Set your project URL and anon key in supabase-config.js before saving.';
  }else if(!currentUser){
    tone='n-danger';
    message='Sign in first. Save, load, and saved-plan browsing are protected by Supabase auth and RLS.';
  }else if(formDirty&&curType===type){
    tone='n-warn';
    message='You have unsaved local changes on this device.';
    detail=(localDraft&&localDraft.saved_at)?'Local draft updated: '+formatSavedAt(localDraft.saved_at):'Autosave pending...';
  }else if(localDraft&&curType===type){
    tone='n-warn';
    message='A local draft is available on this device.';
    detail=localDraft.saved_at?'Local draft updated: '+formatSavedAt(localDraft.saved_at):'';
  }else if(meta.planId){
    if(meta.status==='draft'){
      tone='n-warn';
      message='Connected to Supabase. This plan is currently saved as a draft.';
    }else if(meta.status==='needs_revision'){
      tone='n-danger';
      message='This plan needs revision before it can be treated as complete.';
    }else if(meta.status==='approved'){
      tone='n-success';
      message='This plan has been approved in the review workflow.';
    }else{
      tone='n-success';
      message='Connected to Supabase. This form is linked to a saved plan.';
    }
    detail='Plan ID: <code>'+meta.planId+'</code>'+(meta.lastSavedAt?' | Last saved: '+formatSavedAt(meta.lastSavedAt):'')+' | Status: '+(meta.status||'submitted');
  }else if(storedRef&&storedRef.planId){
    tone='n-info';
    message='A saved plan is available for this role on this device.';
    detail='Remembered plan ID: <code>'+storedRef.planId+'</code>'+(storedRef.updatedAt?' | Last saved: '+formatSavedAt(storedRef.updatedAt):'');
  }else{
    tone='n-info';
    message='This is a new local form. Save it to Supabase to create a persistent plan.';
  }

  statusEl.className='notice '+tone;
  statusEl.textContent=message;
  if(state&&state.detail){
    clearNode(metaEl);
    metaEl.textContent=state.detail;
  }else if(meta.planId){
    renderPlanMeta(metaEl,'Plan ID',meta.planId,meta.lastSavedAt);
  }else if(storedRef&&storedRef.planId){
    renderPlanMeta(metaEl,'Remembered plan ID',storedRef.planId,storedRef.updatedAt);
  }else{
    clearNode(metaEl);
  }
}
function hasPlannerActivity(type){
  var hasPlanner = false;
  var weeks = wkData[type] || {};
  Object.keys(weeks).forEach(function(week){
    var entries = weeks[week] || {};
    Object.keys(entries).forEach(function(act){
      var row = entries[act] || {};
      if(row.date || Number(row.leads) || Number(row.att) || Number(row.pi) || Number(row.sales)){
        hasPlanner = true;
      }
    });
  });
  return hasPlanner;
}
function canSubmitForm(type){
  var errors = [];
  var fullNameEl = document.querySelector('#info-name');
  var fullName = fullNameEl && fullNameEl.value.trim();
  if(!fullName){
    errors.push('Enter your name.');
  }
  var calStart = document.getElementById(type+'-cs');
  if(!calStart || !calStart.value){
    errors.push('Set the calendar start date.');
  }
  var tgtPi = parseInt(document.getElementById(type+'-tgt-pi')&&document.getElementById(type+'-tgt-pi').value)||0;
  var tgtSales = parseInt(document.getElementById(type+'-tgt-sales')&&document.getElementById(type+'-tgt-sales').value)||0;
  if(!tgtPi && !tgtSales){
    errors.push('Set a pay-in target or sales target.');
  }
  if(PARENT_ROLE[type]){
    var parentSelect = document.getElementById(type+'-parent-plan-id');
    if(parentSelect){
      var parentState = parentSelect.dataset.parentState || '';
      if(parentState === 'auth-required'){
        errors.push('Sign in to load parent plans.');
      } else if(parentState === 'no-parents'){
        errors.push('No parent plans found yet. Create one first.');
      } else if(parentState === 'load-error'){
        errors.push('Unable to load parent plans. Check your connection.');
      } else if(!parentSelect.value){
        errors.push('Select a parent '+TYPE_LABEL[PARENT_ROLE[type]]+' plan.');
      }
    } else {
      errors.push('Parent plan selection is required.');
    }
  }
  if(!hasPlannerActivity(type)){
    errors.push('Enter at least one weekly planner activity.');
  }
  return {ready: errors.length===0, errors: errors};
}
function getSectionProgress(type, submitState){
  if(!type)return [];
  submitState=submitState||canSubmitForm(type);
  var sections=[];
  var fullNameEl=document.getElementById('info-name');
  var fullName=fullNameEl&&fullNameEl.value.trim();
  var parentRole=PARENT_ROLE[type];
  var parentSelect=document.getElementById(type+'-parent-plan-id');
  var parentState=parentSelect?(parentSelect.dataset.parentState||''):'';
  var infoReady=!!fullName;
  var infoNote=fullName?'Name captured.':'Enter your name to identify the plan.';
  if(parentRole){
    if(parentSelect&&parentSelect.value){
      infoReady=infoReady&&true;
      infoNote=fullName
        ?('Name captured and linked to a parent '+TYPE_LABEL[parentRole]+' plan.')
        :('Parent '+TYPE_LABEL[parentRole]+' is selected. Enter your name to finish this section.');
    }else if(parentState==='auth-required'){
      infoReady=false;
      infoNote='Sign in to load parent plans.';
    }else if(parentState==='no-parents'){
      infoReady=false;
      infoNote='No parent '+TYPE_LABEL[parentRole]+' plan is available yet.';
    }else if(parentState==='load-error'){
      infoReady=false;
      infoNote='Parent plan lookup failed. Retry loading.';
    }else{
      infoReady=false;
      infoNote='Select the parent '+TYPE_LABEL[parentRole]+' plan.';
    }
  }
  sections.push({
    label:'Information',
    status:infoReady?'complete':'attention',
    note:infoNote,
    required:true,
    sectionKey:'info'
  });

  var calStart=document.getElementById(type+'-cs');
  var tgtPi=Number(document.getElementById(type+'-tgt-pi')&&document.getElementById(type+'-tgt-pi').value)||0;
  var tgtSales=Number(document.getElementById(type+'-tgt-sales')&&document.getElementById(type+'-tgt-sales').value)||0;
  var targetsReady=!!(calStart&&calStart.value&&(tgtPi||tgtSales));
  sections.push({
    label:'Targets',
    status:targetsReady?'complete':'attention',
    note:targetsReady
      ?('Calendar set with '+(tgtPi?('pay-in '+tgtPi.toLocaleString()):('sales PHP'+tgtSales.toLocaleString()))+'.')
      :'Set a calendar start date and at least one target.',
    required:true,
    sectionKey:'targets'
  });

  var plannerReady=hasPlannerActivity(type);
  sections.push({
    label:'Weekly Planner',
    status:plannerReady?'complete':'attention',
    note:plannerReady?'Planner has scheduled activity.':'Add at least one dated or quantified weekly activity.',
    required:true,
    sectionKey:'planner'
  });

  if(SUB_ROLES[type]){
    var linkedCount=(childPlans[type]||[]).length;
    var manualCount=(subMembers[type]||[]).length;
    var consolidationReady=linkedCount>0||manualCount>0;
    sections.push({
      label:'Consolidation',
      status:consolidationReady?'complete':'waiting',
      note:consolidationReady
        ?(linkedCount>0?linkedCount+' linked child plan'+(linkedCount===1?'':'s')+' found.':manualCount+' manual fallback entr'+(manualCount===1?'y':'ies')+' added.')
        :'Awaiting child plans or manual fallback entries.',
      required:false,
      sectionKey:'consolidation'
    });
  }else{
    sections.push({
      label:'Consolidation',
      status:'na',
      note:'Not required for member plans.',
      required:false,
      sectionKey:null
    });
  }

  sections.push({
    label:'Submit',
    status:submitState.ready?'complete':'waiting',
    note:submitState.ready?'All required checks are satisfied.':(submitState.errors[0]||'Complete the required sections to submit.'),
    required:true,
    sectionKey:'submit'
  });
  return sections;
}
function jumpToPlanSection(type, sectionKey){
  if(!type||!sectionKey)return;
  var targetMap={
    info:type+'-sec-info',
    targets:type+'-sec-targets',
    planner:type+'-sec-planner',
    consolidation:type+'-sec-consolidation',
    submit:type+'-sec-submit'
  };
  var targetId=targetMap[sectionKey];
  if(!targetId)return;
  var target=document.getElementById(targetId);
  if(!target)return;
  target.scrollIntoView({behavior:'smooth',block:'start'});
  var focusTarget=getSectionFocusTarget(type,sectionKey);
  if(focusTarget){
    setTimeout(function(){
      if(typeof focusTarget.focus==='function')focusTarget.focus({preventScroll:true});
      if(typeof focusTarget.select==='function'&&(focusTarget.tagName==='INPUT'||focusTarget.tagName==='TEXTAREA')&&focusTarget.type!=='date'&&focusTarget.type!=='number'){
        focusTarget.select();
      }
    },180);
  }
}
function getSectionFocusTarget(type, sectionKey){
  if(!type||!sectionKey)return null;
  if(sectionKey==='info'){
    var fullName=document.getElementById('info-name');
    var parentSelect=document.getElementById(type+'-parent-plan-id');
    if(fullName&&!fullName.value.trim())return fullName;
    if(parentSelect&&!parentSelect.disabled&&!parentSelect.value)return parentSelect;
    return fullName||parentSelect;
  }
  if(sectionKey==='targets'){
    var calStart=document.getElementById(type+'-cs');
    var piEl=document.getElementById(type+'-tgt-pi');
    var salesEl=document.getElementById(type+'-tgt-sales');
    if(calStart&&!calStart.value)return calStart;
    if(piEl&&salesEl&&!Number(piEl.value)&&!Number(salesEl.value))return piEl;
    return piEl||salesEl||calStart;
  }
  if(sectionKey==='planner'){
    if(!hasPlannerActivity(type)){
      return document.querySelector('#'+type+'-pbdy .td-d input')||document.querySelector('#'+type+'-pbdy .tn input');
    }
    return document.querySelector('#'+type+'-pbdy input');
  }
  if(sectionKey==='consolidation'){
    return document.querySelector('#'+type+'-con-container .cc-add-btn')||document.querySelector('#'+type+'-con-container .btn');
  }
  if(sectionKey==='submit'){
    return document.getElementById(type+'-submit-btn');
  }
  return null;
}
function updateSectionProgress(type, submitState){
  if(!type)return;
  var grid=document.getElementById(type+'-progress-grid');
  var summary=document.getElementById(type+'-progress-summary');
  var hint=document.getElementById(type+'-progress-hint');
  if(!grid||!summary||!hint)return;
  var sections=getSectionProgress(type,submitState);
  var requiredSections=sections.filter(function(section){return section.required;});
  var completedSections=requiredSections.filter(function(section){return section.status==='complete';}).length;
  summary.textContent=completedSections+' of '+requiredSections.length+' required sections complete';
  hint.textContent=submitState&&submitState.ready
    ?'Form is ready to submit.'
    :((submitState&&submitState.errors&&submitState.errors[0])||'Complete the remaining required sections to enable submit.');
  grid.innerHTML=sections.map(function(section){
    return '<button type="button" class="progress-item progress-nav '+section.status+'"'+
      (section.sectionKey?' onclick="jumpToPlanSection(\''+type+'\',\''+section.sectionKey+'\')"':' disabled aria-disabled="true"')+'>'+
      '<div class="progress-label">'+(section.required?'Required':'Optional')+'</div>'+
      '<div class="progress-name">'+escapeHtml(section.label)+'</div>'+
      '<div class="progress-note">'+escapeHtml(section.note)+'</div>'+
    '</button>';
  }).join('');
}
function refreshSubmitButtonState(type){
  var btn = document.getElementById(type+'-submit-btn');
  var hint = document.getElementById(type+'-submit-hint');
  if(!btn) return;
  var state = canSubmitForm(type);
  btn.disabled = !state.ready;
  if(hint){
    hint.textContent = state.ready ? 'Ready to submit.' : state.errors.join(' ');
  }
  updateSectionProgress(type,state);
  updateValidationMarkers(type,state.errors);
}
function setFieldInvalid(el, invalid){
  if(!el) return;
  var wrapper = el.closest('.f') || el.closest('.pib');
  if(wrapper){
    wrapper.classList.toggle('invalid', !!invalid);
  }
}
function setFieldError(el, message){
  if(!el) return;
  var wrapper = el.closest('.f') || el.closest('.pib');
  if(!wrapper) return;
  var errorEl = wrapper.querySelector('.field-error');
  if(!errorEl){
    errorEl = document.createElement('div');
    errorEl.className='field-error';
    wrapper.appendChild(errorEl);
  }
  errorEl.textContent = message || '';
  errorEl.style.display = message ? 'block' : 'none';
}
function clearFieldError(el){
  if(!el) return;
  var wrapper = el.closest('.f') || el.closest('.pib');
  if(!wrapper) return;
  var errorEl = wrapper.querySelector('.field-error');
  if(errorEl){
    errorEl.textContent='';
    errorEl.style.display='none';
  }
}
function clearValidationMarkers(type){
  var root = document.getElementById('forminner');
  if(!root) return;
  root.querySelectorAll('.invalid').forEach(function(el){
    el.classList.remove('invalid');
  });
  root.querySelectorAll('.field-error').forEach(function(el){
    el.textContent='';
    el.style.display='none';
  });
}
function updateValidationMarkers(type, errors){
  clearValidationMarkers(type);
  if(!type) return;

  var fullName = document.getElementById('info-name');
  var fullNameInvalid = fullName && !fullName.value.trim();
  setFieldInvalid(fullName, fullNameInvalid);
  setFieldError(fullName, fullNameInvalid ? 'Enter your name.' : '');

  var calStart = document.getElementById(type+'-cs');
  var calStartInvalid = calStart && !calStart.value;
  setFieldInvalid(calStart, calStartInvalid);
  setFieldError(calStart, calStartInvalid ? 'Set the calendar start date.' : '');

  var piEl = document.getElementById(type+'-tgt-pi');
  var salesEl = document.getElementById(type+'-tgt-sales');
  var piValue = piEl ? Number(piEl.value) : 0;
  var salesValue = salesEl ? Number(salesEl.value) : 0;
  var needTargets = piEl && salesEl && !piValue && !salesValue;
  setFieldInvalid(piEl, needTargets);
  setFieldInvalid(salesEl, needTargets);
  setFieldError(piEl, needTargets ? 'Enter a pay-in or sales target.' : '');
  setFieldError(salesEl, needTargets ? 'Enter a pay-in or sales target.' : '');

  if(PARENT_ROLE[type]){
    var parentSelect = document.getElementById(type+'-parent-plan-id');
    if(parentSelect){
      var parentState = parentSelect.dataset.parentState || '';
      var shouldMarkInvalid = parentState === 'loaded' && !parentSelect.value;
      setFieldInvalid(parentSelect, shouldMarkInvalid);
      setFieldError(parentSelect, shouldMarkInvalid ? 'Select a parent '+TYPE_LABEL[PARENT_ROLE[type]]+' plan.' : '');
    }
  }

  if(Array.isArray(errors)){
    var plannerError = errors.some(function(e){
      return /weekly planner|planner activity|activity/i.test(e);
    });
    if(plannerError){
      var plannerSection = document.getElementById(type+'-sec-planner');
      if(plannerSection){
        plannerSection.classList.add('invalid');
      }
    }
  }
}
function hasLocalDraft(type){
  return !!(window.GutguardPlanModel&&window.GutguardPlanModel.getLocalDraft&&window.GutguardPlanModel.getLocalDraft(type,getDraftScopeId()));
}
function refreshDraftControls(type){
  var restoreBtn=document.getElementById('restore-draft-btn');
  var discardBtn=document.getElementById('discard-draft-btn');
  if(!restoreBtn||!discardBtn) return;
  var visible= !!type && hasLocalDraft(type);
  restoreBtn.style.display = visible ? 'inline-flex' : 'none';
  discardBtn.style.display = visible ? 'inline-flex' : 'none';
  updateDraftBanner(type);
}
function updateDraftBanner(type){
  var bannerCard=document.getElementById(type+'-draft-banner-card');
  var banner=document.getElementById(type+'-draft-banner');
  if(!bannerCard||!banner) return;
  var localDraft = hasLocalDraft(type);
  if(localDraft){
    banner.textContent = 'A local draft is available on this device for this role. Restore it or discard it using the buttons below.';
    bannerCard.style.display = 'block';
  } else {
    bannerCard.style.display = 'none';
  }
}
function restoreDraft(){
  if(!curType) return;
  if(!confirm('Restore the local draft saved on this device for this role?')) return;
  if(restoreLocalDraft(curType, null)){
    renderPlanner(curType);
    renderSummaryTbl(curType);
    renderCal(curType);
    calcAllTotals(curType);
    computeProjections(curType);
    updateDots(curType);
    renderConsolidation(curType);
    updateSaveStatus(curType,{message:'Local draft restored.',tone:'n-warn'});
    refreshDraftControls(curType);
    refreshSubmitButtonState(curType);
  } else {
    showToast('No local draft found for this role.');
  }
}
function discardDraft(){
  if(!curType) return;
  if(!confirm('Discard the local draft saved for this role on this device?')) return;
  clearLocalDraftForType(curType);
  refreshDraftControls(curType);
  updateSaveStatus(curType,{message:'Local draft discarded.',tone:'n-info'});
  showToast('Local draft removed from this device.');
}
function resetInMemoryPlan(type){
  wkData[type]={};
  calEvts[type]={};
  subMembers[type]=[];
  targets[type]={pi:0,sales:0};
}
function clearVisibleForm(type){
  var root=document.getElementById('forminner');
  if(!root)return;
  root.querySelectorAll('[data-plan-field]').forEach(function(el){el.value='';});
  root.querySelectorAll('[data-check-key]').forEach(function(el){el.classList.remove('checked');});
  var piEl=document.getElementById(type+'-tgt-pi'); if(piEl)piEl.value='';
  var salesEl=document.getElementById(type+'-tgt-sales'); if(salesEl)salesEl.value='';
  var calStartEl=document.getElementById(type+'-cs'); if(calStartEl)calStartEl.value=todayStr();
  root.querySelectorAll('.auto-today').forEach(function(el){el.value=todayStr();});
}
function getCurrentUserEmail(){return currentUser&&currentUser.email?currentUser.email:'';}
function renderAuthState(){
  var credentialsEl=document.getElementById('auth-credentials');
  var signedInEl=document.getElementById('auth-signed-in');
  var emailDisplay=document.getElementById('auth-email-display');
  if(!(window.GutguardSupabase&&window.GutguardSupabase.isConfigured&&window.GutguardSupabase.isConfigured())){
    if(credentialsEl) credentialsEl.style.display='flex';
    if(signedInEl) signedInEl.style.display='none';
    return;
  }
  if(currentUser){
    if(credentialsEl) credentialsEl.style.display='none';
    if(signedInEl) signedInEl.style.display='flex';
    if(emailDisplay) emailDisplay.textContent = currentUser.email;
  }else{
    if(credentialsEl) credentialsEl.style.display='flex';
    if(signedInEl) signedInEl.style.display='none';
    if(emailDisplay) emailDisplay.textContent='';
  }
}
async function bootstrapAuthState(){
  if(!(window.GutguardSupabase&&window.GutguardSupabase.isConfigured&&window.GutguardSupabase.isConfigured())){
    renderAuthState();
    return;
  }
  try{
    currentUser=await window.GutguardSupabase.getUser();
  }catch(err){
    currentUser=null;
  }
  resetSavedPlansCache();
  renderAuthState();
  refreshSavedPlans(true);
}
async function handleSignIn(){
  try{
    var email=document.getElementById('auth-email').value.trim();
    var password=document.getElementById('auth-password').value;
    await window.GutguardSupabase.signInWithPassword(email,password);
    currentUser=await window.GutguardSupabase.getUser();
    resetSavedPlansCache();
    renderAuthState();
    refreshSavedPlans(true);
    showToast('Signed in as '+getCurrentUserEmail()+'.');
  }catch(err){
    showToast(err&&err.message?err.message:'Sign in failed.');
  }
}
function handleAuthSubmit(event){
  if(event)event.preventDefault();
  handleSignIn();
}
async function handleSignUp(){
  try{
    var email=document.getElementById('auth-email').value.trim();
    var password=document.getElementById('auth-password').value;
    var displayName=document.getElementById('auth-display-name').value.trim();
    var roleType=document.getElementById('auth-role-type').value;
    await window.GutguardSupabase.signUpWithPassword(email,password,{
      display_name: displayName,
      role_type: roleType
    });
    currentUser=await window.GutguardSupabase.getUser();
    resetSavedPlansCache();
    renderAuthState();
    refreshSavedPlans(true);
    showToast(currentUser?'Account created and signed in.':'Account created. Check your email confirmation settings.');
  }catch(err){
    showToast(err&&err.message?err.message:'Sign up failed.');
  }
}
async function handleSignOut(){
  try{
    await window.GutguardSupabase.signOut();
    currentUser=null;
    resetSavedPlansCache();
    renderAuthState();
    refreshSavedPlans(true);
    showToast('Signed out.');
  }catch(err){
    showToast(err&&err.message?err.message:'Sign out failed.');
  }
}
async function populateParentOptions(type, selectedPlanId){
  var selectEl=document.getElementById(type+'-parent-plan-id');
  var errorEl=document.getElementById(type+'-parent-error');
  var retryBtn=document.getElementById(type+'-parent-retry-btn');
  if(!selectEl) return;
  var currentValue=selectedPlanId||selectEl.value||'';
  var currentMatched=false;
  selectEl.dataset.parentState='';
  if(errorEl) errorEl.textContent='';
  if(retryBtn) retryBtn.style.display='none';
  setSelectMessage(selectEl,'Select a parent plan');
  if(!PARENT_ROLE[type]){
    selectEl.disabled=true;
    selectEl.dataset.parentState='not-required';
    return;
  }
  selectEl.disabled=false;
  if(!currentUser){
    setSelectMessage(selectEl,'Sign in to load parent plans');
    selectEl.disabled=true;
    selectEl.dataset.parentState='auth-required';
    return;
  }
  try{
    var parents=await window.GutguardPlanApi.listPotentialParents(type);
    if(!parents.length){
      setSelectMessage(selectEl,'No '+(TYPE_LABEL[PARENT_ROLE[type]]||PARENT_ROLE[type])+' plans found');
      selectEl.disabled=true;
      selectEl.dataset.parentState='no-parents';
      if(errorEl) errorEl.textContent='No parent plans are available yet. Make sure a signed-up parent account has already saved a parent plan for that role.';
      return;
    }
    setSelectMessage(selectEl,'Select a parent plan');
    selectEl.dataset.parentState='loaded';
    parents.forEach(function(plan){
      var option=document.createElement('option');
      option.value=plan.id;
      option.selected=!!(currentValue&&currentValue===plan.id);
      if(currentValue&&currentValue===plan.id)currentMatched=true;
      option.textContent=(plan.full_name||'(No Name)')+' | '+(TYPE_LABEL[plan.role_type]||plan.role_type);
      selectEl.appendChild(option);
    });
    if(currentValue&&!currentMatched){
      selectEl.value='';
      setFormDirty(true,true);
      if(errorEl) errorEl.textContent='Your previously selected parent plan is no longer valid. Choose a valid parent plan again.';
    }
    if(!currentValue&&parents.length===1){
      selectEl.value=parents[0].id;
      setFormDirty(true,true);
      scheduleDraftAutosave();
    }
    refreshSubmitButtonState(type);
    return;
  }catch(err){
    setSelectMessage(selectEl,'Unable to load parent plans');
    selectEl.disabled=true;
    selectEl.dataset.parentState='load-error';
    if(errorEl) errorEl.textContent = 'Unable to load parent plans. Check that you reran the latest schema, signed in, and seeded memberships and parent plans.';
    if(retryBtn) retryBtn.style.display='inline-flex';
    refreshSubmitButtonState(type);
  }
}
async function ensureValidParentSelectionBeforeSave(type, mode){
  if(!PARENT_ROLE[type]) return;
  var initialState=getParentSelectState(type);
  await populateParentOptions(type);
  if(hasValidParentSelection(type)) return;
  if(mode==='draft'&&!initialState.value) return;
  throw new Error('Select a valid parent '+TYPE_LABEL[PARENT_ROLE[type]]+' plan before saving. If the dropdown is empty, make sure a signed-up parent account has already created that parent plan.');
}
async function refreshChildPlans(type){
  childPlans[type]=[];
  if(!planMeta[type]||!planMeta[type].planId||!PARENT_ROLE[type]||!currentUser){
    renderConsolidation(type);
    return;
  }
  try{
    childPlans[type]=await window.GutguardPlanApi.listChildPlans(planMeta[type].planId);
  }catch(err){
    childPlans[type]=[];
  }
  renderConsolidation(type);
}

/* NAVIGATION */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function syncInteractiveAccessibility(root){
  root=root||document;
  root.querySelectorAll('.fc-badge,.tc,.ci,.cc-add-btn,.wk-dot').forEach(function(el){
    el.dataset.keyclick='true';
    if(!el.hasAttribute('tabindex'))el.tabIndex=0;
    if(!el.hasAttribute('role'))el.setAttribute('role','button');
    if(el.classList.contains('ci')){
      el.setAttribute('aria-pressed',el.classList.contains('checked')?'true':'false');
    }
    if(el.classList.contains('wk-dot')){
      var weekLabel=(el.textContent||'').trim();
      el.setAttribute('aria-label',weekLabel?'Go to week '+weekLabel:'Go to week');
      if(el.classList.contains('active'))el.setAttribute('aria-current','step');
      else el.removeAttribute('aria-current');
    }
  });
}

async function startForm(type, explicitPlanId){
  curType=type; curWeek=1;
  clearDraftAutosaveTimer();
  setFormDirty(false,true);
  document.getElementById('backBtn').style.display='inline-flex';
  showScreen('sc-form');
  document.getElementById('forminner').innerHTML = buildForm(type);
  attachDraftTracking();
  document.querySelectorAll('.auto-today').forEach(el=>{if(!el.value)el.value=todayStr();});
  await populateParentOptions(type);
  renderPlanner(type);
  renderSummaryTbl(type);
  renderCal(type);
  updateDots(type);
  renderConsolidation(type);
  computeProjections(type);
  updateSaveStatus(type,{message:'Form ready. Checking for a saved plan...',tone:'n-info'});
  var storedRef=window.GutguardPlanModel&&window.GutguardPlanModel.getStoredPlanRef?window.GutguardPlanModel.getStoredPlanRef(type,getDraftScopeId()):null;
  var preferredPlanId=explicitPlanId||(storedRef&&storedRef.planId?storedRef.planId:null);
  if(window.GutguardPlanApi&&window.GutguardPlanApi.isConfigured&&window.GutguardPlanApi.isConfigured()){
    if(explicitPlanId){
      try{
        await loadSavedPlan(true, explicitPlanId);
      }catch(err){
        updateSaveStatus(type,{message:'The selected Supabase plan could not be loaded.',tone:'n-danger',detail:err&&err.message?err.message:''});
      }
    }else{
      if(storedRef&&storedRef.planId){
        preferredPlanId=storedRef.planId;
        try{
          await loadSavedPlan(true);
        }catch(err){
          updateSaveStatus(type,{message:'A remembered Supabase plan could not be loaded.',tone:'n-danger',detail:err&&err.message?err.message:''});
        }
      }else{
        updateSaveStatus(type);
      }
    }
  }else{
    updateSaveStatus(type);
  }
  var draftAvailable = hasLocalDraft(type);
  if(draftAvailable){
    if(confirm('A local draft exists on this device for this role. Restore it now?')){
      restoreLocalDraft(type, preferredPlanId);
    }
  } else {
    if(!restoreLocalDraft(type, preferredPlanId)){
      if(!preferredPlanId)restoreLocalDraft(type, null);
    }
  }
  refreshDraftControls(type);
  refreshSubmitButtonState(type);
  await refreshChildPlans(type);
  syncInteractiveAccessibility(document.getElementById('forminner'));
  window.scrollTo(0,0);
}

function goHome(){
  if(formDirty&&!confirm('You have unsaved local changes. Go back anyway? Your local draft will stay on this device.'))return;
  if(formDirty)persistLocalDraft();
  clearDraftAutosaveTimer();
  document.getElementById('backBtn').style.display='none';
  showScreen('sc-home');
  refreshSavedPlans();
  curType=null;
  setFormDirty(false,true);
  window.scrollTo(0,0);
}

async function renderSavedPlans(forceRefresh){
  var listEl=document.getElementById('saved-plans-list');
  if(!listEl)return;
  if(!(window.GutguardPlanApi&&window.GutguardPlanApi.isConfigured&&window.GutguardPlanApi.isConfigured())){
    setSavedPlansMessage(listEl,'Configure Supabase in supabase-config.js to browse saved plans.');
    renderSavedPlanStats([],[]);
    return;
  }
  if(!currentUser){
    setSavedPlansMessage(listEl,'Sign in to browse saved plans.');
    renderSavedPlanStats([],[]);
    return;
  }
  if(forceRefresh||!Array.isArray(savedPlansCache.plans)){
    setSavedPlansMessage(listEl,'Loading saved plans from Supabase...');
  }
  try{
    var allPlans=await fetchSavedPlans(!!forceRefresh);
    var plans=filterSavedPlans(allPlans);
    renderSavedPlanStats(allPlans,plans);
    if(!plans.length){
      setSavedPlansMessage(listEl,'No saved plans found for the current filter.');
      return;
    }
    clearNode(listEl);
    plans.forEach(function(plan){
      listEl.appendChild(buildSavedPlanCard(plan));
    });
  }catch(err){
    setSavedPlansMessage(listEl,'Failed to load saved plans. '+(err&&err.message?err.message:'Unknown error.'));
    renderSavedPlanStats([],[]);
  }
}

async function refreshSavedPlans(forceRefresh){
  await renderSavedPlans(!!forceRefresh);
  await renderReviewQueue(!!forceRefresh);
}

async function openSavedPlan(planId, roleType){
  await startForm(roleType, planId);
}
async function renderReviewQueue(forceRefresh){
  var listEl=document.getElementById('review-queue-list');
  if(!listEl)return;
  if(!(window.GutguardPlanApi&&window.GutguardPlanApi.isConfigured&&window.GutguardPlanApi.isConfigured())){
    setSavedPlansMessage(listEl,'Configure Supabase in supabase-config.js to load the review queue.');
    return;
  }
  if(!currentUser){
    setSavedPlansMessage(listEl,'Sign in to review submitted child plans.');
    return;
  }
  try{
    var queue=await fetchReviewQueue(!!forceRefresh);
    if(!queue.length){
      setSavedPlansMessage(listEl,'No submitted child plans are waiting in your review queue.');
      return;
    }
    clearNode(listEl);
    queue.forEach(function(plan){
      listEl.appendChild(buildReviewQueueCard(plan));
    });
  }catch(err){
    setSavedPlansMessage(listEl,'Failed to load review queue. '+(err&&err.message?err.message:'Unknown error.'));
  }
}
async function refreshReviewQueue(forceRefresh){
  await renderReviewQueue(!!forceRefresh);
}

async function submitPlanReview(plan, nextStatus){
  if(!(window.GutguardPlanApi&&window.GutguardPlanApi.reviewPlanInSupabase)){
    showToast('Supabase helpers are unavailable.');
    return;
  }
  var reviewNote='';
  if(nextStatus==='needs_revision'){
    reviewNote=prompt('Enter the revision note for "'+(plan.full_name||'Plan')+'".', plan.review_notes||'');
    if(reviewNote===null)return;
    if(!reviewNote.trim()){
      showToast('A revision note is required.');
      return;
    }
  }else{
    reviewNote=prompt('Optional approval note for "'+(plan.full_name||'Plan')+'".', '');
    if(reviewNote===null)return;
  }
  try{
    await window.GutguardPlanApi.reviewPlanInSupabase(plan.id,nextStatus,reviewNote);
    resetSavedPlansCache();
    await refreshSavedPlans(true);
    showToast('"'+(plan.full_name||'Plan')+'" marked as '+(nextStatus==='approved'?'approved.':'needs revision.'));
  }catch(err){
    showToast(err&&err.message?err.message:'Failed to update review status.');
  }
}
async function duplicateSavedPlan(planId, roleType){
  if(!(window.GutguardPlanApi&&window.GutguardPlanApi.loadPlanFromSupabase&&window.GutguardPlanApi.savePlanToSupabase)){
    showToast('Supabase helpers are unavailable.');
    return;
  }
  try{
    showToast('Duplicating plan...');
    var loaded=await window.GutguardPlanApi.loadPlanFromSupabase(planId);
    loaded.id=null;
    loaded.status='draft';
    loaded.full_name=(loaded.full_name||TYPE_LABEL[roleType]||'Plan')+' Copy';
    var duplicated=await window.GutguardPlanApi.savePlanToSupabase(loaded);
    resetSavedPlansCache();
    await refreshSavedPlans(true);
    showToast('Created draft copy for "'+(duplicated.full_name||'Plan')+'".');
  }catch(err){
    showToast(err&&err.message?err.message:'Failed to duplicate plan.');
  }
}
async function deleteSavedPlan(planId, roleType){
  if(!(window.GutguardPlanApi&&window.GutguardPlanApi.deletePlanFromSupabase)){
    showToast('Supabase helpers are unavailable.');
    return;
  }
  if(!confirm('Delete this draft from Supabase? This will also remove its saved week and consolidation entries.')) return;
  try{
    await window.GutguardPlanApi.deletePlanFromSupabase(planId);
    if(window.GutguardPlanModel&&window.GutguardPlanModel.getStoredPlanRef&&window.GutguardPlanModel.clearStoredPlanRef){
      var storedRef=window.GutguardPlanModel.getStoredPlanRef(roleType,getDraftScopeId());
      if(storedRef&&storedRef.planId===planId){
        window.GutguardPlanModel.clearStoredPlanRef(roleType,getDraftScopeId());
      }
    }
    if(curType===roleType&&planMeta[roleType]&&planMeta[roleType].planId===planId){
      planMeta[roleType]=makePlanMeta();
      updateSaveStatus(roleType,{message:'The current saved draft was deleted from Supabase.',tone:'n-info'});
    }
    resetSavedPlansCache();
    await refreshSavedPlans(true);
    showToast('Draft deleted from Supabase.');
  }catch(err){
    showToast(err&&err.message?err.message:'Failed to delete draft.');
  }
}

/* FORM BUILDER */
var TYPE_LABEL={member:'Member',leader:'Team Leader',squad:'Squad Leader',platoon:'Platoon Leader',o1:'01 / Product Center'};
var TYPE_BADGE={member:'bm',leader:'bl',squad:'bs',platoon:'bp',o1:'bo'};
var TYPE_CLASS={member:'m',leader:'leader',squad:'squad',platoon:'platoon',o1:'o1'};

var INFO_FIELDS={
  member:`<div class="f"><label>Full Name</label><input type="text" id="info-name" data-plan-field="full_name" placeholder="Your full name"></div>
          <div class="f"><label>Team Leader</label><input type="text" id="info-team-leader" data-plan-field="team_leader_name" placeholder="Leader name"></div>
          <div class="f"><label>Contact No.</label><input type="text" id="info-contact-no" data-plan-field="contact_no" placeholder="+63 900 000 0000"></div>
          <div class="f"><label>Start Date</label><input type="date" id="info-start-date" data-plan-field="start_date" class="auto-today"></div>`,
  leader:`<div class="f"><label>Leader Name</label><input type="text" id="info-name" data-plan-field="full_name" placeholder="Your name"></div>
          <div class="f"><label>Team Name</label><input type="text" id="info-team-name" data-plan-field="team_name" placeholder="Team name"></div>
          <div class="f"><label>No. of Members</label><input type="number" id="info-member-count" data-plan-field="member_count" min="0" placeholder="0"></div>
          <div class="f"><label>Start Date</label><input type="date" id="info-start-date" data-plan-field="start_date" class="auto-today"></div>`,
  squad:`<div class="f"><label>Squad Leader Name</label><input type="text" id="info-name" data-plan-field="full_name" placeholder="Your name"></div>
         <div class="f"><label>Squad Name</label><input type="text" id="info-squad-name" data-plan-field="squad_name" placeholder="Squad name"></div>
         <div class="f"><label>No. of Team Leaders</label><input type="number" id="info-team-leader-count" data-plan-field="team_leader_count" min="0" placeholder="0"></div>
         <div class="f"><label>Total Members</label><input type="number" id="info-member-count" data-plan-field="member_count" min="0" placeholder="0"></div>
         <div class="f"><label>Start Date</label><input type="date" id="info-start-date" data-plan-field="start_date" class="auto-today"></div>`,
  platoon:`<div class="f"><label>Platoon Leader Name</label><input type="text" id="info-name" data-plan-field="full_name" placeholder="Your name"></div>
           <div class="f"><label>Platoon Name</label><input type="text" id="info-platoon-name" data-plan-field="platoon_name" placeholder="Platoon name"></div>
           <div class="f"><label>No. of Squads</label><input type="number" id="info-squad-count" data-plan-field="squad_count" min="0" placeholder="0"></div>
           <div class="f"><label>Total Members Under</label><input type="number" id="info-member-count" data-plan-field="member_count" min="0" placeholder="0"></div>
           <div class="f"><label>Start Date</label><input type="date" id="info-start-date" data-plan-field="start_date" class="auto-today"></div>`,
  o1:`<div class="f"><label>01 Name</label><input type="text" id="info-name" data-plan-field="full_name" placeholder="Your name"></div>
      <div class="f"><label>Depot / City Stockist</label><input type="text" id="info-depot-name" data-plan-field="depot_name" placeholder="Depot name"></div>
      <div class="f"><label>Area / Location</label><input type="text" id="info-area-location" data-plan-field="area_location" placeholder="City or area"></div>
      <div class="f"><label>No. of Platoon Leaders</label><input type="number" id="info-platoon-leader-count" data-plan-field="platoon_leader_count" min="0" placeholder="0"></div>
      <div class="f"><label>Start Date</label><input type="date" id="info-start-date" data-plan-field="start_date" class="auto-today"></div>`
};

function buildForm(type){
  var p=type;
  var extraCols=EXTRA_COLS[type]||[];
  var subRole=SUB_ROLES[type];
  var hasConsolidation=subRole!==null;
  var parentRole=PARENT_ROLE[type];

  var memberChecklist = type==='member'?`
    <div class="card" style="margin-bottom:.875rem">
      <div class="sec-lbl" style="margin-bottom:.7rem">Weekly Activity Commitments</div>
      <div class="cklist">
        <div class="ci" data-check-key="invite_daily" onclick="tog(this)"><div class="ck"></div><span>Invite / Prospect daily</span></div>
        <div class="ci" data-check-key="product_presentation" onclick="tog(this)"><div class="ck"></div><span>Attend Product Presentation</span></div>
        <div class="ci" data-check-key="business_presentation" onclick="tog(this)"><div class="ck"></div><span>Attend Business Presentation</span></div>
        <div class="ci" data-check-key="training_session" onclick="tog(this)"><div class="ck"></div><span>Join Training Session</span></div>
        <div class="ci" data-check-key="testimonial_session" onclick="tog(this)"><div class="ck"></div><span>Join Testimonial Session</span></div>
        <div class="ci" data-check-key="leader_fellowship" onclick="tog(this)"><div class="ck"></div><span>Join Leader Fellowship</span></div>
      </div>
    </div>`:'';

  var consolidationSection = hasConsolidation?`
    <div class="sec" id="${p}-sec-consolidation">
      <div class="sec-head"><span class="sec-tag">Section E</span><span class="sec-title">Consolidation - ${subRole}s Under This ${TYPE_LABEL[type]}</span></div>
      <div class="notice n-info">Add each ${subRole} under you. Their 90-day targets will roll up into your consolidated totals below.</div>
      <div id="${p}-con-container"></div>
      <div class="con-total" id="${p}-con-total" style="display:none">
        <div class="ct-label">Consolidated Total<br><span style="font-weight:400;color:#6A8AB0;font-size:.6rem">All ${subRole}s below</span></div>
        <div class="ct-num"><span class="n" id="${p}-con-leads">0</span><span class="l">Leads</span></div>
        <div class="ct-num"><span class="n" id="${p}-con-att">0</span><span class="l">Attendees</span></div>
        <div class="ct-num"><span class="n" id="${p}-con-pi">0</span><span class="l">Pay-ins</span></div>
        <div class="ct-num"><span class="n" id="${p}-con-sales">0</span><span class="l">Sales PHP</span></div>
      </div>
    </div>`:'';

  return `
    <div class="form-banner ${TYPE_CLASS[type]}">
      <div>
        <div class="fb-t">${TYPE_LABEL[type]} - 90-Day Execution Plan</div>
        <div class="fb-s">${type==='o1'?'Final Consolidated 90-Day Execution Plan - SUBMIT BY APRIL 1, 2026':'Individual 90-Day Execution Plan'}</div>
      </div>
      <span class="t-badge ${TYPE_BADGE[type]}" style="align-self:center;font-size:.65rem;padding:5px 12px">${TYPE_LABEL[type]}</span>
    </div>

    <div class="card section-progress-card">
      <div class="progress-head">
        <div>
          <div class="sec-lbl" style="margin-bottom:.45rem">Section Progress</div>
          <div class="progress-summary" id="${p}-progress-summary">0 of 4 required sections complete</div>
        </div>
        <div class="progress-hint" id="${p}-progress-hint">Complete the required sections below to enable submit.</div>
      </div>
      <div class="progress-grid" id="${p}-progress-grid"></div>
    </div>

    <!-- A: INFO -->
    <div class="sec" id="${p}-sec-info">
      <div class="sec-head"><span class="sec-tag">Section A</span><span class="sec-title">Personal / Center Information</span></div>
      <div class="card"><div class="fg">${INFO_FIELDS[type]}</div></div>
      ${parentRole?`<div class="card hierarchy-wrap">
        <div class="sec-lbl" style="margin-bottom:.7rem">Hierarchy Link</div>
        <div class="fg">
          <div class="f parent-plan-field">
            <label>Parent ${TYPE_LABEL[parentRole]}</label>
            <select id="${p}-parent-plan-id" onchange="refreshSubmitButtonState('${p}')">
              <option value="">Loading ${TYPE_LABEL[parentRole]} plans...</option>
            </select>
            <div class="field-error" id="${p}-parent-error" aria-live="polite"></div>
            <button type="button" class="btn bto btn-sm" id="${p}-parent-retry-btn" onclick="populateParentOptions('${p}')" style="display:none;margin-top:8px">Retry</button>
          </div>
        </div>
      </div>`:''}
      <div class="card" id="${p}-draft-banner-card" style="display:none;margin-bottom:.75rem">
        <div class="notice n-warn" id="${p}-draft-banner" style="margin:0"></div>
      </div>
      <div class="card plan-save-card">
        <div class="sec-lbl" style="margin-bottom:.7rem">Supabase Save State</div>
        <div class="notice n-info" id="${p}-save-state">Checking Supabase configuration...</div>
        <div class="plan-save-meta" id="${p}-save-meta"></div>
      </div>
    </div>

    <!-- B: PROJECTED TARGETS -->
    <div class="sec" id="${p}-sec-targets">
      <div class="sec-head"><span class="sec-tag">Section B</span><span class="sec-title">Step 1 - Set 90-Day Projected Targets</span></div>
      <div class="card">
        <div style="font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.875rem">Enter Your Own 90-Day Targets (not consolidated)</div>
        <div class="proj-setup">
          <div class="pib">
            <div class="pib-lbl">90-Day Pay-in Target</div>
            <input class="pib-inp" type="number" id="${p}-tgt-pi" min="0" placeholder="0" oninput="onTargetChange('${p}')">
            <div class="pib-note">Your personal pay-in goal</div>
          </div>
          <div class="pib">
            <div class="pib-lbl">90-Day Sales Target (PHP)</div>
            <input class="pib-inp" type="number" id="${p}-tgt-sales" min="0" placeholder="0" oninput="onTargetChange('${p}')">
            <div class="pib-note">Your personal sales goal</div>
          </div>
          <div class="pib" style="background:#061E45">
            <div class="pib-lbl">Calendar Start Date</div>
            <input type="date" id="${p}-cs" class="auto-today pib-inp" style="font-size:.9rem" oninput="renderCal('${p}');computeProjections('${p}')">
            <div class="pib-note">April 5 - July 5, 2026</div>
          </div>
        </div>
        <div style="font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem">Computed Required Numbers (1 Pay-in = 5 Attendees, 1 Attendee = 4 Leads)</div>
        <div class="derived-row">
          <div class="der-box"><div class="der-lbl">Req. Attendees</div><div class="der-val" id="${p}-der-att">-</div><div class="der-note">Pay-ins x 5</div></div>
          <div class="der-box"><div class="der-lbl">Req. Leads</div><div class="der-val" id="${p}-der-leads">-</div><div class="der-note">Attendees x 4</div></div>
          <div class="der-box"><div class="der-lbl">Pay-ins / Week</div><div class="der-val" id="${p}-der-wkpi">-</div><div class="der-note">/ 12 weeks</div></div>
          <div class="der-box"><div class="der-lbl">Sales / Week PHP</div><div class="der-val" id="${p}-der-wksales">-</div><div class="der-note">/ 12 weeks</div></div>
          <div class="der-box"><div class="der-lbl">Leads / Week</div><div class="der-val" id="${p}-der-wkleads">-</div><div class="der-note">/ 12 weeks</div></div>
          <div class="der-box" style="border-left-color:var(--gold)"><div class="der-lbl">Leads / Day</div><div class="der-val" id="${p}-der-dayleads" style="color:var(--gold)">-</div><div class="der-note">/ 90 days</div></div>
        </div>
      </div>

      <!-- Actual Metrics -->
      <div class="metrics">
        <div class="metric"><span class="val" id="${p}-ml">0</span><span class="lbl">Actual Leads</span><span class="sub">from planner</span></div>
        <div class="metric"><span class="val" id="${p}-ma">0</span><span class="lbl">Actual Attendees</span><span class="sub">from planner</span></div>
        <div class="metric"><span class="val" id="${p}-mp">0</span><span class="lbl">Actual Pay-ins</span><span class="sub">from planner</span></div>
        <div class="metric"><span class="val" id="${p}-ms">0</span><span class="lbl">Actual Sales PHP</span><span class="sub">from planner</span></div>
      </div>

      <!-- Projection Table -->
      <div class="proj-table-wrap">
        <table class="proj-table">
          <thead>
            <tr>
              <th rowspan="2" style="text-align:left;vertical-align:middle">Week</th>
              <th colspan="3" style="border-right:2px solid #1A2A4A">Pay-ins</th>
              <th colspan="3">Sales (PHP)</th>
            </tr>
            <tr>
              <th>Target (cum.)</th><th>Actual (cum.)</th><th style="border-right:2px solid #1A2A4A">vs Target</th>
              <th>Target (cum.)</th><th>Actual (cum.)</th><th>vs Target</th>
            </tr>
          </thead>
          <tbody id="${p}-proj-body"></tbody>
          <tfoot>
            <tr>
              <td>90-Day Total</td>
              <td id="${p}-pf-tpi">-</td><td id="${p}-pf-api">0</td><td id="${p}-pf-vpi">-</td>
              <td id="${p}-pf-ts">-</td><td id="${p}-pf-as">0</td><td id="${p}-pf-vs">-</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="sum3">
        <div class="s3b tot"><div class="s3-lbl">90-Day Pay-in Target</div><div class="s3-val" id="${p}-sum-tpi">-</div><div class="s3-note" id="${p}-sum-tpi-n">Set a target</div></div>
        <div class="s3b ach"><div class="s3-lbl">Pay-ins Achieved</div><div class="s3-val" id="${p}-sum-api">0</div><div class="s3-note" id="${p}-sum-api-n">from planner</div></div>
        <div class="s3b gap"><div class="s3-lbl">Pay-in Gap</div><div class="s3-val" id="${p}-sum-gpi">-</div><div class="s3-note" id="${p}-sum-gpi-n">remaining</div></div>
      </div>
      <div class="sum3" style="margin-top:.5rem">
        <div class="s3b tot"><div class="s3-lbl">90-Day Sales Target PHP</div><div class="s3-val" id="${p}-sum-ts">-</div><div class="s3-note" id="${p}-sum-ts-n">Set a target</div></div>
        <div class="s3b ach"><div class="s3-lbl">Sales Achieved PHP</div><div class="s3-val" id="${p}-sum-as">PHP0</div><div class="s3-note" id="${p}-sum-as-n">from planner</div></div>
        <div class="s3b gap"><div class="s3-lbl">Sales Gap PHP</div><div class="s3-val" id="${p}-sum-gs">-</div><div class="s3-note" id="${p}-sum-gs-n">remaining</div></div>
      </div>
    </div>

    <!-- C: WEEKLY PLANNER -->
    <div class="sec" id="${p}-sec-planner">
      <div class="sec-head"><span class="sec-tag">Section C</span><span class="sec-title">Step 3 - Weekly Activity Planner</span></div>
      ${type==='member'?`<div class="notice n-info" style="margin-bottom:.75rem">Guide: 1 Pay-in = 5 Attendees, 1 Attendee = 4 Leads. Enter activities below - projections update automatically.</div>`:''}
      ${memberChecklist}
      <div class="card">
        <div class="week-controls">
          <div class="wk-nav">
            <button class="wk-btn" onclick="gotoWeek(curWeek-1)">&#8592;</button>
            <div class="wk-lbl" id="${p}-wl">Week 1</div>
            <button class="wk-btn" onclick="gotoWeek(curWeek+1)">&#8594;</button>
          </div>
          <div class="wk-dots" id="${p}-dots"></div>
        </div>
        <div class="plan-wrap">
          <table class="plan-tbl" id="${p}-ptbl">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Date</th>
                <th class="cn">Leads</th>
                <th class="cn">Attendees</th>
                <th class="cn">Pay-ins</th>
                <th class="cn">Sales PHP</th>
                ${extraCols.map(ec=>`<th>${ec.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="${p}-pbdy"></tbody>
            <tfoot>
              <tr>
                <td>Week ${curWeek} Total</td><td></td>
                <td class="cn" id="${p}-wl-l">0</td>
                <td class="cn" id="${p}-wl-a">0</td>
                <td class="cn" id="${p}-wl-p">0</td>
                <td class="cn" id="${p}-wl-s">0</td>
                ${extraCols.map(()=>'<td></td>').join('')}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- D: 12-WEEK SUMMARY -->
    <div class="sec" id="${p}-sec-summary">
      <div class="sec-head"><span class="sec-tag">Section D</span><span class="sec-title">12-Week Summary (Auto-Computed from Planner)</span></div>
      <div class="sum-tbl-wrap">
        <table class="sum-tbl">
          <thead><tr>
            <th>Activity</th>
            <th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th>
            <th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th>
            <th>Total</th>
          </tr></thead>
          <tbody id="${p}-smry-body"></tbody>
          <tfoot><tr>
            <td>Total (Leads)</td>
            ${Array.from({length:12},(_,i)=>`<td id="${p}-wt-${i+1}">0</td>`).join('')}
            <td id="${p}-gt">0</td>
          </tr></tfoot>
        </table>
      </div>
    </div>

    <!-- E: CONSOLIDATION -->
    ${consolidationSection}

    <!-- F: CALENDAR -->
    <div class="sec" id="${p}-sec-calendar">
      <div class="sec-head"><span class="sec-tag">Section ${hasConsolidation?'F':'E'}</span><span class="sec-title">90-Day Calendar View</span></div>
      <div class="card">
        <div id="${p}-cal"><p style="color:var(--muted);font-size:.82rem">Set a start date in Section B to display the calendar.</p></div>
      </div>
    </div>

    <div class="form-actions" id="${p}-sec-submit">
      <div class="form-actions-group">
        <button class="btn bto" onclick="clearPlan('${p}')">Clear All</button>
        <button class="btn bto" onclick="loadSavedPlan()">Load Saved Plan</button>
        <button class="btn bto" id="restore-draft-btn" onclick="restoreDraft()" style="display:none">Restore Draft</button>
        <button class="btn bto" id="discard-draft-btn" onclick="discardDraft()" style="display:none">Discard Local Draft</button>
        <button class="btn btd" onclick="savePlan('draft')">Save Draft</button>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <button class="btn btp" id="${p}-submit-btn" onclick="savePlan('submitted')">Submit Plan</button>
        <div class="submit-hint" id="${p}-submit-hint">Enter your plan details to enable submit.</div>
      </div>
    </div>
    <div style="margin-top:1rem;padding:.875rem 1.1rem;background:var(--sky);border-radius:3px;border:1px solid var(--border);font-size:.72rem;color:var(--muted);font-style:italic;text-align:center">
      "If you know your numbers, you can control your results." - Gutguard Operations
    </div>`;
}

/* PLANNER */
function gotoWeek(w){
  curWeek=Math.max(1,Math.min(12,w));
  renderPlanner(curType); updateDots(curType);
}

function renderPlanner(type){
  var p=type;
  var lbl=document.getElementById(p+'-wl'); if(lbl) lbl.textContent='Week '+curWeek;
  var ft=document.querySelector('#'+p+'-ptbl tfoot td:first-child'); if(ft) ft.textContent='Week '+curWeek+' Total';
  var acts=ACTIVITIES[type]||[], extraCols=EXTRA_COLS[type]||[];
  var tbody=document.getElementById(p+'-pbdy'); if(!tbody)return;
  tbody.innerHTML='';
  if(!wkData[type][curWeek]) wkData[type][curWeek]={};
  var wk=wkData[type][curWeek];

  acts.forEach(function(act){
    if(!wk[act]) wk[act]={leads:'',att:'',pi:'',sales:'',date:''};
    var row=document.createElement('tr');
    var tdAct=document.createElement('td'); tdAct.className='ta'; tdAct.textContent=act; row.appendChild(tdAct);
    var tdD=document.createElement('td'); tdD.className='td-d';
    var inpD=document.createElement('input'); inpD.type='date'; inpD.value=wk[act].date||'';
    inpD.onchange=function(){wk[act].date=this.value;rebuildCalEvts(type);renderCal(type);};
    tdD.appendChild(inpD); row.appendChild(tdD);
    ['leads','att','pi','sales'].forEach(function(col){
      var td=document.createElement('td'); td.className='tn';
      var inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.placeholder='0';
      inp.value=wk[act][col]||'';
      inp.oninput=function(){wk[act][col]=this.value;calcWeekTotals(type);calcAllTotals(type);renderSummaryTbl(type);};
      td.appendChild(inp); row.appendChild(td);
    });
    extraCols.forEach(function(ec){
      if(!wk[act][ec.key]) wk[act][ec.key]='';
      var td=document.createElement('td'); td.className='tt';
      var inp=document.createElement('input'); inp.type='text'; inp.placeholder='-'; inp.value=wk[act][ec.key];
      inp.oninput=function(){wk[act][ec.key]=this.value;};
      td.appendChild(inp); row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  calcWeekTotals(type);
  syncInteractiveAccessibility(document.getElementById(type+'-pbdy'));
}

function calcWeekTotals(type){
  var p=type, wk=wkData[type][curWeek]||{}, t={l:0,a:0,p:0,s:0};
  Object.values(wk).forEach(function(r){t.l+=parseInt(r.leads)||0;t.a+=parseInt(r.att)||0;t.p+=parseInt(r.pi)||0;t.s+=parseInt(r.sales)||0;});
  Object.keys(t).forEach(function(k){var el=document.getElementById(p+'-wl-'+k);if(el)el.textContent=t[k];});
}

function calcAllTotals(type){
  var p=type, grand={leads:0,att:0,pi:0,sales:0};
  for(var w=1;w<=12;w++){var wk=wkData[type][w]||{};Object.values(wk).forEach(function(r){grand.leads+=parseInt(r.leads)||0;grand.att+=parseInt(r.att)||0;grand.pi+=parseInt(r.pi)||0;grand.sales+=parseInt(r.sales)||0;});}
  var map={ml:grand.leads,ma:grand.att,mp:grand.pi,ms:grand.sales};
  Object.keys(map).forEach(function(k){var el=document.getElementById(p+'-'+k);if(el)el.textContent=map[k];});
  computeProjections(type);
}

function updateDots(type){
  var p=type, container=document.getElementById(p+'-dots'); if(!container)return;
  container.innerHTML='';
  for(var w=1;w<=12;w++){
    var hasData=false, wk=wkData[type][w]||{};
    Object.values(wk).forEach(function(r){if((parseInt(r.leads)||0)+(parseInt(r.pi)||0)+(parseInt(r.sales)||0)>0)hasData=true;});
    var dot=document.createElement('div');
    dot.className='wk-dot'+(w===curWeek?' active':'')+(hasData?' has-data':'');
    dot.textContent=w;
    (function(wNum){dot.onclick=function(){gotoWeek(wNum);};})(w);
    container.appendChild(dot);
  }
  syncInteractiveAccessibility(container);
}

/* SUMMARY TABLE */
function renderSummaryTbl(type){
  var p=type, acts=ACTIVITIES[type]||[], tbody=document.getElementById(p+'-smry-body'); if(!tbody)return;
  tbody.innerHTML='';
  var gpw=Array(12).fill(0), gt=0;
  acts.forEach(function(act){
    var tr=document.createElement('tr');
    var tdA=document.createElement('td'); tdA.textContent=act; tr.appendChild(tdA);
    var actTotal=0;
    for(var w=1;w<=12;w++){
      var r=(wkData[type][w]||{})[act]||{}, v=parseInt(r.leads)||0;
      var td=document.createElement('td'); td.textContent=v||'-';
      if(v>0){td.style.fontWeight='600';td.style.color='var(--navy)';}else{td.style.color='#C0CCE0';}
      tr.appendChild(td); actTotal+=v; gpw[w-1]+=v; gt+=v;
    }
    var tdT=document.createElement('td'); tdT.textContent=actTotal||'-';
    tdT.style.fontWeight='700'; tdT.style.color=actTotal?'var(--navy)':'#C0CCE0';
    tr.appendChild(tdT); tbody.appendChild(tr);
  });
  for(var w=1;w<=12;w++){var el=document.getElementById(p+'-wt-'+w);if(el)el.textContent=gpw[w-1]||0;}
  var gel=document.getElementById(p+'-gt'); if(gel)gel.textContent=gt||0;
  updateDots(type);
}

/* CALENDAR */
function rebuildCalEvts(type){
  calEvts[type]={};
  for(var w=1;w<=12;w++){var wk=wkData[type][w]||{};Object.keys(wk).forEach(function(a){var d=wk[a].date;if(d){if(!calEvts[type][d])calEvts[type][d]=[];if(!calEvts[type][d].includes(a))calEvts[type][d].push(a);}});}
}
function renderCal(type){
  var el=document.getElementById(type+'-cs'), out=document.getElementById(type+'-cal');
  if(!el||!el.value||!out)return;
  rebuildCalEvts(type);
  var start=new Date(el.value+'T00:00:00'), today=new Date(); today.setHours(0,0,0,0);
  var html='',month=-1,cur=new Date(start);
  while((cur-start)/86400000<90){
    if(cur.getMonth()!==month){
      if(month!==-1)html+='</div>';
      month=cur.getMonth();
      html+=`<div class="cal-mth">${cur.toLocaleString('default',{month:'long',year:'numeric'})}</div><div class="cal-grid">`;
      ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{html+=`<div class="cal-hd">${d}</div>`;});
      for(var e=0;e<cur.getDay();e++)html+='<div class="cal-d emp"></div>';
    }
    var ds=cur.toISOString().split('T')[0];
    var isT=cur.getTime()===today.getTime(), hasE=calEvts[type][ds]&&calEvts[type][ds].length>0;
    html+=`<div class="cal-d${isT?' today':''}${hasE?' hev':''}" title="${hasE?calEvts[type][ds].join(', '):''}"><span>${cur.getDate()}</span>${hasE?'<div class="ddot"></div>':''}</div>`;
    cur.setDate(cur.getDate()+1);
  }
  html+='</div>'; out.innerHTML=html;
}

/* PROJECTED TARGETS */
function onTargetChange(p){
  targets[p]={pi:parseInt(document.getElementById(p+'-tgt-pi')&&document.getElementById(p+'-tgt-pi').value)||0,
              sales:parseInt(document.getElementById(p+'-tgt-sales')&&document.getElementById(p+'-tgt-sales').value)||0};
  computeProjections(p);
  refreshSubmitButtonState(p);
}

function computeProjections(type){
  var p=type;
  var tgtPi=targets[type]&&targets[type].pi||0;
  var tgtSales=targets[type]&&targets[type].sales||0;
  var reqAtt=tgtPi*5, reqLeads=reqAtt*4;
  var piWk=tgtPi/12, salWk=tgtSales/12, leadsWk=reqLeads/12, leadsDay=reqLeads/90;
  function fmt(n){return n>0?Math.round(n).toLocaleString():'-';}
  function fmtD(n){return n>0?n.toFixed(1):'-';}
  function e(id){return document.getElementById(id);}
  if(e(p+'-der-att'))e(p+'-der-att').textContent=tgtPi?reqAtt.toLocaleString():'-';
  if(e(p+'-der-leads'))e(p+'-der-leads').textContent=tgtPi?reqLeads.toLocaleString():'-';
  if(e(p+'-der-wkpi'))e(p+'-der-wkpi').textContent=tgtPi?fmtD(piWk):'-';
  if(e(p+'-der-wksales'))e(p+'-der-wksales').textContent=tgtSales?'PHP'+Math.round(salWk).toLocaleString():'-';
  if(e(p+'-der-wkleads'))e(p+'-der-wkleads').textContent=tgtPi?fmtD(leadsWk):'-';
  if(e(p+'-der-dayleads'))e(p+'-der-dayleads').textContent=tgtPi?fmtD(leadsDay):'-';

  // Gather actuals
  var actPi=[], actSales=[];
  for(var w=1;w<=12;w++){
    var wk=wkData[type][w]||{}, pi=0, sales=0;
    Object.values(wk).forEach(function(r){pi+=parseInt(r.pi)||0; sales+=parseInt(r.sales)||0;});
    actPi.push(pi); actSales.push(sales);
  }
  var totalActPi=actPi.reduce((a,b)=>a+b,0), totalActSales=actSales.reduce((a,b)=>a+b,0);
  var cumPi=0, cumSales=0;
  var tbody=document.getElementById(p+'-proj-body'); if(!tbody)return;
  tbody.innerHTML='';

  for(var w=1;w<=12;w++){
    var wTgtPi=tgtPi?Math.round(piWk*w):null, wTgtSales=tgtSales?Math.round(salWk*w):null;
    cumPi+=actPi[w-1]; cumSales+=actSales[w-1];
    var piPct=wTgtPi&&wTgtPi>0?Math.round((cumPi/wTgtPi)*100):null;
    var sPct=wTgtSales&&wTgtSales>0?Math.round((cumSales/wTgtSales)*100):null;
    function pClass(pct){return pct===null?'':pct>=100?'over':pct>=85?'on':'under';}
    function pText(pct){return pct===null?'-':pct+'%';}
    function barHtml(pct){if(pct===null)return '';var w=Math.min(pct,100),cls=pct>=100?'over':pct>=85?'on':'under';return `<div class="pbar"><div class="pbar-f ${cls}" style="width:${w}%"></div></div>`;}
    var tr=document.createElement('tr');
    tr.innerHTML=`<td style="text-align:left;font-weight:700;font-size:.75rem;color:var(--navy);background:var(--sky);border-right:2px solid var(--border);padding-left:10px;white-space:nowrap">W${w}</td>
      <td class="td-tgt">${wTgtPi!==null?wTgtPi.toLocaleString():'-'}</td>
      <td class="td-act">${cumPi>0?cumPi.toLocaleString():'-'}</td>
      <td class="td-pct ${pClass(piPct)}">${pText(piPct)}${barHtml(piPct)}</td>
      <td class="td-tgt">${wTgtSales!==null?'PHP'+wTgtSales.toLocaleString():'-'}</td>
      <td class="td-act">${cumSales>0?'PHP'+cumSales.toLocaleString():'-'}</td>
      <td class="td-pct ${pClass(sPct)}">${pText(sPct)}${barHtml(sPct)}</td>`;
    tbody.appendChild(tr);
  }

  function set(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
  set(p+'-pf-tpi',tgtPi?tgtPi.toLocaleString():'-');
  set(p+'-pf-api',totalActPi?totalActPi.toLocaleString():'0');
  if(e(p+'-pf-vpi')&&tgtPi){var pct=Math.round((totalActPi/tgtPi)*100);e(p+'-pf-vpi').textContent=pct+'%';e(p+'-pf-vpi').style.color=pct>=100?'#4ADA8A':pct>=85?'var(--gold)':'#FF8A8A';}else set(p+'-pf-vpi','-');
  set(p+'-pf-ts',tgtSales?'PHP'+tgtSales.toLocaleString():'-');
  set(p+'-pf-as',totalActSales?'PHP'+totalActSales.toLocaleString():'0');
  if(e(p+'-pf-vs')&&tgtSales){var spct=Math.round((totalActSales/tgtSales)*100);e(p+'-pf-vs').textContent=spct+'%';e(p+'-pf-vs').style.color=spct>=100?'#4ADA8A':spct>=85?'var(--gold)':'#FF8A8A';}else set(p+'-pf-vs','-');

  var gapPi=tgtPi?Math.max(0,tgtPi-totalActPi):null, gapS=tgtSales?Math.max(0,tgtSales-totalActSales):null;
  set(p+'-sum-tpi',tgtPi?tgtPi.toLocaleString():'-');
  set(p+'-sum-tpi-n',tgtPi?'90-day pay-in goal':'Set a target above');
  set(p+'-sum-api',totalActPi.toLocaleString());
  set(p+'-sum-api-n',tgtPi?Math.round((totalActPi/tgtPi)*100)+'% of target achieved':'from planner');
  set(p+'-sum-gpi',gapPi!==null?(gapPi>0?gapPi.toLocaleString():'Achieved!'):'-');
  set(p+'-sum-gpi-n',gapPi===0?'Target fully met!':gapPi>0?'more pay-ins needed':'remaining');
  set(p+'-sum-ts',tgtSales?'PHP'+tgtSales.toLocaleString():'-');
  set(p+'-sum-ts-n',tgtSales?'90-day sales goal':'Set a target above');
  set(p+'-sum-as',totalActSales?'PHP'+totalActSales.toLocaleString():'PHP0');
  set(p+'-sum-as-n',tgtSales?Math.round((totalActSales/tgtSales)*100)+'% of target achieved':'from planner');
  set(p+'-sum-gs',gapS!==null?(gapS>0?'PHP'+gapS.toLocaleString():'Achieved!'):'-');
  set(p+'-sum-gs-n',gapS===0?'Target fully met!':gapS>0?'more sales needed':'remaining');
}

/* CONSOLIDATION */
function renderConsolidationLegacy(type){
  var p=type;
  var container=document.getElementById(p+'-con-container'); if(!container)return;
  var members=subMembers[type]||[];
  var subRole=SUB_ROLES[type];
  var totalPi=0,totalSales=0,totalLeads=0,totalAtt=0;

  var html='<div class="con-grid">';
  members.forEach(function(m,i){
    totalPi+=m.pi||0; totalSales+=m.sales||0; totalLeads+=m.leads||0; totalAtt+=m.att||0;
    var piPct= m.piTarget&&m.piTarget>0?Math.min(100,Math.round((m.pi/m.piTarget)*100)):0;
    html+=`<div class="con-card">
      <div class="cc-role">${subRole}</div>
      <div class="cc-name">${m.name||'(No Name)'}</div>
      <div class="cc-nums">
        <div class="cc-num"><span class="n">${m.leads||0}</span><span class="l">Leads</span></div>
        <div class="cc-num"><span class="n">${m.att||0}</span><span class="l">Att.</span></div>
        <div class="cc-num"><span class="n">${m.pi||0}</span><span class="l">Pay-ins</span></div>
        <div class="cc-num"><span class="n">${m.sales?'PHP'+(m.sales).toLocaleString():'0'}</span><span class="l">Sales</span></div>
      </div>
      <div class="cc-bar">
        <div class="cc-pct-lbl"><span>Pay-in Progress</span><span>${m.pi||0} / ${m.piTarget||'?'}</span></div>
        <div class="cc-pbar"><div class="cc-pbar-f" style="width:${piPct}%"></div></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:.5rem">
        <button class="btn bto btn-sm" style="flex:1" onclick="editSubMember(${i})">Edit</button>
        <button class="btn btn-sm" style="background:#FDE8E8;color:var(--danger);border:1px solid #F0B8B8;flex:1" onclick="removeSubMember(${i})">Remove</button>
      </div>
    </div>`;
  });

  // Add new card
  html+=`<div class="cc-add-btn" onclick="openAddModal('${type}')">+ Add ${subRole}</div>`;
  html+='</div>';
  container.innerHTML=html;

  // Show totals if members exist
  var totRow=document.getElementById(p+'-con-total');
  if(totRow){
    if(members.length>0){
      totRow.style.display='grid';
      function set(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
      set(p+'-con-leads',totalLeads.toLocaleString());
      set(p+'-con-att',totalAtt.toLocaleString());
      set(p+'-con-pi',totalPi.toLocaleString());
      set(p+'-con-sales','PHP'+totalSales.toLocaleString());
    } else {
      totRow.style.display='none';
    }
  }
}

/* MODAL */
var modalEditIdx=-1, modalType=null;
function openAddModal(type){
  modalEditIdx=-1; modalType=type;
  document.getElementById('modal-title').textContent='Add '+SUB_ROLES[type];
  document.getElementById('m-inp-name').value='';
  document.getElementById('m-inp-pi').value='';
  document.getElementById('m-inp-sales').value='';
  document.getElementById('m-inp-leads').value='';
  document.getElementById('m-inp-att').value='';
  document.getElementById('m-inp-evt').value='';
  document.getElementById('modal').classList.add('active');
}
function editSubMember(idx){
  modalEditIdx=idx; modalType=curType;
  var m=subMembers[curType][idx];
  document.getElementById('modal-title').textContent='Edit '+SUB_ROLES[curType];
  document.getElementById('m-inp-name').value=m.name||'';
  document.getElementById('m-inp-pi').value=m.pi||'';
  document.getElementById('m-inp-sales').value=m.sales||'';
  document.getElementById('m-inp-leads').value=m.leads||'';
  document.getElementById('m-inp-att').value=m.att||'';
  document.getElementById('m-inp-evt').value=m.evt||'';
  document.getElementById('modal').classList.add('active');
}
function closeModal(){document.getElementById('modal').classList.remove('active');}
function saveSubMember(){
  var m={
    name:document.getElementById('m-inp-name').value,
    role:SUB_ROLES[modalType]||'',
    pi:parseInt(document.getElementById('m-inp-pi').value)||0,
    piTarget:parseInt(document.getElementById('m-inp-pi').value)||0,
    sales:parseInt(document.getElementById('m-inp-sales').value)||0,
    leads:parseInt(document.getElementById('m-inp-leads').value)||0,
    att:parseInt(document.getElementById('m-inp-att').value)||0,
    evt:parseInt(document.getElementById('m-inp-evt').value)||0
  };
  if(!m.name){showToast('Please enter a name.');return;}
  if(modalEditIdx>=0){subMembers[modalType][modalEditIdx]=m;}
  else{if(!subMembers[modalType])subMembers[modalType]=[];subMembers[modalType].push(m);}
  closeModal();
  renderConsolidation(modalType);
  setFormDirty(true,true);
  scheduleDraftAutosave();
  showToast((modalEditIdx>=0?'Updated: ':'Added: ')+m.name);
}
function removeSubMember(idx){
  if(!confirm('Remove this entry?'))return;
  subMembers[curType].splice(idx,1);
  renderConsolidation(curType);
  setFormDirty(true,true);
  scheduleDraftAutosave();
  showToast('Removed.');
}

function renderConsolidation(type){
  var p=type;
  var container=document.getElementById(p+'-con-container'); if(!container)return;
  var members=subMembers[type]||[];
  var linkedChildren=childPlans[type]||[];
  var subRole=SUB_ROLES[type];
  var totalPi=0,totalSales=0,totalLeads=0,totalAtt=0;
  var html='';

  if(linkedChildren.length){
    html+='<div class="notice n-success" style="margin-bottom:.75rem">Linked child plans found in Supabase. Consolidation totals below are based on actual saved child plans.</div><div class="con-grid">';
    linkedChildren.forEach(function(child){
      totalPi+=child.totals.pay_ins||0;
      totalSales+=child.totals.sales||0;
      totalLeads+=child.totals.leads||0;
      totalAtt+=child.totals.attendees||0;
      var piPct=child.target_pi&&child.target_pi>0?Math.min(100,Math.round(((child.totals.pay_ins||0)/child.target_pi)*100)):0;
      html+=`<div class="con-card">
        <div class="cc-role">${escapeHtml(TYPE_LABEL[child.role_type]||subRole)}</div>
        <div class="cc-name">${escapeHtml(child.full_name||'(No Name)')}</div>
        <div class="cc-nums">
          <div class="cc-num"><span class="n">${child.totals.leads||0}</span><span class="l">Leads</span></div>
          <div class="cc-num"><span class="n">${child.totals.attendees||0}</span><span class="l">Att.</span></div>
          <div class="cc-num"><span class="n">${child.totals.pay_ins||0}</span><span class="l">Pay-ins</span></div>
          <div class="cc-num"><span class="n">${child.totals.sales?'PHP'+(child.totals.sales).toLocaleString():'0'}</span><span class="l">Sales</span></div>
        </div>
        <div class="cc-bar">
          <div class="cc-pct-lbl"><span>Pay-in Progress</span><span>${child.totals.pay_ins||0} / ${child.target_pi||'?'}</span></div>
          <div class="cc-pbar"><div class="cc-pbar-f" style="width:${piPct}%"></div></div>
        </div>
      </div>`;
    });
    html+='</div>';
    if(members.length){html+='<div class="notice n-warn" style="margin-top:.75rem">Manual fallback entries are shown below. Linked child plans are the primary consolidation source.</div>';}
  }

  if(!linkedChildren.length||members.length){
    html+='<div class="con-grid">';
    members.forEach(function(m,i){
      if(!linkedChildren.length){
        totalPi+=m.pi||0; totalSales+=m.sales||0; totalLeads+=m.leads||0; totalAtt+=m.att||0;
      }
      var piPct= m.piTarget&&m.piTarget>0?Math.min(100,Math.round((m.pi/m.piTarget)*100)):0;
      html+=`<div class="con-card">
        <div class="cc-role">${escapeHtml(subRole)}</div>
        <div class="cc-name">${escapeHtml(m.name||'(No Name)')}</div>
        <div class="cc-nums">
          <div class="cc-num"><span class="n">${m.leads||0}</span><span class="l">Leads</span></div>
          <div class="cc-num"><span class="n">${m.att||0}</span><span class="l">Att.</span></div>
          <div class="cc-num"><span class="n">${m.pi||0}</span><span class="l">Pay-ins</span></div>
          <div class="cc-num"><span class="n">${m.sales?'PHP'+(m.sales).toLocaleString():'0'}</span><span class="l">Sales</span></div>
        </div>
        <div class="cc-bar">
          <div class="cc-pct-lbl"><span>Pay-in Progress</span><span>${m.pi||0} / ${m.piTarget||'?'}</span></div>
          <div class="cc-pbar"><div class="cc-pbar-f" style="width:${piPct}%"></div></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:.5rem">
          <button class="btn bto btn-sm" style="flex:1" onclick="editSubMember(${i})">Edit</button>
          <button class="btn btn-sm" style="background:#FDE8E8;color:var(--danger);border:1px solid #F0B8B8;flex:1" onclick="removeSubMember(${i})">Remove</button>
        </div>
      </div>`;
    });
    html+=`<div class="cc-add-btn" onclick="openAddModal('${type}')">+ Add ${subRole}</div></div>`;
  }

  container.innerHTML=html;
  syncInteractiveAccessibility(container);
  updateSectionProgress(type,canSubmitForm(type));

  var totRow=document.getElementById(p+'-con-total');
  if(totRow){
    if(linkedChildren.length>0||members.length>0){
      totRow.style.display='grid';
      function set(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
      set(p+'-con-leads',totalLeads.toLocaleString());
      set(p+'-con-att',totalAtt.toLocaleString());
      set(p+'-con-pi',totalPi.toLocaleString());
      set(p+'-con-sales','PHP'+totalSales.toLocaleString());
    } else {
      totRow.style.display='none';
    }
  }
}

/* MISC */
function tog(el){
  el.classList.toggle('checked');
  el.setAttribute('aria-pressed',el.classList.contains('checked')?'true':'false');
  setFormDirty(true,true);
  scheduleDraftAutosave();
}
function clearPlan(type){
  if(!confirm('Clear all current form data? This will not delete anything already saved in Supabase.'))return;
  clearLocalDraftForType(type);
  resetInMemoryPlan(type);
  childPlans[type]=[];
  clearVisibleForm(type);
  planMeta[type]=makePlanMeta();
  curWeek=1;
  setFormDirty(false,true);
  renderPlanner(type); renderSummaryTbl(type); renderCal(type); calcAllTotals(type); computeProjections(type); updateDots(type); renderConsolidation(type);
  updateSaveStatus(type,{message:'Form cleared locally. Use Load Saved Plan to restore the last Supabase copy.',tone:'n-info'});
  refreshSubmitButtonState(type);
  showToast('Form cleared locally. Saved Supabase data was not deleted.');
}
async function loadSavedPlan(silent, explicitPlanId){
  if(!curType)return;
  if(!silent&&formDirty){
    if(!confirm('Replace the current form with the saved Supabase copy? Your local draft will stay on this device.'))return;
    persistLocalDraft();
  }
  if(!(window.GutguardPlanApi&&window.GutguardPlanApi.isConfigured&&window.GutguardPlanApi.isConfigured())){
    updateSaveStatus(curType);
    if(!silent)showToast('Configure Supabase before loading a saved plan.');
    return;
  }
  var ref=explicitPlanId?{planId:explicitPlanId}:(window.GutguardPlanModel&&window.GutguardPlanModel.getStoredPlanRef?window.GutguardPlanModel.getStoredPlanRef(curType,getDraftScopeId()):null);
  if(!ref||!ref.planId){
    updateSaveStatus(curType);
    if(!silent)showToast('No saved plan was found for this role on this device.');
    return;
  }
  updateSaveStatus(curType,{message:'Loading saved plan from Supabase...',tone:'n-info'});
  var loaded;
  try{
    loaded=await window.GutguardPlanApi.loadPlanFromSupabase(ref.planId);
  }catch(err){
    if(!explicitPlanId&&window.GutguardPlanModel&&window.GutguardPlanModel.clearStoredPlanRef){
      window.GutguardPlanModel.clearStoredPlanRef(curType,getDraftScopeId());
    }
    throw err;
  }
  clearDraftAutosaveTimer();
  suppressDraftPersistence=true;
  try{
    await populateParentOptions(curType, loaded.parent_plan_id||'');
    window.GutguardPlanModel.hydratePlanData(curType,loaded);
  }finally{
    suppressDraftPersistence=false;
  }
  planMeta[curType]={planId:loaded.id,status:loaded.status||'submitted',lastSavedAt:loaded.updated_at||loaded.created_at||null};
  if(window.GutguardPlanModel&&window.GutguardPlanModel.rememberPlanRef)window.GutguardPlanModel.rememberPlanRef(curType,loaded,getDraftScopeId());
  setFormDirty(false,true);
  await refreshChildPlans(curType);
  updateSaveStatus(curType);
  refreshDraftControls(curType);
  refreshSubmitButtonState(curType);
  if(!silent)showToast('Loaded "'+(loaded.full_name||TYPE_LABEL[curType])+'".');
}
async function savePlan(mode){
  if(!curType)return;
  mode=mode||'submitted';
  try{
    updateSaveStatus(curType,{message:(mode==='draft'?'Saving draft':'Submitting plan')+' to Supabase...',tone:'n-info'});
    if(PARENT_ROLE[curType]){
      await ensureValidParentSelectionBeforeSave(curType, mode);
    }
    var plan=window.GutguardPlanModel.collectPlanData(curType,planMeta[curType]);
    plan.status=mode==='draft'?'draft':'submitted';
    window.GutguardPlanModel.validatePlanData(plan,{mode:mode});
    var saved=await window.GutguardPlanApi.savePlanToSupabase(plan);
    planMeta[curType]={planId:saved.id,status:saved.status||plan.status,lastSavedAt:saved.updated_at||saved.created_at||new Date().toISOString()};
    if(window.GutguardPlanModel&&window.GutguardPlanModel.rememberPlanRef)window.GutguardPlanModel.rememberPlanRef(curType,saved,getDraftScopeId());
    clearLocalDraftForType(curType);
    setFormDirty(false,true);
    await refreshChildPlans(curType);
    resetSavedPlansCache();
    refreshSavedPlans(true);
    updateSaveStatus(curType);
    refreshDraftControls(curType);
    showToast('"'+(saved.full_name||'Plan')+'" '+(mode==='draft'?'saved as draft.':'submitted to Supabase.'));
  }catch(err){
    if(/Plan not found or not editable/i.test((err&&err.message)||'')&&window.GutguardPlanModel&&window.GutguardPlanModel.clearStoredPlanRef){
      window.GutguardPlanModel.clearStoredPlanRef(curType,getDraftScopeId());
      planMeta[curType]=makePlanMeta();
    }
    var friendlyError=getFriendlySaveError(err);
    updateSaveStatus(curType,{message:'Save failed. '+friendlyError,tone:'n-danger'});
    showToast(friendlyError);
  }
}
bootstrapAuthState();
syncInteractiveAccessibility(document);
document.addEventListener('keydown',function(event){
  var interactive=event.target&&event.target.closest?event.target.closest('[data-keyclick="true"]'):null;
  if(!interactive)return;
  if(event.key==='Enter'||event.key===' '||event.key==='Spacebar'){
    event.preventDefault();
    interactive.click();
  }
});
window.addEventListener('beforeunload',function(event){
  if(!formDirty)return;
  event.preventDefault();
  event.returnValue='You have unsaved changes on this device.';
});
if(window.GutguardSupabase&&window.GutguardSupabase.onAuthStateChange){
  window.GutguardSupabase.onAuthStateChange(async function(_event, session){
    currentUser=session&&session.user?session.user:null;
    resetSavedPlansCache();
    renderAuthState();
    refreshSavedPlans(true);
    if(curType){
      updateSaveStatus(curType);
      await populateParentOptions(curType);
      await refreshChildPlans(curType);
      refreshSubmitButtonState(curType);
    }
  });
}
function showToast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2500);}
