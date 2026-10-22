(function(){'use strict';
const M=CampaignModel,O=Chapter01Model,C=FULL_CONTENT,A=CH01_CONTENT,$=id=>document.getElementById(id),KEY='hongwu-chapter1-qa-'+window.CHAPTER_QA_ID;
const shell=$('chShell'),body=$('chBody'),art=$('chArt'),pv=$('chPV'),video=$('chVideo');let s=JSON.parse(JSON.stringify(window.CHAPTER_QA_FIXTURE)),view='story',selected=null,conversation=null,lineIndex=0,replay=false,clipId='',saveOK=true,loadWarning='';
try{const t=localStorage.getItem(KEY);if(t){const p=JSON.parse(t);if(M.validate(p))s=p;else{localStorage.setItem(KEY+'-invalid-'+Date.now(),t);loadWarning='旧记录未通过检查，已另存备份，本次从初始状态开始。';}}}catch(e){saveOK=false;loadWarning='暂不能读取自动记录，请使用导出存档。';}
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(id,label,style='ch-primary',disabled=false)=>'<button id="'+id+'" class="'+style+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
function bind(id,fn){const b=$(id);if(b)b.onclick=()=>{try{fn();}catch(e){body.insertAdjacentHTML('beforeend','<p class="ch-error">'+esc(e.message)+'</p>');}};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(s));saveOK=true;}catch(e){saveOK=false;}sync();}
function mutate(fn,...args){s=fn(s,...args);if(!M.validate(s))throw Error('内部状态检查失败，请保留导出记录。');save();}
function epi(){return M.current(s);}
function title(){return s.phase==='opening'?(s.opening.phase==='intro'||s.opening.phase==='prepare'||s.opening.phase==='prepPV'||s.opening.phase==='prepared'?'帐下立足':'随军立功'):epi().title;}
function pending(){return s.phase==='opening'?s.opening.pendingPV:s.pendingPV;}
function seen(){return [...new Set([...s.opening.seen,...s.seen])];}
function placeFor(){if(s.phase==='opening')return s.opening.phase==='tactical'?'road':'camp';if(s.phase==='story')return C.contacts[epi().contacts[s.contacts.length]].scene;return epi().scene;}
function artId(){if(s.phase==='opening')return s.opening.phase==='intro'?'opening-retained':s.opening.phase==='tactical'?'b-ground':s.opening.phase==='complete'?'b-roster-return':'a-roster';if(s.phase==='story')return C.contacts[epi().contacts[s.contacts.length]].art;return C.sequences[epi().id+'-'+(s.choice||Object.keys(epi().options)[0])][0];}
function artUrl(id){return 'assets/'+(C.shots[id]?'full/':'chapter01/')+id+'.webp';}
function picture(id,caption){art.innerHTML='<img src="'+artUrl(id)+'" alt="'+esc(caption)+'"><figcaption>'+esc(caption)+'<small>人物对白、场景和玩法数值为复原；依据与分歧见“史”。</small></figcaption>';}
function stats(){const o=s.opening,r=s.phase==='opening'?o:s;const cells=s.phase==='opening'?[[o.men-o.wounded+'/9','可行动'],[o.equipment+'套','装备'],[o.training+'级','操练'],[o.arrows+'支','箭矢'],[o.tools+'份','绳具'],[o.fatigue,'疲劳']]:[[s.fatigue,'疲劳'],[s.wounded,'待养'],[s.grain,'本队公粮'],[s.houseGrain,'郭家粮'],[s.followers||s.recruits||(s.handed?0:9),s.followers?'同行':s.recruits?'新募':s.handed?'本人部下':'受任部下'],[s.travelGrain||s.carried,'随身行粮']];return '<div class="ch-stats">'+cells.map(a=>'<div><b>'+a[0]+'</b><span>'+a[1]+'</span></div>').join('')+'</div>';}
function sync(){
 const e=epi(),year=e?.year||1352,chapter=e?.chapter||(s.opening.phase==='intro'||s.opening.phase.includes('prep')?1:2);
 $('chSaveStatus').textContent=(saveOK?'进度已在本机保存':'自动记录不可用 · 请导出存档')+' · '+(s.phase==='complete'?'第一章完成':title());
 $('questBadge').textContent=s.phase==='complete'?'章终':chapter+'/8';
 $('mainQuest').setAttribute('aria-label','主线竹简：'+title());
 document.querySelector('.brand small').textContent='第一章 · 濠州投军';
 document.querySelector('.date strong').textContent=year===1352?'至正十二年':'至正十三年';
 document.querySelector('.date small').textContent=e?.date||'1352 · 郭子兴帐下';
 document.querySelector('.player p').innerHTML=(s.phase==='complete'?'离濠南行 · 徐达等同行':'郭子兴帐下 · 濠州')+'<br>独立领地尚未建立';
 const pd=document.querySelectorAll('.player-data b');if(pd[1])pd[1].textContent=s.phase==='opening'?(s.metOpening?'9人':'待受任'):s.handed?(s.followers?'24同行':'已交兵'):s.recruits?s.recruits+'人':'9人';
 placeState.married=s.married;placeState.residence=s.married;
 $('homeButton').classList.toggle('locked',!s.married);$('homeButton').classList.toggle('active-place',s.married);
 $('homeButton').setAttribute('aria-label',s.married?'家：进入与马氏的居所':'家：成亲后开放');if($('homeState'))$('homeState').textContent=s.married?'返回居所':'成亲后开放';
 const lock=$('homeButton').querySelector('.lock-mark')?.parentElement;if(lock)lock.style.display=s.married?'none':'';
 document.querySelector('.book-caption').textContent=s.phase==='complete'?'第一章完 · 查阅行军账':'主线竹简 · '+title();
 $('statusLine').textContent='当前主线：'+title()+' · '+(s.phase==='complete'?'首次离濠，下一章待续':'可入场所行走与交谈');
 if($('chapterProgress'))$('chapterProgress').innerHTML=Array.from({length:8},(_,i)=>'<span class="'+(i+1<chapter||s.phase==='complete'?'done':i+1===chapter?'now':'')+'">'+(i+1)+'</span>').join('');
 window.ChapterMap?.apply(s);renderView();
 if(window.ChapterWorld?.isOpen())window.ChapterWorld.updateGoal(goalFor(window.ChapterWorld.getPlace())||{id:'journal',name:'查阅下一段主线'});
 const storyNode=e?.id.startsWith('siege')?'haozhou_siege':e?.id==='departure'?'haozhou_departure':'haozhou_service';
 document.dispatchEvent(new CustomEvent('hongwu:snapshot-committed',{detail:{year,displayName:'朱重八',milestones:{armyService:true,independentCommand:false,accession:false},storyNode,nodeStatus:'active'}}));
}
function open(mode='story'){view=mode;conversation=null;selected=null;closeTask();closeDetail();closePlace();if(pending()&&mode==='story'){play(pending(),false);return;}render();if(!shell.open)shell.showModal();}
function showHistory(){
 let h;if(s.phase==='opening'){const old=A.history[s.opening.preparation?'mission':'prepare'];h={title:old.title,text:old.situation+' '+old.record+' '+old.scope,sources:old.sources};}else h=C.history[epi().id.startsWith('siege')?'siege':epi().id];
 $('chHistoryBody').innerHTML='<h2 id="chHistoryHeading">史 · '+h.title+'</h2><p>'+h.text+'</p><h3>可核对出处</h3>'+h.sources.map(a=>'<p><a target="_blank" rel="noopener" href="'+a[1]+'">'+a[0]+'</a></p>').join('')+'<p>本章继续称朱重八，不捏造更名日期。具体对白不是史书逐字实录；朱、马形象沿用用户指定的AI还原参考。</p>';$('chHistory').showModal();
}
function goalFor(kind){
 const activeScene=placeFor();let goal=null;
 if(kind===activeScene){
  if(s.phase==='opening'){if(!s.metOpening)goal={id:'commander',name:'郭部传令者'};else if(s.opening.phase==='tactical')goal={id:'execute',name:O.steps[s.opening.turn]};else goal={id:'journal',name:'查阅当前军令'};}
  else if(s.phase==='story'){const id=epi().contacts[s.contacts.length],c=C.contacts[id];goal={id,name:c.name,type:id.startsWith('ma')?'ma':'soldier'};}
  else if(s.phase==='execute')goal={id:'execute',name:epi().options[s.choice].steps[s.step]};
  else goal={id:'journal',name:'查阅主线竹简'};
 }
 return goal;
}
function travel(kind=placeFor()){
 shell.close();const goal=goalFor(kind);
 if(!window.ChapterWorld){body.innerHTML='<p>场景尚未载入完成，请重试；如持续失败，可刷新后继续存档。</p>'+btn('retryScene','重试进入场所');bind('retryScene',()=>travel(kind));shell.showModal();return;}
 window.ChapterWorld.open(kind,goal,interact);
}
function interact(id){
 if(id==='journal'){open();return;}
 if(id==='observe'||id==='ambient'){view='ambient';conversation={name:id==='observe'?'场所观察':'军民',art:artId(),lines:[[id==='observe'?'朱重八':'军民',id==='observe'?'木器有磨损，粮袋有来处。营、家与城墙各有所属，不能因走到这里便据为己有。':'乱世里最盼的，是今日守得住，明日有饭吃。']]};lineIndex=0;render();shell.showModal();return;}
 if(id==='execute'){if(!(s.phase==='execute'||s.phase==='opening'&&s.opening.phase==='tactical')){open();return;}view='command';conversation=null;render();shell.showModal();return;}
 if(id==='commander'&&!s.metOpening){mutate(M.opening,'meet');view='story';render();shell.showModal();return;}
 const expected=epi()?.contacts[s.contacts.length];if(s.phase==='story'&&id===expected){view='conversation';conversation=C.contacts[id];conversation.id=id;lineIndex=0;render();shell.showModal();}
}
function render(){
 $('chHeading').textContent=title();$('chRestart').textContent=s.phase==='opening'?'重新开始':'本节点检查点';picture(artId(),title());
 if(view==='ledger'){ledger();return;}if(view==='gallery'){gallery();return;}if(view==='settings'){settings();return;}if(view==='places'){places();return;}
 if(view==='ambient'||view==='conversation'){const line=conversation.lines[lineIndex];picture(conversation.art,conversation.name);body.innerHTML='<span class="ch-kicker">'+(view==='ambient'?'场所见闻':'人物交谈')+'</span><h2>'+conversation.name+'</h2><div class="ch-dialogue"><b>'+line[0]+'</b>'+line[1]+'</div><div class="ch-actions">'+btn('talkNext',lineIndex+1<conversation.lines.length?'继续对话 →':'记下此事 →')+btn('hist','史','ch-history')+'</div>';bind('hist',showHistory);bind('talkNext',()=>{if(lineIndex+1<conversation.lines.length){lineIndex++;render();}else{if(view==='conversation')mutate(M.contact,conversation.id);view='story';conversation=null;render();}});return;}
 if(view==='command'){const text=s.phase==='opening'?O.steps[s.opening.turn]:epi().options[s.choice].steps[s.step];body.innerHTML='<span class="ch-kicker">现场执行 · 行动暂停</span><h2>'+text+'</h2><p>抵达目标，人员就位。确认后执行这一项命令，记录本步用时和物料。</p>'+stats()+'<div class="ch-actions">'+btn('doStep','执行命令 →')+btn('backScene','暂缓，返回现场','ch-secondary')+'</div>';bind('backScene',()=>shell.close());bind('doStep',()=>{if(s.phase==='opening')mutate(M.opening,'advance');else mutate(M.advance);view='story';if(pending())play(pending(),false);else render();});return;}
 if(s.phase==='opening'){openingRender();return;}
 const e=epi();
 if(s.phase==='story'){const id=e.contacts[s.contacts.length],c=C.contacts[id];body.innerHTML='<span class="ch-kicker">任务'+e.chapter+' · '+e.date+'</span><h2>'+e.title+'</h2><p>'+({marriage:'郭子兴以马氏妻重八。家门已经打开，城中诸部的嫌隙却日益加深。',rescue:'淮北传来拘郭之讯。先核实，再求援，不能只身闯营。',siege1:'元军围城。你受任守住一段城防，分配手头的人和粮料。',siege2:'冬去春来，围城未解。已将过渡期间的例粮与耗粮入账，继续检查眼前的困境。',siege3:'门栅需要加固，守军需要替换。是否急进，取决于现在的疲劳。',salt:'围城解除之后，郭家缺粮。带盐去怀远，换粮归来。',recruit:'归乡招募，自愿来从的人逐渐聚集。人、粮、械都要点清。',departure:'把所募兵众交给他将，携少数同伴南去。走前把每一笔账交清。'}[e.id])+'</p><div class="ch-objective"><small>下一步 '+(s.contacts.length+1)+' / '+e.contacts.length+'</small><strong>与'+c.name+'交谈</strong></div><div class="ch-actions">'+btn('go','前往场所 →')+btn('hist','史','ch-history')+'</div>'+stats();bind('go',()=>travel(c.scene));bind('hist',showHistory);
 }else if(s.phase==='choose'){body.innerHTML='<span class="ch-kicker">作出抉择 · 提交前可读“史”</span><h2>'+e.title+'</h2><div class="ch-options">'+Object.entries(e.options).map(([id])=>{const f=M.forecast(s,id);return '<button class="ch-option" data-choice="'+id+'" aria-pressed="'+(selected===id)+'" '+(!f.allowed?'disabled':'')+'><strong>'+f.name+'</strong><span>'+f.summary+(f.reason?'<br>'+f.reason:'')+'</span></button>';}).join('')+'</div><p class="ch-impact">只有提交方案并执行命令才会入账；仅查看不会扣除资源。</p><div class="ch-actions">'+btn('commit','按此行事 →','ch-primary',!selected)+btn('hist','史','ch-history')+'</div>'+stats();body.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{selected=b.dataset.choice;render();});bind('commit',()=>{mutate(M.choose,selected);selected=null;render();});bind('hist',showHistory);
 }else if(s.phase==='execute'){execution(e.options[s.choice].steps,s.step);
 }else if(s.phase==='result'){const ids=C.sequences[e.id+'-'+s.choice];picture(ids.at(-1),e.title+' · 行动已毕');body.innerHTML='<span class="ch-kicker">选择结果已入账</span><h2>'+e.options[s.choice].name+'</h2>'+stats()+'<p class="ch-impact">'+esc(s.log.slice(-3).map(x=>x.text).join('。'))+'</p><div class="ch-actions">'+btn('next',s.episode===M.episodes.length-1?'完成第一章 →':'继续主线 →')+btn('replay','重看本段PV','ch-secondary')+'</div>';bind('next',()=>{mutate(M.next);render();});bind('replay',()=>play(e.id+'-'+s.choice,true));
 }else if(s.phase==='complete'){picture('h-south-road','第一次离开濠州');body.innerHTML='<span class="ch-kicker">第一章 · 濠州投军 · 完</span><h2>从九夫，到南行。</h2><p>七百人及剩余粮械已交出。同行24人，连主角按25口计算，现有行粮'+s.travelGrain+'份，可支'+s.travelGrain/25+'日。没有新增独立领地。</p>'+stats()+'<p>《实录》紧接着记中途遇疾复还。第二章从这里承接；此处尚未取定远。</p><div class="ch-actions">'+btn('handoff','导出第二章承接记录')+btn('export','导出完整存档','ch-secondary')+btn('review','回看本章PV','ch-secondary')+'</div>';bind('handoff',()=>download(M.handoff(s),'第二章承接记录.json'));bind('export',()=>download(s,'第一章完整存档.json'));bind('review',()=>open('gallery'));}
}
function execution(steps,step){body.innerHTML='<span class="ch-kicker">命令执行 · '+step+'/'+steps.length+'</span><h2>'+steps[step]+'</h2><ol class="full-steps">'+steps.map((x,i)=>'<li class="'+(i<step?'done':i===step?'now':'')+'">'+(i<step?'✓ ':i===step?'→ ':'')+x+'</li>').join('')+'</ol>'+stats()+'<div class="ch-actions">'+btn('go','进入现场，执行下一步 →')+btn('hist','史','ch-history')+'</div><p>现场行走不扣战略回合。抵达交互标记后按 E，下达本步命令。</p>';bind('go',()=>travel());bind('hist',showHistory);}
function openingRender(){const o=s.opening;
 if(!s.metOpening){body.innerHTML='<span class="ch-kicker">任务一 · 帐下立足</span><h2>先往军营，领受差事。</h2><p>你已被郭子兴收留，换上红巾军服。现在从城中的一名新卒开始。</p><p>进入军营后，用 WASD / 方向键行走，走近传令者按 E。也可点击地面或使用屏幕方向键。</p><div class="ch-actions">'+btn('go','进入军营 →')+btn('prologue','重看入濠开场','ch-secondary')+btn('hist','史','ch-history')+'</div>'+(loadWarning?'<p>'+loadWarning+'</p>':'');bind('go',()=>travel('camp'));bind('prologue',()=>play('prologue',true));bind('hist',showHistory);return;}
 if(o.phase==='intro'){const d=A.intro[o.intro];picture(d.art,'一纸军令，九个人。');body.innerHTML='<span class="ch-kicker">帐下立足</span><h2>留在帐下之后</h2><div class="ch-dialogue"><b>'+d.speaker+'</b>'+d.text+'</div><div class="ch-actions">'+btn('next','继续 →')+btn('hist','史','ch-history')+'</div>';bind('next',()=>{mutate(M.opening,'next');render();});bind('hist',showHistory);}
 else if(o.phase==='prepare'){body.innerHTML='<span class="ch-kicker">任务一 · 三个准备时段</span><h2>把九个人带起来</h2><p>每时段30分钟，共90分钟。九名部下不是个人私兵。</p><div class="ch-options">'+Object.entries(O.preparations).map(([id,p])=>'<button class="ch-option" data-prep="'+id+'" aria-pressed="'+(selected===id)+'"><strong>'+p.name+'</strong><span>'+p.description+'<br>'+p.cost+'</span></button>').join('')+'</div><div class="ch-actions">'+btn('commit','按此准备 →','ch-primary',!selected)+btn('hist','史','ch-history')+'</div>';body.querySelectorAll('[data-prep]').forEach(b=>b.onclick=()=>{selected=b.dataset.prep;render();});bind('commit',()=>{mutate(M.opening,'prepare',selected);selected=null;play(pending(),false);});bind('hist',showHistory);}
 else if(o.phase==='prepared'){picture('a-ready','准备已毕');body.innerHTML='<h2>'+O.preparations[o.preparation].name+'</h2>'+stats()+'<p>九名部下仍在郭部编制。接下来领受外围接应差事。</p>'+btn('next','领受接应差事 →');bind('next',()=>{mutate(M.opening,'next');render();});}
 else if(o.phase==='mission'){picture('b-ground','接到人，就带回来。');body.innerHTML='<span class="ch-kicker">任务二 · 教学情境，非史载首战</span><h2>守住一条退路</h2><p>接回三名本部军士，不追出通路。他们回原部，不并入你的九人队。</p><div class="ch-options">'+Object.entries(O.tactics).map(([id,t])=>{const f=O.forecast(o,id);return '<button class="ch-option" data-tactic="'+id+'" aria-pressed="'+(selected===id)+'" '+(f.allowed?'':'disabled')+'><strong>'+t.name+'</strong><span>'+(f.allowed?'时间'+f.minutes+'分钟 · 疲劳+'+f.fatigue+' · 箭矢−'+f.arrows+' · 绳具−'+f.tools+' · 伤员'+f.wounded:f.reason)+'</span></button>';}).join('')+'</div><div class="ch-actions">'+btn('commit','按此出发 →','ch-primary',!selected)+btn('hist','史','ch-history')+'</div>';body.querySelectorAll('[data-tactic]').forEach(b=>b.onclick=()=>{selected=b.dataset.tactic;render();});bind('commit',()=>{mutate(M.opening,'dispatch',selected);selected=null;render();});bind('hist',showHistory);}
 else if(o.phase==='tactical')execution(O.steps,o.turn);
 else if(o.phase==='complete'){picture(o.wounded?'b-wound':'b-roster-return','人已归营');body.innerHTML='<span class="ch-kicker">任务二 · 完成</span><h2>接应归营</h2><p>'+o.lastResult.text+'</p>'+stats()+'<div class="ch-impact">累计'+o.minutes+'分钟，伤员'+o.wounded+'人。后续节点继续保留。</div>'+btn('next','继续：成家与嫌隙 →');bind('next',()=>{mutate(M.startLater);render();});}
}
function places(){const choices=[['camp','军营',true],['home','家',s.married],['road','城外通路',s.metOpening],['compound','营救院落',s.episode===1],['wall','城防',s.episode>=2],['market','怀远集市',s.episode>=5],['village','乡里',s.episode>=6],['gate','南门',s.episode>=7]];picture('a-ready','场所有所归属，进入不等于占有');body.innerHTML='<h2>本章场所</h2><div class="ch-options">'+choices.map(([id,name,ok])=>'<button data-place="'+id+'" class="ch-option" '+(ok?'':'disabled')+'><strong>'+name+'</strong><span>'+(ok?'进入场所，行走与交谈':'随主线开放')+'</span></button>').join('')+'</div>'+btn('mapPlaces','查看地图据点资料','ch-secondary');body.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>travel(b.dataset.place));bind('mapPlaces',()=>{shell.close();openPlaceList();});}
function ledger(){picture('b-roster-return','每一笔，都有来处');const names={minutes:'分钟',fatigue:'疲劳',wounded:'伤员',grain:'公粮',houseGrain:'郭家粮',material:'修材',carried:'随队粮',recruits:'兵员',equipment:'装备',salt:'盐',travelGrain:'行粮',training:'操练',bandages:'裹伤布',routineIssued:'例粮拨付',routineConsumed:'例粮消耗',routeKnown:'侧路情报',rescued:'接应军士',arrows:'箭矢',tools:'绳具',followers:'同行者',gateClue:'营门线索',handed:'已移交兵员'};const rows=[...s.opening.ledger,...s.log];body.innerHTML='<h2>第一章 · 连续行军账</h2>'+stats()+'<p>公粮、郭家粮、另准行粮分别记账；时间窗口和数值都是玩法参数。</p><table class="ch-ledger"><thead><tr><th>事由</th><th>收支 / 变化</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.text.replace(/已交谈并核实：([a-z_]+)/g,(_,id)=>'已交谈并核实：'+(C.contacts[id]?.name||id)))+'</td><td>'+Object.entries(r.delta||{}).filter(([k,v])=>v).map(([k,v])=>(names[k]||k)+' '+(typeof v==='boolean'?(v?'已掌握':'未掌握'):(v>0?'+':'')+v)).join(' / ')+'</td></tr>').join('')+'</tbody></table><div class="ch-actions">'+btn('export','导出完整存档')+btn('back','返回主线','ch-secondary')+'</div>';bind('export',()=>download(s,'第一章完整存档.json'));bind('back',()=>open());}
function clipName(id){return A.clips[id]?.title|| (id==='prologue'?'入濠投军 · 90秒':M.episodes.find(e=>id.startsWith(e.id+'-'))?.title+' · '+id.split('-').at(-1));}
function gallery(){picture('h-south-road','回看，不改变行军账');body.innerHTML='<h2>第一章 · 影卷</h2><p>已完成的片段可随时重看，播放不重复结算。</p><div class="ch-pv-review">'+['prologue',...seen()].map(id=>'<button data-replay="'+id+'" class="ch-secondary">'+clipName(id)+' →</button>').join('')+'</div><p><a href="原画与分镜总览.html" target="_blank" rel="noopener">制作评审：全部原画与分支PV →</a></p>'+btn('back','返回主线');body.querySelectorAll('[data-replay]').forEach(b=>b.onclick=()=>play(b.dataset.replay,true));bind('back',()=>open());}
function settings(){picture('h-roster','保存一段路，重新推演一个选择');body.innerHTML='<h2>记录与检查点</h2><p>自动记录保存在当前浏览器。换浏览器或迁移电脑前，请导出完整存档。</p><div class="ch-actions">'+btn('export','导出完整存档')+btn('checkpoint','回到本节点检查点','ch-secondary',!s.checkpoint)+btn('new','重新开始第一章','ch-secondary')+'</div><label class="save-import">导入完整存档<input type="file" id="importSave" accept=".json,application/json"></label><details><summary>通过存档文本导入</summary><textarea id="importText" aria-label="粘贴完整存档文本" style="width:100%;min-height:140px"></textarea><button id="importTextButton" class="ch-secondary">导入这份文本存档</button></details><p id="saveFeedback"></p><div id="resetConfirm" hidden><p>重新开始会替换当前自动记录。请先导出需要保留的进度。</p>'+btn('confirmNew','确认重新开始')+btn('cancelNew','取消','ch-secondary')+'</div>'+btn('back','返回主线','ch-secondary');bind('export',()=>download(s,'第一章完整存档.json'));bind('checkpoint',()=>{mutate(M.restore);open();});bind('new',()=>{$('resetConfirm').hidden=false;});bind('confirmNew',()=>{s=M.initial();save();open();});bind('cancelNew',()=>{$('resetConfirm').hidden=true;});bind('back',()=>open());$('importSave').onchange=async e=>{try{const file=e.target.files[0];if(!file||file.size>2000000)throw Error('请选择小于2MB的本章JSON存档');const value=JSON.parse(await file.text());if(!M.validate(value))throw Error('存档不符合本章格式，当前记录未改变');s=value;save();open();}catch(error){$('saveFeedback').textContent=error.message;}};}
body.addEventListener('click',e=>{
 if(e.target.id!=='importTextButton')return;
 try{const text=$('importText').value;if(text.length>2000000)throw Error('存档文本不能超过2MB');const value=JSON.parse(text);if(!M.validate(value))throw Error('存档不符合本章格式，当前记录未改变');s=value;save();open();}
 catch(error){$('saveFeedback').textContent=error.message;}
});
function download(data,name){
 const text=JSON.stringify(data,null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 body.innerHTML='<h2>'+esc(name)+'</h2><p>下载文件，或复制下方存档文本保存。文本导入与文件导入使用同一格式。</p><div class="ch-actions"><a class="ch-primary" id="saveFileLink">下载 JSON 文件</a>'+btn('copySave','复制存档文本','ch-secondary')+btn('backSave','返回主线','ch-secondary')+'</div><p id="copyFeedback"></p><textarea id="exportText" aria-label="完整存档文本" readonly style="width:100%;min-height:200px;font:11px monospace;background:#efe4ca;color:#304338"></textarea>';
 $('exportText').value=text;const a=$('saveFileLink');a.href=url;a.download=name;
 bind('copySave',async()=>{try{await navigator.clipboard.writeText(text);$('copyFeedback').textContent='存档文本已复制。';}catch(e){$('exportText').focus();$('exportText').select();$('copyFeedback').textContent='文本已选中，按 Ctrl+C 复制。';}});
 bind('backSave',()=>{URL.revokeObjectURL(url);open();});a.click();
}
function play(id,readonly){clipId=id;replay=readonly;shell.close();video.src='pv/'+id+'.mp4';video.load();$('chPVSkip').hidden=!readonly&&!seen().includes(id);$('chPVStatus').textContent='字幕与逐镜音效 · 无配音';if(!pv.open)pv.showModal();video.play().catch(()=>{$('chPVStatus').textContent='点击播放开始';});}
function done(){if(!pv.open)return;video.pause();pv.close();if(!replay){if(s.phase==='opening')mutate(M.opening,'finishPV');else mutate(M.finishPV);}view=replay?'gallery':'story';render();shell.showModal();}
video.onended=done;video.onerror=()=>{$('chPVStatus').textContent='片段未能加载，请检查文件；当前进度已保留。';};video.onplay=()=>{$('chPVPause').textContent='暂停';};video.onpause=()=>{$('chPVPause').textContent='播放';};
$('chPVPause').onclick=()=>video.paused?video.play():video.pause();$('chPVReplay').onclick=()=>{video.currentTime=0;video.play();};$('chPVMute').onclick=()=>{video.muted=!video.muted;};$('chPVSkip').onclick=done;$('chPVBack').onclick=()=>{video.pause();pv.close();};pv.addEventListener('cancel',()=>video.pause());
$('chReturn').textContent='返回现场 / 地图';$('chReturn').onclick=()=>shell.close();$('chCloseHistory').onclick=()=>$('chHistory').close();$('chShowLedger').onclick=()=>open('ledger');$('chShowGallery').onclick=()=>open('gallery');$('chRestart').onclick=()=>open('settings');
for(const d of[shell,pv,$('chHistory')])d.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
openTask=()=>open();$('mainQuest').onclick=openTask;$('campButton').onclick=()=>travel('camp');$('homeButton').onclick=()=>{if(s.married)travel('home');else openPlace('home');};enterPlaceScene=p=>{if(p.id==='home'&&!s.married)return;travel(p.id==='home'?'home':'camp');};
$('placesButton').onclick=()=>open('places');const progress=document.createElement('div');progress.id='chapterProgress';progress.className='chapter-progress';progress.setAttribute('aria-label','八段主线进度');document.querySelector('.player').append(progress);window.FullChapter={open,travel,sync};sync();
})();
