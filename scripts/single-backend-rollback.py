"""Generate a bounded BaoTa panel operation; no independent runtime service."""
import json
import inspect


def exchange_pairs(pairs, scratch):
    scratch.mkdir(mode=0o700)
    completed = []
    try:
        for index, (live, old) in enumerate(pairs):
            temp = scratch / str(index)
            live.rename(temp)
            try:
                old.rename(live)
            except BaseException:
                temp.rename(live)
                raise
            try:
                temp.rename(old)
            except BaseException:
                live.rename(old)
                temp.rename(live)
                raise
            completed.append((live, old))
    except BaseException:
        for index, (live, old) in enumerate(reversed(completed)):
            temp = scratch / ("undo-" + str(index))
            live.rename(temp)
            old.rename(live)
            temp.rename(old)
        raise
    finally:
        if not list(scratch.iterdir()):
            scratch.rmdir()


def exchange_source(root, build_sha, expected_sha):
    values = json.dumps(dict(root=root, build=build_sha, expected=expected_sha), ensure_ascii=False)
    source = '''import json, os, sys, time
from pathlib import Path
os.chdir('/www/server/panel')
sys.path[:0]=['/www/server/panel','/www/server/panel/class']
import public
from projectModel.nodejsModel import main as NodeModel
from projectModel.pythonModel import main as PythonModel
v=json.loads(PAYLOAD)
root=Path(v['root'])
if str(root)!='/www/wwwroot/ai选品' or root.is_symlink() or not root.is_dir(): raise RuntimeError('rollback_root_invalid')
backup=root/('.deploy-rollback-'+v['build'])
scratch=root/'runtime'/'tmp'/('single-backend-exchange-'+v['build'])
if scratch.exists(): raise RuntimeError('rollback_exchange_requires_recovery')
for name,typ,folder in [('ai选品','Node','backend'),('ai选品-python','Python','python')]:
 row=public.M('sites').where('name=?',(name,)).find()
 if not row or row.get('project_type')!=typ or row.get('path')!=str(root/folder): raise RuntimeError('rollback_project_identity_invalid')
release=root/'config'/'release.env'
def sha(path):
 return next((x.partition('=')[2].strip() for x in path.read_text().splitlines() if x.startswith('BUILD_SHA=')),None)
if sha(release)!=v['expected'] or not backup.is_dir() or backup.is_symlink(): raise RuntimeError('rollback_release_identity_invalid')
pairs=[(root/n,backup/n) for n in ('frontend','backend','python')]+[(release,backup/'release.env')]
for live,old in pairs:
 for p in (live,old):
  if not p.exists() or p.is_symlink() or root not in p.resolve().parents: raise RuntimeError('rollback_path_invalid')
node=NodeModel();python=PythonModel()
def action(model,method,name):
 req=public.dict_obj();req.project_name=name;req.name=name
 r=getattr(model,method)(req)
 if not isinstance(r,dict) or not r.get('status'):
  text=json.dumps(r,ensure_ascii=False)
  allowed=('项目未启动','already stopped') if method in ('StopProject','stop_project') else ('项目已启动','already started')
  if not any(message in text for message in allowed): raise RuntimeError('rollback_panel_action_failed')
action(python,'StopProject','ai选品-python')
action(node,'stop_project','ai选品')
deadline=time.time()+45
while True:
 active=[]
 for p in Path('/proc').iterdir():
  if not p.name.isdigit(): continue
  try: cmd=(p/'cmdline').read_bytes()
  except (FileNotFoundError,PermissionError,ProcessLookupError): continue
  if str(root).encode() in cmd and (b'apps/backend/dist/server.js' in cmd or b'scoutops_crawler' in cmd or b'apps/api/dist/server.js' in cmd or b'apps/worker/dist/index.js' in cmd): active.append(p.name)
 if not active: break
 if time.time()>deadline: raise RuntimeError('rollback_processes_still_running')
 time.sleep(1)
exchange_pairs(pairs,scratch)
print('SCOUTOPS_RESULT='+json.dumps({'status':True,'message':'single backend packages exchanged','build_sha':sha(release)}))
'''.replace('PAYLOAD', repr(values))
    start = source.index("action(python,'StopProject'")
    end = source.index("print('SCOUTOPS_RESULT='")
    body = source[start:end]
    restart = """finally:
 errors=[]
 for model,method,name in [(node,'start_project','ai选品'),(python,'StartProject','ai选品-python')]:
  try: action(model,method,name)
  except BaseException as error: errors.append(str(error))
 if errors: raise RuntimeError('rollback_restart_failed')
"""
    return inspect.getsource(exchange_pairs) + "\n" + source[:start] + "try:\n" + "\n".join(" " + line for line in body.splitlines()) + "\n" + restart + source[end:]
