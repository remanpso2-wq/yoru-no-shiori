import {getDb} from '@/db';
import {rooms} from '@/db/schema';
import {eq,and,gt,lt,count} from 'drizzle-orm';
import {catalog} from '@/game/cases.mjs';
import {readAction} from '@/game/request.mjs';
import {newRoom,transition,view,GameError} from '@/game/engine.mjs';
export const dynamic='force-dynamic';
function respond(data:unknown,status=200,cookie?:string){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}})}
function token(req:Request){return req.headers.get('cookie')?.match(/(?:^|;\s*)yoru_session=([a-f0-9]{64})(?:;|$)/)?.[1]}
async function hash(v:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('')}
function name(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>16)throw new GameError('名前は1〜16文字で入力してください。');return v.trim()}
function code(v:unknown){if(typeof v!=='string'||! /^[A-Z2-9]{10}$/.test(v))throw new GameError('10文字のルームコードを確認してください。');return v}
function handle(e:unknown){return e instanceof GameError?respond({error:e.message},e.status):respond({error:'接続に失敗しました。少し待って再試行してください。'},503)}
export async function GET(req:Request){try{const c=new URL(req.url).searchParams.get('room');if(!c)return respond({cases:catalog()});const t=token(req);if(!t)throw new GameError('先に部屋へ参加してください。',403);const row=await getDb().select().from(rooms).where(eq(rooms.code,code(c))).get();if(!row)throw new GameError('部屋が見つかりません。',404);return respond({room:c,...view(JSON.parse(row.state),await hash(t))});}catch(e){return handle(e)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)throw new GameError('同じサイトから操作してください。',403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new GameError('JSONで送信してください。',415);
 const a=await readAction(req);
 const t=token(req)||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');const uid=await hash(t);
 const cookie=`yoru_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(req.url).protocol==='https:'?'; Secure':''}`;
 const db=getDb();
 if(a.type==='create'){
  const n=name(a.name);const rows=await db.select({n:count()}).from(rooms).where(and(eq(rooms.owner,uid),gt(rooms.expires,Date.now()))).get();if((rows?.n||0)>=10)throw new GameError('有効な部屋は10個までです。明日また作成できます。',429);
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const c=Array.from(crypto.getRandomValues(new Uint8Array(10)),x=>chars[x%chars.length]).join('');
  const s=newRoom(a.caseId,uid,n,a.solo===true);await db.insert(rooms).values({code:c,owner:uid,state:JSON.stringify(s),revision:0,expires:s.expires});
  // Expired rooms are not accessible. Bounded cleanup avoids retaining old notes indefinitely on active sites.
  const old=await db.select({code:rooms.code}).from(rooms).where(lt(rooms.expires,Date.now())).limit(10);for(const r of old)await db.delete(rooms).where(eq(rooms.code,r.code));
  return respond({room:c,...view(s,uid)},200,cookie);
 }
 const c=code(a.room);if(a.type==='join')a.name=name(a.name);
 for(let attempt=0;attempt<4;attempt++){
  const row=await db.select().from(rooms).where(eq(rooms.code,c)).get();if(!row)throw new GameError('部屋が見つかりません。',404);
  const s=transition(JSON.parse(row.state),uid,a);const result=await db.update(rooms).set({state:JSON.stringify(s),revision:row.revision+1}).where(and(eq(rooms.code,c),eq(rooms.revision,row.revision))).returning({code:rooms.code});
  if(result.length)return respond({room:c,...view(s,uid)},200,cookie);
 }
 throw new GameError('仲間の操作と重なりました。もう一度お試しください。',409);
 }catch(e){return handle(e)}}
