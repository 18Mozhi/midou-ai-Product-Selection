import contextlib
import io
import json
import os
import pathlib
import runpy
import sys
import types
import unittest
from unittest.mock import patch


CONTROL = runpy.run_path(str(pathlib.Path(__file__).parents[2] / "scripts/baota-account-cutover-control.py"))


def run_panel(action, *, active_backup=False, valid_site=True, installed_sha=None):
    root = '/www/wwwroot/ai选品'
    calls = []
    running = {'node': action != 'activate', 'python': action != 'activate'}
    build = 'a' * 40
    rows = {
        ('sites', 29): dict(name='midouai.medouai.com', project_type='PHP', path=root + ('/frontend' if valid_site else '/wrong')),
        ('sites', 'ai选品'): dict(project_type='Node', path=root + '/backend'),
        ('sites', 'ai选品-python'): dict(project_type='Python', path=root + '/python'),
        ('crontab', 5): dict(status=0),
        ('crontab', 12): dict(status=int(active_backup)),
    }

    class Path(pathlib.PurePosixPath):
        def is_symlink(self):
            return False

        def is_dir(self):
            return True

        def is_file(self):
            return True

        def read_text(self, encoding):
            return f'BUILD_SHA={installed_sha or build}\nACCOUNT_SCOPE_MODE=retired\nRELEASE_SOURCE_MIGRATION_VERSION=0197_retire_tenancy_roots.up.sql\n'

        def resolve(self, strict):
            return self

        def iterdir(self):
            return [Path('/proc/' + pid) for pid, mode in [('1', 'node'), ('2', 'python')] if running[mode]]

        def read_bytes(self):
            return (b'/bin/node\0apps/backend/dist/server.js\0' if self.parent.name == '1'
                    else b'/bin/python\0-m\0scoutops_crawler\0')

    def stop(mode, request):
        calls.append(request.project_name)
        running[mode] = False
        if mode == 'node':
            return {'status': False, 'error_msg': '项目未启动'}
        return {'status': True}

    class Node:
        def stop_project(self, request):
            return stop('node', request)

        def start_project(self, request):
            calls.append(request.project_name)
            running['node'] = True
            return {'status': True}

    class Crawler:
        def StopProject(self, request):
            return stop('python', request)

        def StartProject(self, request):
            calls.append(request.project_name)
            running['python'] = True
            return {'status': True}

    @contextlib.contextmanager
    def http(url, timeout):
        calls.append(url.rsplit('/', 1)[-1])
        yield io.StringIO(json.dumps({'data': {'build_sha': build, 'status': 'ready'}}))

    @contextlib.contextmanager
    def socket():
        yield types.SimpleNamespace(settimeout=lambda _: None, connect_ex=lambda _: 0 if running['node'] else 111)

    modules = {
        'pathlib': types.SimpleNamespace(Path=Path),
        'public': types.SimpleNamespace(
            M=lambda table: types.SimpleNamespace(where=lambda _, k: types.SimpleNamespace(find=lambda: rows.get((table, k[0])))),
            dict_obj=types.SimpleNamespace,
        ),
        'socket': types.SimpleNamespace(socket=socket),
        'projectModel.nodejsModel': types.SimpleNamespace(main=Node),
        'projectModel.pythonModel': types.SimpleNamespace(main=Crawler),
        'urllib.request': types.SimpleNamespace(urlopen=http),
    }
    output = io.StringIO()
    with patch.dict(sys.modules, modules), patch.object(sys, 'path', sys.path.copy()), \
            patch.object(os, 'chdir'), patch.object(os, 'readlink', return_value=root + '/backend'), \
            contextlib.redirect_stdout(output):
        try:
            sha = build if action == 'activate' else None
            exec(compile(CONTROL['writer_control_source'](action, sha), '<test-panel>', 'exec'), {})
        except RuntimeError as error:
            return calls, str(error)
    return calls, json.loads(output.getvalue().removeprefix('SCOUTOPS_RESULT='))


class PanelControlTest(unittest.TestCase):
    def test_inspect_observes_without_action(self):
        calls, result = run_panel('inspect', active_backup=True)
        self.assertEqual(calls, [])
        self.assertEqual(result['backup_tasks'], {'5': 0, '12': 1})
        self.assertEqual(result['before']['writers'], {'node': 1, 'python': 1})

    def test_quiesce_checks_target_and_backup_before_action(self):
        self.assertEqual(run_panel('quiesce', valid_site=False), ([], 'account_release_invalid_site_identity'))
        self.assertEqual(run_panel('quiesce', active_backup=True), ([], 'account_release_writer_shutdown_preflight_failed'))

    def test_quiesce_requires_both_writers_and_listener_to_be_down(self):
        calls, result = run_panel('quiesce')
        self.assertEqual(calls, ['ai选品-python', 'ai选品'])
        self.assertEqual(result['after'], {'writers': {'node': 0, 'python': 0}, 'node_listener': False})

    def test_activation_binds_installed_version_and_starts_python_after_node_is_ready(self):
        self.assertEqual(run_panel('activate', installed_sha='b' * 40), ([], 'account_release_installed_identity_mismatch'))
        calls, result = run_panel('activate')
        self.assertEqual(calls, ['ai选品', 'version', 'ready', 'ai选品-python'])
        self.assertEqual(result['after']['writers'], {'node': 1, 'python': 1})


if __name__ == '__main__':
    unittest.main()
