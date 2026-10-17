import getpass,json,concurrent.futures,urllib.request,urllib.error,http.cookiejar
class Session:
 def __init__(self):
  self.headers={};self.cookies=http.cookiejar.CookieJar()
 def req(self,url,p=None):
  headers=dict(self.headers)
  if p is not None: headers["Content-Type"]="application/json"
  q=urllib.request.Request(url,data=None if p is None else json.dumps(p).encode(),headers=headers)
  try:r=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies)).open(q,timeout=30)
  except urllib.error.HTTPError as e:r=e
  text=r.read().decode()
  class R:
   status_code=r.status
   def json(self):return json.loads(text)
  out=R();out.text=text;return out
 def get(self,url,**kw):return self.req(url)
 def post(self,url,json,**kw):return self.req(url,json)
v=json.loads(getpass.getpass('Service configuration (hidden): '));base=v['url'].rstrip('/')
def client():
 s=Session();s.headers.update({'OAI-Sites-Authorization':'Bearer '+v['token'],'Origin':base});return s
a,b,c=client(),client(),client()
def get(s,path):
 r=s.get(base+path,timeout=30);assert r.status_code==200,('GET',r.status_code,r.text[:200]);return r.json()
def post(s,p,status=200):
 r=s.post(base+'/api/game',json=p,timeout=30);assert r.status_code==status,(p['type'],r.status_code,r.text[:200]);return r.json()
assert len(get(a,'/api/game')['cases'])==5
print('catalog: passed',flush=True)
room=post(a,{'type':'create','caseId':'letter','name':'検証A','solo':False})['room']
post(b,{'type':'join','name':'検証B','room':room})
post(a,{'type':'start','room':room})
print('create / join / start: passed',flush=True)
va=get(a,'/api/game?room='+room);vb=get(b,'/api/game?room='+room)
assert va['clues'][0]['text'] and va['clues'][1]['text'] is None
assert vb['clues'][0]['text'] is None and vb['clues'][1]['text']
post(b,{'type':'answer','answer':'mio','room':room},403)
post(c,{'type':'join','name':'検証C','room':room},409)
with concurrent.futures.ThreadPoolExecutor() as ex:
 tasks=[ex.submit(post,s,{'type':'share','index':i,'room':room}) for s,i in [(a,0),(b,1)]]
 for t in tasks:t.result()
va=get(a,'/api/game?room='+room);assert sorted(va['shared'])==[0,1]
print('authorization / parallel sharing: passed',flush=True)
post(b,{'type':'note','text':'APIによる協力操作検証','room':room})
result=post(a,{'type':'answer','answer':'mio','room':room});assert result['phase']=='solved' and result['score']==100
assert get(b,'/api/game?room='+room)['phase']=='solved'
d=client();d.cookies=a.cookies;assert get(d,'/api/game?room='+room)['phase']=='solved'
post(a,{'type':'note','text':'終了後','room':room},409)
bad=client();bad.headers['Origin']='https://example.invalid';post(bad,{'type':'create','caseId':'letter','name':'bad'},403)
print(json.dumps({'catalog':'passed','create_join_start':'passed','private_evidence':'passed','host_authorization':'passed','late_join_rejection':'passed','concurrent_shares':'passed','notes':'passed','answer_and_sync':'passed','cookie_reconnect':'passed','ended_mutation_rejection':'passed','cross_origin_rejection':'passed'},ensure_ascii=False))

# Advanced case: host transfer, evidence validation, and idempotent hint retry.
x,y=client(),client()
r=post(x,{'type':'create','caseId':'parcel','name':'応用A','solo':False})['room']
post(y,{'type':'join','name':'応用B','room':r})
post(x,{'type':'start','room':r})
post(x,{'type':'share','index':0,'room':r})
post(x,{'type':'transfer','target':1,'room':r})
post(x,{'type':'answer','answer':'b','evidence':[0,1],'room':r},403)
print('host transfer: passed',flush=True)
request_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
first=post(y,{'type':'hint','requestId':request_id,'room':r})
again=post(y,{'type':'hint','requestId':request_id,'room':r})
assert len(first['hints'])==len(again['hints'])==1
wrong=post(y,{'type':'answer','answer':'b','evidence':[0,3],'room':r})
assert wrong['phase']=='playing' and wrong['solutionEvidence']==[]
final=post(y,{'type':'answer','answer':'b','evidence':[0,1],'room':r})
assert final['phase']=='solved' and final['score']==65 and final['solutionEvidence']==[0,1]
print('advanced evidence / duplicate hint / scoring: passed',flush=True)
