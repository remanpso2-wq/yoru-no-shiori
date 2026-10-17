import {findCase} from './cases.mjs';
export class GameError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const fail=(s,status=400)=>{throw new GameError(s,status)};
export function newRoom(caseId,uid,name,solo,now=Date.now()){
 if(!findCase(caseId))fail('物語が見つかりません。');
 return {caseId,host:uid,solo,phase:'lobby',members:[{id:uid,name}],shared:[],notes:[],hints:0,attempts:[],created:now,expires:now+86400000,revision:0};
}
export function transition(original,uid,a,now=Date.now()){
 const s=structuredClone(original);const c=findCase(s.caseId);
 if(now>=s.expires)fail('部屋の有効期限が切れました。新しい部屋を作ってください。',410);
 const me=s.members.find(m=>m.id===uid);
 const signature=JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k])=>k!=='requestId').sort(([a],[b])=>a.localeCompare(b))));
 if(a.requestId!==undefined){
  if(typeof a.requestId!=='string'||! /^[a-f0-9-]{36}$/i.test(a.requestId))fail('操作IDが不正です。');
  const receipt=(s.receipts||[]).find(r=>r.uid===uid&&r.id===a.requestId);
  if(receipt){if(receipt.signature!==signature)fail('同じ操作IDで異なる操作はできません。',409);return s;}
 }
 if(a.type==='join'){
  if(me)return s;
  if(s.phase!=='lobby'||s.solo||s.members.length>=4)fail('この部屋には参加できません。',409);
  s.members.push({id:uid,name:a.name});
 }else{
  if(!me)fail('先に部屋へ参加してください。',403);
  if(a.type==='start'){
   if(uid!==s.host)fail('開始できるのはホストです。',403);
   if(s.phase!=='lobby')fail('すでに開始しています。',409);
   s.phase='playing';
  }else if(a.type==='transfer'){
   if(uid!==s.host)fail('引継ぎできるのはホストです。',403);
   if(!['lobby','playing'].includes(s.phase))fail('終了後は引き継げません。',409);
   if(!Number.isInteger(a.target)||!s.members[a.target]||s.members[a.target].id===uid)fail('引継ぎ先を選んでください。');
   s.host=s.members[a.target].id;
  }else if(a.type==='share'){
   if(s.phase!=='playing')fail('プレイ中に操作してください。',409);
   const i=a.index;
   if(!Number.isInteger(i)||i<0||i>=c.clues.length)fail('手がかりが不正です。');
   if(i%s.members.length!==s.members.indexOf(me))fail('この手がかりは仲間が持っています。',403);
   if(!s.shared.includes(i))s.shared.push(i);
  }else if(a.type==='note'){
   if(s.phase!=='playing')fail('プレイ中にメモしてください。',409);
   if(typeof a.text!=='string'||!a.text.trim()||a.text.length>180)fail('メモは1〜180文字で入力してください。');
   if(s.notes.length>=40)fail('この部屋のメモは40件までです。');
   if(s.notes.some(n=>n.uid===uid&&now-n.at<1500))fail('少し待ってから投稿してください。',429);
   s.notes.push({uid,name:me.name,text:a.text.trim(),at:now});
  }else if(a.type==='hint'){
   if(uid!==s.host)fail('ヒントを開けるのはホストです。',403);
   if(s.phase!=='playing'||s.hints>=c.hints.length)fail('これ以上ヒントはありません。',409);
   s.hints++;
  }else if(a.type==='answer'){
   if(uid!==s.host)fail('解答できるのはホストです。',403);
   if(s.phase!=='playing')fail('現在は解答できません。',409);
   if(!c.options.some(o=>o[0]===a.answer))fail('選択肢が不正です。');
   let key=a.answer;let supported=true;
   if(c.evidence){
    if(!Array.isArray(a.evidence)||a.evidence.length!==2||new Set(a.evidence).size!==2||a.evidence.some(i=>!Number.isInteger(i)||i<0||i>=c.clues.length))fail('根拠となる異なる手がかりを2枚選んでください。');
    if(a.evidence.some(i=>!s.shared.includes(i)&&i%s.members.length!==s.members.indexOf(me)))fail('まだ読めない手がかりは根拠に選べません。',403);
    const chosen=[...a.evidence].sort();key=a.answer+':'+chosen.join(',');supported=JSON.stringify(chosen)===JSON.stringify([...c.evidence].sort());
   }
   if(s.attempts.includes(key))fail('その答えと根拠の組み合わせはすでに試しました。',409);
   s.attempts.push(key);
   if(a.answer===c.answer&&supported)s.phase='solved';else if(s.attempts.length>=2)s.phase='ended';
  }else fail('操作が不正です。');
 }
 if(a.requestId)s.receipts=[...(s.receipts||[]),{uid,id:a.requestId,signature}].slice(-64);
 s.revision++;return s;
}
export function view(s,uid,now=Date.now()){
 if(now>=s.expires)fail('部屋の有効期限が切れました。',410);
 const index=s.members.findIndex(m=>m.id===uid);if(index<0)fail('部屋への参加が必要です。',403);
 const c=findCase(s.caseId);const done=['solved','ended'].includes(s.phase);
 return {evidenceRequired:!!c.evidence,solutionEvidence:done?(c.evidence||[]):[],revision:s.revision,phase:s.phase,solo:s.solo,title:c.title,scene:c.scene,host:s.host===uid,members:s.members.map((m,i)=>({name:m.name,you:m.id===uid,host:m.id===s.host,color:i})),shared:s.shared,clues:s.phase==='lobby'?[]:c.clues.map(([title,text],i)=>({index:i,title,owned:i%s.members.length===index,owner:s.members[i%s.members.length].name,text:done||s.shared.includes(i)||i%s.members.length===index?text:null})),notes:s.notes.map(({name,text,at})=>({name,text,at})),hints:c.hints.slice(0,s.hints),attempts:s.attempts,options:s.phase==='lobby'?[]:c.options,expires:s.expires,score:s.phase==='solved'?Math.max(0,100-s.hints*15-(s.attempts.length-1)*20):null,explanation:done?c.explanation:null,answer:done?c.answer:null};
}
