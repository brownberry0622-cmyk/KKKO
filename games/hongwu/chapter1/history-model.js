(function(root){'use strict';
const H=root.HistoryAudit,M=root.Chapter3Model||root.Chapter2Model||root.CampaignModel;
if(!M||!H)return; const chapter=root.Chapter3Model?3:root.Chapter2Model?2:1,events=H.events.filter(e=>e.chapter===chapter),copy=v=>JSON.parse(JSON.stringify(v));
const position=s=>chapter===1?s.episode:s.node,oldNext=M.next,oldValidate=M.validate;
M.next=function(s){const e=events.find(e=>e.index===position(s)&&!s.seen.includes(e.id));if(s.phase==='result'&&e&&!s.risk?.incident&&!s.risk?.pendingPV){const n=copy(s);n.phase='pv';n.pendingPV=e.id;return n;}return oldNext(s);};
M.validate=function(s,...args){if(!s)return false;const e=events.find(e=>e.id===s.pendingPV);if(!e)return oldValidate(s,...args);if(s.phase!=='pv'||e.index!==position(s)||s.seen?.includes(e.id))return false;const n=copy(s),current=M.current(n);n.pendingPV=current.id+'-'+n.choice;return oldValidate(n,...args);};
H.chapter=chapter;H.forState=s=>events.find(e=>e.index===position(s)&&!s.seen.includes(e.id));
if(root.Chapter3Sequences)for(const e of events){root.Chapter3Sequences[e.id]=e.shots.map(s=>s.id);for(const sh of e.shots)root.Chapter3Art[sh.id]=sh;}
if(root.FULL_CONTENT)for(const e of events){root.FULL_CONTENT.sequences[e.id]=e.shots.map(s=>s.id);}
})(globalThis);
