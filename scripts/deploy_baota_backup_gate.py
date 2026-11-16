"""Render the pre-stop rollback archive gate for the fixed BaoTa project."""

import json


ARCHIVE_ROLLBACKS = r'''
import errno, json, re, subprocess, tempfile
from pathlib import Path

def archive_rollbacks(root, initialize):
    if root.resolve() != root or not root.is_dir():
        raise RuntimeError("rollback archive root identity mismatch")
    pattern = re.compile(r"\.deploy-rollback-([0-9a-f]{40})")
    candidates = sorted(p for p in root.iterdir() if pattern.fullmatch(p.name))
    backups = root / "backups"
    if initialize and not candidates and not backups.exists() and not backups.is_symlink():
        return {"archived": 0, "cross_device": 0}
    if backups.resolve() != backups or not backups.is_dir():
        raise RuntimeError("fixed backups directory is unavailable")

    def unescape_mount(path):
        return Path(re.sub(r"\\([0-7]{3})", lambda m: chr(int(m[1], 8)), path))

    mounts = [unescape_mount(row.split()[4])
              for row in Path("/proc/self/mountinfo").read_text().splitlines()]
    pairs = []
    for source in candidates:
        if (source.resolve() != source or not source.is_dir()
                or any(m == source or source in m.parents for m in mounts)):
            raise RuntimeError("stale rollback is not an unmounted project directory")
        destination = backups / ("deploy-rollback-" + pattern.fullmatch(source.name).group(1))
        if destination.exists() or destination.is_symlink():
            raise RuntimeError("rollback archive destination already exists: " + destination.name)
        pairs.append((source, destination))

    def sync(source, target, *options):
        result = subprocess.run(
            ["/usr/bin/rsync", "-aHAX", "--numeric-ids", "--one-file-system", *options,
             str(source) + "/", str(target) + "/"],
            check=True, capture_output=True, timeout=90,
        )
        if result.stdout or result.stderr:
            raise RuntimeError("rollback archive copy or readback differs")

    def verify(source, target):
        sync(source, target, "--checksum", "--dry-run", "--delete", "--itemize-changes")

    cross_device = 0
    for source, destination in pairs:
        try:
            source.rename(destination)
            continue
        except OSError as exc:
            if exc.errno != errno.EXDEV:
                raise
        holding_root = root / "runtime" / "tmp"
        if (holding_root.resolve() != holding_root or not holding_root.is_dir()
                or holding_root.stat().st_dev != source.stat().st_dev):
            raise RuntimeError("no same-filesystem location for retained rollback original")
        with tempfile.TemporaryDirectory(prefix=".deploy-archive-copy-", dir=backups) as folder:
            staged = Path(folder) / destination.name
            sync(source, staged)
            verify(source, staged)
            staged.rename(destination)
            verify(source, destination)
        # Keep the original intact, including metadata and symlinks. Never delete
        # a historical rollback merely to let a release continue.
        holding = Path(tempfile.mkdtemp(prefix="deploy-archive-source-", dir=holding_root))
        try:
            source.rename(holding / source.name)
        except OSError:
            holding.rmdir()
            raise
        cross_device += 1
    return {"archived": len(pairs), "cross_device": cross_device}
'''


def backup_preflight_source(root: str, owner: str, initialize: bool) -> str:
    values = json.dumps(dict(root=root, owner=owner, initialize=initialize), ensure_ascii=False)
    return ARCHIVE_ROLLBACKS + f'''
v = json.loads({values!r})
root = Path(v["root"])
lock = root / "config" / "deployment.lock"
if str(root) != "/www/wwwroot/ai选品" or lock.resolve() != lock or lock.read_text() != v["owner"]:
    raise RuntimeError("rollback archive lock identity mismatch")
result = archive_rollbacks(root, v["initialize"])
print("SCOUTOPS_RESULT=" + json.dumps({{"status": True, **result}}))
'''
