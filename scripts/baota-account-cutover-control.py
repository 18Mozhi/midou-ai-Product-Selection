"""Bounded BaoTa writer control for the no-backup ScoutOps release."""

import argparse
import json
import pathlib
import runpy

import paramiko


def writer_control_source(action: str) -> str:
    if action not in {"inspect", "quiesce"}:
        raise ValueError("account_release_invalid_baota_action")
    return f"action={action!r}\n" + r'''
import json, os, socket, sys, time
from pathlib import Path

os.chdir('/www/server/panel')
sys.path[:0] = ['/www/server/panel', '/www/server/panel/class']
import public
from projectModel.nodejsModel import main as NodeModel
from projectModel.pythonModel import main as PythonModel

root = Path('/www/wwwroot/ai选品')
if root.is_symlink() or root.resolve(strict=True) != root or not root.is_dir():
    raise RuntimeError('account_release_invalid_project_root')

projects = {'node': ('ai选品', 'Node', 'backend'), 'python': ('ai选品-python', 'Python', 'python')}
site = public.M('sites').where('id=?', (29,)).find()
frontend = root / 'frontend'
if (not isinstance(site, dict) or site.get('name') != 'midouai.medouai.com'
        or site.get('project_type') not in {'PHP', 'HTML'} or site.get('path') != str(frontend)
        or frontend.is_symlink() or frontend.resolve(strict=True) != frontend or not frontend.is_dir()):
    raise RuntimeError('account_release_invalid_site_identity')
for name, kind, folder in projects.values():
    row = public.M('sites').where('name=?', (name,)).find()
    child = root / folder
    if (not isinstance(row, dict) or row.get('project_type') != kind or row.get('path') != str(child)
            or child.is_symlink() or child.resolve(strict=True) != child or not child.is_dir()):
        raise RuntimeError('account_release_invalid_writer_identity')

backup_task_status = {}
for task_id in (5, 12):
    row = public.M('crontab').where('id=?', (task_id,)).find()
    if not isinstance(row, dict) or str(row.get('status')) not in {'0', '1'}:
        raise RuntimeError('account_release_backup_task_status_unknown')
    backup_task_status[str(task_id)] = int(row['status'])

def observe():
    counts = {'node': 0, 'python': 0}
    node_markers = (b'apps/backend/dist/server.js', b'apps/api/dist/server.js', b'apps/worker/dist/index.js')
    for proc in Path('/proc').iterdir():
        if not proc.name.isdecimal():
            continue
        try:
            command = (proc / 'cmdline').read_bytes().split(b'\0')
            if len(command) < 2 or not command[0]:
                continue
            cwd = Path(os.readlink(str(proc / 'cwd')))
        except (FileNotFoundError, ProcessLookupError):
            continue
        except PermissionError:
            raise RuntimeError('account_release_process_inventory_incomplete') from None
        args = command[1:]
        belongs = cwd == root or root in cwd.parents or any(str(root).encode() + b'/' in arg for arg in args)
        if not belongs:
            continue
        if any(any(arg == marker or arg.endswith(b'/' + marker) for marker in node_markers) for arg in args):
            counts['node'] += 1
        if any(arg == b'scoutops_crawler' or arg.endswith(b'/scoutops_crawler/__main__.py') for arg in args):
            counts['python'] += 1
    with socket.socket() as sock:
        sock.settimeout(1)
        node_listener = sock.connect_ex(('127.0.0.1', 4101)) == 0
    return {'writers': counts, 'node_listener': node_listener}

def stop(model, method, key):
    name = projects[key][0]
    request = public.dict_obj()
    request.project_name = name
    request.name = name
    response = getattr(model, method)(request)
    if not isinstance(response, dict) or not response.get('status'):
        messages = {str(response.get(field, '')) for field in ('msg', 'error_msg', 'data')} if isinstance(response, dict) else set()
        if not messages.intersection({'项目未启动', 'already stopped'}):
            raise RuntimeError('account_release_stop_' + key + '_failed')

methods = {
    'node_stop': callable(getattr(NodeModel, 'stop_project', None)),
    'python_stop': callable(getattr(PythonModel, 'StopProject', None)),
}
before = observe()
after = before
if action == 'quiesce':
    if any(backup_task_status.values()) or not all(methods.values()):
        raise RuntimeError('account_release_writer_shutdown_preflight_failed')
    stop(PythonModel(), 'StopProject', 'python')
    stop(NodeModel(), 'stop_project', 'node')
    deadline = time.monotonic() + 45
    after = observe()
    while any(after['writers'].values()) or after['node_listener']:
        if time.monotonic() >= deadline:
            raise RuntimeError('account_release_writers_still_active')
        time.sleep(1)
        after = observe()

print('SCOUTOPS_RESULT=' + json.dumps({'status': True, 'action': action, 'before': before, 'after': after,
    'backup_tasks': backup_task_status, 'panel_methods': methods}, sort_keys=True))
'''


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect the fixed ScoutOps BaoTa writer boundary over SSH")
    parser.add_argument("--inspect", action="store_true", required=True)
    parser.parse_args()
    deploy = runpy.run_path(str(pathlib.Path(__file__).with_name("deploy-baota.py")))
    with paramiko.SSHClient() as client:
        client.load_host_keys(str(pathlib.Path.home() / ".ssh" / "known_hosts"))
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(deploy["HOST"], port=22, username=deploy["SSH_USER"],
                       password=deploy["read_windows_credential"](), allow_agent=False,
                       look_for_keys=False, timeout=12)
        print(json.dumps(deploy["remote_python"](client, writer_control_source("inspect"), timeout=25)))


if __name__ == "__main__":
    main()
