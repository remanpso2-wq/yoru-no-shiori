import test from 'node:test';import assert from 'node:assert/strict';import {readAction} from '../game/request.mjs';
const request=body=>new Request('https://game.example/api/game',{method:'POST',body});
test('valid JSON action including Japanese is decoded',async()=>assert.deepEqual(await readAction(request('{"type":"note","text":"推理"}')),{type:'note',text:'推理'}));
test('invalid JSON, array and scalar actions are rejected',async()=>{for(const b of ['{','[]','null','"hello"','42'])await assert.rejects(()=>readAction(request(b)))});
test('missing body is rejected',async()=>await assert.rejects(()=>readAction(new Request('https://game.example'))));
test('UTF-8 byte limit is enforced, not character count',async()=>await assert.rejects(()=>readAction(request(JSON.stringify({text:'あ'.repeat(1500)}))),e=>e.status===413));
test('stream is cancelled once limit is exceeded',async()=>{let cancelled=false;const r=new ReadableStream({pull(c){c.enqueue(new Uint8Array(4097))},cancel(){cancelled=true}});await assert.rejects(()=>readAction({body:r}),e=>e.status===413);assert.equal(cancelled,true)});
