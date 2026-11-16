"""Verify the incoming no-backup candidate and stage only its immutable payload."""

import hashlib
import io
import os
import pathlib
import re
import shutil
import stat

ROOT = pathlib.Path("/www/wwwroot/ai选品")
ARCHIVE_MAX = 128 * 1024 * 1024


def stage_verified_account_runtime(upload, build_sha, plan_sha, archive_sha, verify_archive):
    if (not re.fullmatch(r"[a-f0-9]{40}", build_sha or "") or
            not all(re.fullmatch(r"[a-f0-9]{64}", value or "") for value in (plan_sha, archive_sha))):
        raise RuntimeError("account_stage_invalid_release_identity")
    parent = ROOT / "config"
    expected_upload = parent / ("account-upload-" + build_sha + ".tar.gz")
    stage = parent / ("account-release-" + build_sha)
    if (upload != expected_upload or parent.resolve(strict=True) != parent or not parent.is_dir() or
            ROOT.resolve(strict=True) != ROOT):
        raise RuntimeError("account_stage_invalid_upload_path")
    if any(path.stat().st_uid != os.geteuid() or stat.S_IMODE(path.stat().st_mode) & 0o022
           for path in (ROOT, parent)):
        raise RuntimeError("account_stage_untrusted_parent")

    # Freeze a bounded compressed stream before parsing. A path replacement or
    # concurrent file modification cannot swap bytes after this checksum check.
    fd = os.open(str(upload), os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as stream:
        identity = os.fstat(stream.fileno())
        if (not stat.S_ISREG(identity.st_mode) or identity.st_uid != os.geteuid() or
                stat.S_IMODE(identity.st_mode) != 0o600 or identity.st_nlink != 1 or
                not 0 < identity.st_size <= ARCHIVE_MAX):
            raise RuntimeError("account_stage_unsafe_upload_file")
        data = stream.read(ARCHIVE_MAX + 1)
    if len(data) != identity.st_size or hashlib.sha256(data).hexdigest() != archive_sha:
        raise RuntimeError("account_stage_archive_digest_mismatch")

    stage.mkdir(mode=0o700)
    created = stage.stat()
    try:
        if stage.resolve(strict=True) != stage or stat.S_IMODE(created.st_mode) != 0o700:
            raise RuntimeError("account_stage_not_private")

        def write_member(name, content):
            target = stage.joinpath(*name.split("/"))
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as file:
                file.write(content)
            target.chmod(0o600 if name in {"release.env", "manifest.json"} else 0o644)

        result = verify_archive(None, build_sha, plan_sha, fileobj=io.BytesIO(data), visit=write_member)
        # Future live directories must be readable/searchable independently of
        # the private parent and of the root shell's inherited umask.
        for folder in stage.rglob("*"):
            if folder.is_dir():
                folder.chmod(0o755)
        return stage, result
    except BaseException:
        current = stage.lstat()
        if not stage.is_symlink() and current.st_dev == created.st_dev and current.st_ino == created.st_ino:
            shutil.rmtree(stage)
        raise
