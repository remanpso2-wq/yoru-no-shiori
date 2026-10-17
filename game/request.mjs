import {GameError} from './engine.mjs';
// Enforce a byte limit while reading, rather than buffering an unbounded body.
export async function readAction(request){
 const reader=request.body?.getReader();if(!reader)throw new GameError('送信内容がありません。');
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new GameError('送信内容が長すぎます。',413)}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
 let action;try{action=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new GameError('送信形式が不正です。')}
 if(!action||typeof action!=='object'||Array.isArray(action))throw new GameError('送信内容が不正です。');return action;
}
