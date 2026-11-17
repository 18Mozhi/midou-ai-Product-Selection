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


def run_panel(action, *, active_backup=False, valid_site=True, installed_sha=None, scope_flag=True,
              legacy_code=404, legacy_error='route_not_found', session_code=200,
              live_worker=False, live_listener=False):
    root = '/www/wwwroot/ai选品'
    calls = []
    running = {'node': action != 'activate', 'python': action != 'activate'}
    if action == 'stop_failed_runtime':
        running['python'] = False
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
            marker = b'apps/worker/dist/index.js' if live_worker else b'apps/backend/dist/server.js'
            return (b'/bin/node\0' + marker + b'\0' if self.parent.name == '1'
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

    class HTTPConnection:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ('127.0.0.1', 4101, 2)

        def request(self, method, path, headers):
            assert method == 'GET' and headers == {'Accept': 'application/json'}
            self.path = path
            calls.append(path.rsplit('/', 1)[-1])

        def getresponse(self):
            code = 200
            if self.path.endswith('/session-status'):
                code = session_code
                body = {'data': {'authenticated': False, 'account_rehearsal': scope_flag}}
            elif '/org/' in self.path:
                code = legacy_code
                body = {'error': {'code': legacy_error}}
            else:
                body = {'data': {'build_sha': build, 'status': 'ready'}}
            return types.SimpleNamespace(status=code, read=lambda limit: json.dumps(body).encode()[:limit])

        def close(self):
            pass

    @contextlib.contextmanager
    def socket():
        yield types.SimpleNamespace(settimeout=lambda _: None, connect_ex=lambda _: 0 if
                                    running['node'] and (action != 'stop_failed_runtime' or live_listener) else 111)

    modules = {
        'pathlib': types.SimpleNamespace(Path=Path),
        'public': types.SimpleNamespace(
            M=lambda table: types.SimpleNamespace(where=lambda _, k: types.SimpleNamespace(find=lambda: rows.get((table, k[0])))),
            dict_obj=types.SimpleNamespace,
        ),
        'socket': types.SimpleNamespace(socket=socket),
        'projectModel.nodejsModel': types.SimpleNamespace(main=Node),
        'projectModel.pythonModel': types.SimpleNamespace(main=Crawler),
        'http.client': types.SimpleNamespace(HTTPConnection=HTTPConnection, HTTPException=OSError),
    }
    output = io.StringIO()
    with patch.dict(sys.modules, modules), patch.object(sys, 'path', sys.path.copy()), \
            patch.object(os, 'chdir'), patch.object(os, 'readlink', return_value=root + '/backend'), \
            contextlib.redirect_stdout(output):
        try:
            sha = build if action in {'activate', 'stop_failed_runtime'} else None
            exec(compile(CONTROL['writer_control_source'](action, sha), '<test-panel>', 'exec'),
                 {'verify_final_drain': lambda: None})
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
        self.assertEqual(result['after'], {'writers': {'node': 0, 'python': 0}, 'node_listener': False,
                                          'worker_processes': 0})

    def test_failed_retired_runtime_stop_cannot_interrupt_live_listener_or_worker(self):
        for options in ({'live_listener': True}, {'live_worker': True}, {'active_backup': True}):
            self.assertEqual(run_panel('stop_failed_runtime', **options),
                             ([], 'account_release_failed_runtime_stop_not_safe'))
        self.assertEqual(run_panel('stop_failed_runtime', installed_sha='b' * 40),
                         ([], 'account_release_installed_identity_mismatch'))
        calls, result = run_panel('stop_failed_runtime')
        self.assertEqual(calls, ['ai选品'])
        self.assertEqual(result['after']['writers'], {'node': 0, 'python': 0})

    def test_activation_binds_installed_version_and_starts_python_after_node_is_ready(self):
        self.assertEqual(run_panel('activate', installed_sha='b' * 40), ([], 'account_release_installed_identity_mismatch'))
        calls, result = run_panel('activate')
        self.assertEqual(calls, ['ai选品', 'version', 'ready', 'session-status', 'memberships', 'summary', 'ai选品-python'])
        self.assertIs(result['account_routes_verified'], True)
        self.assertEqual(result['after']['writers'], {'node': 1, 'python': 1})

    def test_healthy_runtime_without_positive_scope_proof_does_not_start_python(self):
        for options in ({'scope_flag': False}, {'scope_flag': 1}, {'session_code': 302}):
            with self.subTest(options=options):
                calls, result = run_panel('activate', **options)
                self.assertEqual(calls, ['ai选品', 'version', 'ready', 'session-status'])
                self.assertEqual(result, 'account_release_node_scope_unverified')

    def test_healthy_account_runtime_with_live_legacy_route_does_not_start_python(self):
        for options in ({'legacy_code': 401}, {'legacy_code': 200}, {'legacy_error': 'not_found'}):
            with self.subTest(options=options):
                calls, result = run_panel('activate', **options)
                self.assertEqual(calls, ['ai选品', 'version', 'ready', 'session-status', 'memberships'])
                self.assertEqual(result, 'account_release_legacy_route_still_registered')


if __name__ == '__main__':
    unittest.main()
