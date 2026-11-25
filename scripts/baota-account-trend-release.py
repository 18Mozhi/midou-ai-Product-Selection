"""Publish a bounded Worker module overlay through the account release coordinator."""
import base64
import hashlib
import re
import subprocess
import zlib
from pathlib import Path

TARGET = "backend/apps/worker/dist/trend-projection-account-queue.js"
SOURCE = "apps/worker/src/trend-projection-account-queue.ts"
SCHEDULER_FILES = ("queue-scheduler.js", "worker-queue-registry.js")
SCHEDULER_MARKERS = (b"this.nextPollAt", b"pollStaggerSlot")
PRE_STAGGER_SHA256 = {
    "queue-scheduler.js": "189741ab72172b40773d501bfa24c13be157fc751b2f127ca9de007980b8562d",
    "worker-queue-registry.js": "81a51e4891a38f0d040fe44ba64a393f16f467244e16921b4b16d98759178785",
}
STAGGER_RELEASE_SHA = "53e3ee64a65dd4aeaf7f83c2142cc6a7a901f54e"
REPORT_TARGET = "backend/apps/worker/dist/report-export-worker.js"
REPORT_SOURCE = "apps/worker/src/report-export-worker.ts"
REPORT_RUNTIME_BASE = "1b622274a6871d9d1ac3986223359b539a82aa76"
REPORT_SOURCE_BASE = "df30fd5b272fe1a495f9623635df8fd475b2d3c0"
REPORT_OLD = "a376c666b9566b2466c6b741dddd4d74e7c74a8c6c7ed949caa4a04eb9e5d3b6"
REPORT_NEW = "bd7c4f53af7b092776923084d6a551fb49e2e87fcf737a7d58debd42f6ef42f1"
REPORT_PROTECTED = {
    **PRE_STAGGER_SHA256,
    "trend-projection-account-queue.js": "5d46cfb0a50aac48b7c5893d64fa7ce3dc6a4ecc4d3c14694653d12dd0f0cbea",
}
AMAZON_SOURCE_BASE = "3a7b2dd0433e4e3b9bb602f3d5d60001540c83df"
AMAZON_DIR = "backend/apps/api/dist"
AMAZON_BASE_HASHES = {
    "amazon-public-browser-health.js": "5ed95d9c8f2f2e30971cb18efb1e9f6d8c4c00138a082f83a4168f0bf43446ca",
    "amazon-public-recovery.js": "5965405fb97cc177b6df2ee7c8bce6fa1bd7ae9873982eda07e4ba1a3e1313fa",
    "bootstrap/create-provider-adapter-runtime.js": "aa13d5591cd0b36894be95e863fd1302fd99756d7f2c992ba52b960ced7c5006",
    "crawler-runtime-service.js": "910295ac8493df30ee52a21c1ab5ed41a85c659f75fff3ec9aaae6a0966838f0",
    "mysql-crawler-runtime-repository.js": "39134e949194e07874ade1972dfe58230a39948069be63afe736c9044b1ddcb7",
    "pending-source-recovery-policy.js": "13c39242228fe1b140f66c52b539465fa2519ef246ed757229df7d539d0da4aa",
}
AMAZON_AUDIT_SOURCE_BASE = "9a9cb91cf2c30d662c74ab8bbace42fb7dd807b1"
AMAZON_AUDIT_MODULE = "crawler-scheduler-repository.js"
AMAZON_AUDIT_BASE = {AMAZON_AUDIT_MODULE: "af5a234c3f4100c30e9e241c0d277d0013eae810860dd6a061cbaab34f1ed4d8"}
AMAZON_INSTALLED = {
    "amazon-public-browser-health.js": "c86f7b72c16ec20b8d454004906bdcbc4c0c11574ff1cafd5f3ce7f5c74989f1",
    "amazon-public-recovery.js": "4d27d9ace276c75024eb2d3b3467a9cf2f2bedaa6e36ced00f6345747a6d613b",
    "bootstrap/create-provider-adapter-runtime.js": "eeafaf4ab4ee17ef86d5fc696cbcea0040edf98f076f5fa903f60b457af7e934",
    "crawler-runtime-service.js": "2bed639ee4fba8b43de26039341271a142d41a1f6ce14ce68d09f0abca627e20",
    "mysql-crawler-runtime-repository.js": "6fa5c6ce9b931ec0e60d1d7b72902c15e603d39064163ac073eb8804d0370e12",
    "pending-source-recovery-policy.js": "a7f611afa0b7284a3cce385fc515435bb974ba7381d748b99a02fc06d13d8762",
}
COLLECTION_SOURCE_BASE = "ed1b21ce60642ea52d103be7dd9cd18acb5a4c7f"
COLLECTION_BASE = {
    "apps/worker/dist/automatic-source-scheduler.js": "3ea9f8f2381c073e2402b4a26db8696c9287b48108976f4383a878dbc30da802",
    "apps/worker/dist/collection-task-state-machine.js": "1f64059b4c4baa5a5a823e3b8f1b3274b072aec97a4e05ff94d486c6a65edf72",
    "packages/provider-sources/dist/lan-1688-health-adapter.js": "0a5e81e502a1d46fe983c08b347acd3e9b848fad159758408041d9d5233eeda6",
    "packages/provider-sources/dist/lan-1688-image-search.js": "47b1cd820456e6cf5468a21f8998a031dba8333aa928975e81d7e3884e093750",
}
COLLECTION_CANDIDATE = dict(zip(COLLECTION_BASE, (
    "478d1abf0c4a7d796063a69570772167fddba22f1a49fcc6dec46884fa1e7f2b",
    "259dfb16a3ff87a60fdcbffc3e236e6cb6c571a024b64bd4123b058ba4defb3f",
    "ac86d6707cba01d6b059cf20264a5574591649a86b750a277840ce1d369b4c32",
    "8219222c7e4dcc0f398efdc712fd254711cadeee3936085741483313f7e9604f",
)))
COLLECTION_EXECUTOR = "apps/worker/dist/provider-source-executor.js"
COLLECTION_EXECUTOR_BASE = "afc757df47e827503d9150fb07a1ec6756519a3295009cd36e9cb186fc6ec04a"
COLLECTION_EXECUTOR_CANDIDATE = "9b539a3f68ad77017bba88b1bed479482ad2dad21d8ffd66507ba569abdcae45"
COLLECTION_EXECUTOR_LOCK_CANDIDATE = "b6ace579381bc29adef6f61af65bb162067d9a3716fe072d5a67c92e777fa4c8"
COLLECTION_EXECUTOR_CLOCK_SHA = "09595c3be89ec5f90b5ddb6593f1921360ad996f"
COLLECTION_BROWSER = "apps/worker/dist/authenticated-browser-job-client.js"
COLLECTION_BROWSER_BASE = "203e391fe9cd23ac76040d4cc20ea059ea5754150b54448363852301dfb6a316"
COLLECTION_BROWSER_CANDIDATE = "2f08a7c1029f9705d5f1114a54c1080a687331968c2ab54ed43108bb9200af0e"
COLLECTION_EVIDENCE = "apps/worker/dist/evidence-persistence.js"
COLLECTION_EVIDENCE_BASE = {
    COLLECTION_EVIDENCE: "74a5ddcc60f1952415734c6bd0a9e51f8018f2fd9cfa56c6c7a8a80c6cdf3818",
    "packages/data-quality/dist/index.js": "3b2317602bd0d03bcb885dad945912e5bb0f4b5780398adf9c5e240ca169f71a",
}
COLLECTION_EVIDENCE_CANDIDATE = dict(zip(COLLECTION_EVIDENCE_BASE, (
    "64030326ff5108a52a9aab3111fdcdab1b432889d9c94d1af50a28c0a33259bb",
    "f3573a98927f2d1b183a7eede6085538abdd14492a82723e405c6799bb2f8461",
)))
COLLECTION_RANK_STATE = "apps/worker/dist/collection-task-state-machine.js"
COLLECTION_RANK_SOURCE_BASE = "681f91521961b3700e7d7f2f3d131755e8c9f04c"
COLLECTION_RANK_BASE = {
    COLLECTION_RANK_STATE: COLLECTION_CANDIDATE[COLLECTION_RANK_STATE],
    "apps/worker/dist/collection-source-scheduling-policy.js": "a31c26c6e638f21b91628ceb9f6daba6d8992be56b01c2afd0ee6d6844c10d27",
}
COLLECTION_RANK_CANDIDATE = dict(zip(COLLECTION_RANK_BASE, (
    "f8d6cd8ea70109c72f16d19d3d737b1ce2d24c0b51f2cae2f236d0148bd43671",
    "1bbb56c686fc360e31daa4b7b631d34d0896910a9dbc654cfdab3622ae7b70d4",
)))
COLLECTION_MODEL_HOLD_SOURCE = "debf38ba40b20a34de219ecc8afcf00782ffe5f9"
COLLECTION_MODEL_HOLD_BASE = {COLLECTION_RANK_STATE: COLLECTION_RANK_CANDIDATE[COLLECTION_RANK_STATE]}
COLLECTION_MODEL_HOLD_CANDIDATE = {
    COLLECTION_RANK_STATE: "36f63c33c699cdd9e05a87ae254acb81966d6ca37133811a8bb8854530ca5f21",
}
COLLECTION_DETAIL = "packages/playwright-crawler/dist/index.js"
COLLECTION_DETAIL_BASE = "d43c8e490d995fb130128eaccf3512c43189fd71486fcd8add5ebae67fb445f0"
COLLECTION_DETAIL_CANDIDATE = "9219b8c880abc628012bc3b452ee885234b87162e0113bfad9d8a48eaad236a7"
COLLECTION_DETAIL_CANONICAL = "b9fbe24085ea376a2015a51d3e2679bfa81a964dd8a6862facd1bee793568fa6"
COLLECTION_DAILY_CONTEXT = "packages/playwright-crawler/dist/amazon-delivery-context.js"
COLLECTION_DAILY_SOURCE = "d327ca26f95e1c27b72d9cbac7f82110c269461a"
COLLECTION_DAILY_BASE = {
    COLLECTION_DETAIL: COLLECTION_DETAIL_CANONICAL,
    COLLECTION_DAILY_CONTEXT: "2e5de903f0308d5ac1aabc669153b5326a68ac5b286ed770f52736cd6a349f45",
}
COLLECTION_DAILY_CANDIDATE = {
    COLLECTION_DETAIL: "91b73eeaa02d07a2c432ad12c368f27d5b12fb762c4be419ab681019f552b9b5",
    COLLECTION_DAILY_CONTEXT: "23265e1942bda82342bade4fdff972b1dbe2988e7d7a4510a6c6e5ffdf8ef589",
}
COLLECTION_HANDOFF_REPO = "apps/api/dist/mysql-crawler-runtime-repository.js"
COLLECTION_HANDOFF_SOURCE = "aa51db05c714ec2a259f5086cb3a57d5ef5b0646"
COLLECTION_HANDOFF_BASE = {
    COLLECTION_DETAIL: COLLECTION_DAILY_CANDIDATE[COLLECTION_DETAIL],
    COLLECTION_HANDOFF_REPO: AMAZON_INSTALLED["mysql-crawler-runtime-repository.js"],
}
COLLECTION_HANDOFF_CANDIDATE = {
    'packages/playwright-crawler/dist/index.js': 'e86b64d50126d8de9fef3d3fd8fd8291364f07b42220717e3ec0a21bed234021',
    'apps/api/dist/mysql-crawler-runtime-repository.js': 'd21ed7dccb7b8b989359473f280530b5f644e431ffec259b8d9aae12a3dc78aa',
}
COLLECTION_HANDOFF_ROUTES_SOURCE = "c93b3092ee89aea92ee36f8cd10347abf87540e4"
COLLECTION_HANDOFF_ROUTES_BASE = {
    "apps/api/dist/server.js": "72e782221213123247a0684ad8e1f24702812470b3a6efcbf4f7e904e4ee1b21",
    "apps/api/dist/crawler-runtime-routes.js": "e2275dbbac4827616685dd4659ddb967cdde2f395a1f050fb2ad30a6a5e5ceb0",
}
COLLECTION_HANDOFF_ROUTES_CANDIDATE = {
    'apps/api/dist/server.js': 'a98d79d8c5922c1c23af68bab21a8b588e1e038d8b6329a575a7edaef5f9e66d',
    'apps/api/dist/crawler-runtime-routes.js': '902553233a11c388d85050566fed58c685ff4cc80e108ddbc0e91f7cdbc73054',
}
COLLECTION_MANUAL_WAF_SOURCE = "7bf5f06d2c394a5c9727f397d35b62829c6a8984"
COLLECTION_MANUAL_WAF_BASE = {
    'packages/playwright-crawler/dist/index.js': 'e86b64d50126d8de9fef3d3fd8fd8291364f07b42220717e3ec0a21bed234021',
    'packages/playwright-crawler/dist/authenticated-proxy.js': '5ad0498a85d2ba932636da0cbba87aee0c41928afba64e50fa77110199777cd4',
    'packages/playwright-crawler/dist/manual-handoff.js': '758640bc943457870a9116e340340baf92cb1c83af6c85369eb53811ac0bde86',
}
COLLECTION_MANUAL_WAF_CANDIDATE = {
    'packages/playwright-crawler/dist/index.js': '3be18b422d6f177d2d56757fc8fa4ddf19a6e56a6fdb4014e1db71e0341c0c27',
    'packages/playwright-crawler/dist/authenticated-proxy.js': 'e37c2a452a1112f8290dff56a7ef8935413683d215692e5b6f7d80922cfa44b9',
    'packages/playwright-crawler/dist/manual-handoff.js': 'ffa26b08d94045aa795b48d03d769fc49186386e9bb3c5553e68dbc39bbedccf',
}
COLLECTION_DELIVERY_OBSERVE_SOURCE = "1c74971058439357ad7f3106cdacb0abdcc5da9b"
COLLECTION_DELIVERY_OBSERVE_BASE = {COLLECTION_DETAIL: COLLECTION_MANUAL_WAF_CANDIDATE[COLLECTION_DETAIL]}
COLLECTION_DELIVERY_OBSERVE_CANDIDATE = {COLLECTION_DETAIL: "d38ec9a4da12da0b67b0b415e09e577d335dc849e31b2a2ba8224c7550747581"}
COLLECTION_SEARCH_READY_SOURCE = "80ed59fcedcd1413926aa9523df49737319dfa80"
COLLECTION_SEARCH_READY_BASE = {COLLECTION_DETAIL: "8e767cf4154af10817a438e306b1c3fe2085810620e9ff05ed863a22498badd6"}
COLLECTION_SEARCH_READY_CANDIDATE = {COLLECTION_DETAIL: "2f1f7ae410b88b78dd766a24f26cec9ff8484dacf71be2dcf1510f73b27fd43e"}
COLLECTION_DELIVERY_READY_SOURCE = "67eed207c337b197c56fb5163e4bfb3500a28863"
COLLECTION_DELIVERY_READY_BASE = {COLLECTION_DAILY_CONTEXT: "47ca6d42231640ae6a070d30389584b7b5fa2b1a7ffe154e9ed4ac4834a4785d"}
COLLECTION_DELIVERY_READY_CANDIDATE = {COLLECTION_DAILY_CONTEXT: "94a06bae3395056e8a438cc9cee2f380c759f72ffe5b9bcdefa48a969a7fd306"}
COLLECTION_DETAIL_DIAG_SOURCE = "b4ee048b514ad2a13314a14136f903b5762e5d9f"
COLLECTION_LAN_CLIENT = "packages/provider-sources/dist/lan-1688-image-search.js"
COLLECTION_LAN_HEALTH = "packages/provider-sources/dist/lan-1688-health-adapter.js"
COLLECTION_LAN_BASE = {
    COLLECTION_EXECUTOR: COLLECTION_EXECUTOR_LOCK_CANDIDATE,
    COLLECTION_LAN_CLIENT: COLLECTION_CANDIDATE[COLLECTION_LAN_CLIENT],
}
COLLECTION_LAN_CANDIDATE = {
    COLLECTION_EXECUTOR: "efa7c806c70c334383b7d241401824a054555d95c40bfae98d2f60ef2a70e19a",
    COLLECTION_LAN_CLIENT: "8652e8041e3e90c21d94ebed32bd4a019096256e0fcbd26ab17b19c99b3966be",
}
COLLECTION_LAN_HEALTH_SOURCE = "617c461c3a0bcfd10e9db9a07edcc18a74026fcd"
COLLECTION_LAN_HEALTH_BASE = {
    COLLECTION_LAN_CLIENT: COLLECTION_LAN_CANDIDATE[COLLECTION_LAN_CLIENT],
    COLLECTION_LAN_HEALTH: COLLECTION_CANDIDATE[COLLECTION_LAN_HEALTH],
}
COLLECTION_LAN_HEALTH_CANDIDATE = {
    COLLECTION_LAN_CLIENT: "8c71099413a9d7702adf7fdceaadcb3b64f70d62312be8dd06a2d65c1a12f082",
    COLLECTION_LAN_HEALTH: "1b1aca9b5cc5cc9bc313fafc409f1f9c0246300be5ef506546191374615e171e",
}
COLLECTION_LAN_SOURCE = {
    COLLECTION_EXECUTOR: "1a85c9eb613387b48294e358d0b1b43f1118a28c",
    COLLECTION_LAN_CLIENT: COLLECTION_RANK_SOURCE_BASE,
}
RESTART = "/www/server/panel/script/restart_project.py"
MODULE_PHASE = "not_installed"


def report_hashes(action):
    if action == "apply":
        return REPORT_OLD, REPORT_NEW
    if action == "restore":
        return REPORT_NEW, REPORT_OLD
    raise RuntimeError("trend_report_action_invalid")


def prepare_report(target, expected, encoded, digest, read_file, action):
    before, after = report_hashes(action)
    if (expected, digest) != (before, after):
        raise RuntimeError("trend_report_hash_pair_invalid")
    if hashlib.sha256(read_file(target, 65536)).hexdigest() != before:
        raise RuntimeError("trend_report_baseline_changed")
    data = base64.b64decode(encoded, validate=True)
    if not 0 < len(data) < 65536 or hashlib.sha256(data).hexdigest() != after:
        raise RuntimeError("trend_report_payload_invalid")
    protected = {target.with_name(name): read_file(target.with_name(name), 65536)
                 for name in REPORT_PROTECTED}
    if any(hashlib.sha256(value).hexdigest() != REPORT_PROTECTED[path.name]
           for path, value in protected.items()):
        raise RuntimeError("trend_report_protected_module_changed")
    return {target: (data, before, after)}, protected


def prepare_modules(target, expected_module, encoded, digest, scheduler, read_file, rollback=False):
    if rollback and scheduler is None:
        raise RuntimeError("trend_scheduler_manifest_invalid")
    old = read_file(target, 65536)
    if hashlib.sha256(old).hexdigest() != expected_module:
        raise RuntimeError("trend_module_baseline_changed")
    protected = {}
    if scheduler is None:
        entries = [(target, expected_module, encoded, digest, b"SELECT STRAIGHT_JOIN seed.task_id")]
    else:
        if tuple(scheduler) != SCHEDULER_FILES:
            raise RuntimeError("trend_scheduler_manifest_invalid")
        protected[target] = old
        entries = [
            (target.with_name(name), *scheduler[name], marker)
            for name, marker in zip(SCHEDULER_FILES, SCHEDULER_MARKERS)
        ]
    replacements = {}
    for path, before, payload, after, marker in entries:
        prior = old if path == target else read_file(path, 65536)
        if hashlib.sha256(prior).hexdigest() != before:
            raise RuntimeError("trend_module_baseline_changed")
        data = base64.b64decode(payload, validate=True)
        expected_payload = (
            after == PRE_STAGGER_SHA256.get(path.name) and marker not in data
            if rollback else marker in data
        )
        if (not 0 < len(data) < 65536 or hashlib.sha256(data).hexdigest() != after
                or not expected_payload or data == prior):
            raise RuntimeError("trend_candidate_invalid")
        replacements[path] = (data, before, after)
    return replacements, protected


def prepare_amazon(root, manifest, read_file, collection=None):
    python_transport = collection in ("python_transport", "python_transport_restore")
    audit = tuple(manifest) == tuple(AMAZON_AUDIT_BASE)
    frozen = AMAZON_AUDIT_BASE if audit else AMAZON_BASE_HASHES
    install_hashes = None
    if collection is not None:
        frozen, install_hashes = collection_hashes(collection)
    if tuple(manifest) != tuple(frozen):
        raise RuntimeError("trend_amazon_manifest_invalid")
    replacements = {}
    for name, (before, encoded, after) in manifest.items():
        if before != frozen[name] or not re.fullmatch(r"[a-f0-9]{64}", after):
            raise RuntimeError("trend_amazon_manifest_invalid")
        if install_hashes is not None and after != install_hashes[name]:
            raise RuntimeError("trend_collection_payload_hash_changed")
        path = root / ("python" if python_transport else "backend" if collection is not None else AMAZON_DIR) / name
        if hashlib.sha256(read_file(path, 131072)).hexdigest() != before:
            raise RuntimeError("trend_amazon_baseline_changed")
        data = zlib.decompress(base64.b64decode(encoded, validate=True))
        if before == after or not 0 < len(data) <= 131072 or hashlib.sha256(data).hexdigest() != after:
            raise RuntimeError("trend_amazon_payload_invalid")
        replacements[path] = (data, before, after)
    worker_dir = (root / REPORT_TARGET).parent
    protect_hashes = {**REPORT_PROTECTED, Path(REPORT_TARGET).name: REPORT_NEW}
    protected = {worker_dir / key: read_file(worker_dir / key, 65536) for key in protect_hashes}
    if any(hashlib.sha256(value).hexdigest() != protect_hashes[path.name] for path, value in protected.items()):
        raise RuntimeError("trend_amazon_protected_module_changed")
    if audit or collection is not None:
        api_hashes = dict(AMAZON_INSTALLED)
        if collection is not None:
            api_hashes[AMAZON_AUDIT_MODULE] = "425611f474a67f26a7a3138a456def5652fa77872099337a89535dbb6fb40e33"
        if collection in ("handoff_routes", "handoff_routes_restore", "manual_waf", "manual_waf_restore", "delivery_observe", "delivery_observe_restore", "delivery_ready", "delivery_ready_restore", "search_ready", "search_ready_restore", "relation_key", "relation_key_restore", "python_transport", "python_transport_restore", "sponsored_empty", "sponsored_empty_restore", "checkpoint", "checkpoint_restore"):
            api_hashes["mysql-crawler-runtime-repository.js"] = COLLECTION_HANDOFF_CANDIDATE[COLLECTION_HANDOFF_REPO]
        for name, digest in api_hashes.items():
            path = root / AMAZON_DIR / name
            if path in replacements:
                continue  # A pinned replacement cannot also be an unchanged protected file.
            data = read_file(path, 131072)
            if hashlib.sha256(data).hexdigest() != digest:
                raise RuntimeError("trend_amazon_protected_module_changed")
            protected[path] = data
    if collection not in (None, "apply", "restore"):
        prerequisites = dict(COLLECTION_CANDIDATE)
        if collection in ("browser", "browser_restore"):
            prerequisites[COLLECTION_EXECUTOR] = COLLECTION_EXECUTOR_CANDIDATE
        if collection in ("executor_lock", "executor_lock_restore"):
            prerequisites[COLLECTION_BROWSER] = COLLECTION_BROWSER_CANDIDATE
        if collection in ("evidence", "evidence_restore"):
            prerequisites[COLLECTION_BROWSER] = COLLECTION_BROWSER_CANDIDATE
            prerequisites[COLLECTION_EXECUTOR] = COLLECTION_EXECUTOR_LOCK_CANDIDATE
        if collection in ("rank", "rank_restore"):
            prerequisites.pop(COLLECTION_RANK_STATE)
            prerequisites[COLLECTION_EXECUTOR] = COLLECTION_EXECUTOR_LOCK_CANDIDATE
            prerequisites[COLLECTION_BROWSER] = COLLECTION_BROWSER_CANDIDATE
            prerequisites.update(COLLECTION_EVIDENCE_CANDIDATE)
        if collection in ("detail", "detail_restore", "detail_canonical", "detail_canonical_restore"):
            prerequisites.update(COLLECTION_RANK_CANDIDATE)
            prerequisites.update(COLLECTION_EVIDENCE_CANDIDATE)
            prerequisites[COLLECTION_BROWSER] = COLLECTION_BROWSER_CANDIDATE
            for name in COLLECTION_LAN_HEALTH_BASE:
                prerequisites.pop(name)
            lan_modules = {name: read_file(root / "backend" / name, 131072) for name in
                           {*COLLECTION_LAN_HEALTH_BASE, COLLECTION_EXECUTOR}}
            if {name: hashlib.sha256(data).hexdigest() for name, data in lan_modules.items()} not in (
                    {**COLLECTION_LAN_BASE, COLLECTION_LAN_HEALTH: COLLECTION_CANDIDATE[COLLECTION_LAN_HEALTH]},
                    {**COLLECTION_LAN_CANDIDATE, **COLLECTION_LAN_HEALTH_BASE},
                    {**COLLECTION_LAN_CANDIDATE, **COLLECTION_LAN_HEALTH_CANDIDATE}):
                raise RuntimeError("trend_collection_prerequisite_changed")
            protected.update({root / "backend" / name: data for name, data in lan_modules.items()})
        if collection in ("lan_rate", "lan_rate_restore", "lan_health", "lan_health_restore"):
            prerequisites.update(COLLECTION_RANK_CANDIDATE)
            prerequisites.update(COLLECTION_EVIDENCE_CANDIDATE)
            prerequisites[COLLECTION_BROWSER] = COLLECTION_BROWSER_CANDIDATE
            path = root / "backend" / COLLECTION_DETAIL
            engine = read_file(path, 131072)
            if hashlib.sha256(engine).hexdigest() not in (COLLECTION_DETAIL_CANDIDATE, COLLECTION_DETAIL_CANONICAL):
                raise RuntimeError("trend_collection_prerequisite_changed")
            protected[path] = engine
            prerequisites.pop(COLLECTION_LAN_CLIENT)
            if collection in ("lan_health", "lan_health_restore"):
                prerequisites.pop(COLLECTION_LAN_HEALTH)
                prerequisites[COLLECTION_EXECUTOR] = COLLECTION_LAN_CANDIDATE[COLLECTION_EXECUTOR]
        if collection in ("model_hold", "model_hold_restore"):
            prerequisites.update(COLLECTION_RANK_CANDIDATE)
            prerequisites.update(COLLECTION_EVIDENCE_CANDIDATE)
            prerequisites.update(COLLECTION_LAN_HEALTH_CANDIDATE)
            prerequisites.pop(COLLECTION_RANK_STATE)
            prerequisites[COLLECTION_BROWSER] = COLLECTION_BROWSER_CANDIDATE
            prerequisites[COLLECTION_EXECUTOR] = COLLECTION_LAN_CANDIDATE[COLLECTION_EXECUTOR]
            prerequisites[COLLECTION_DETAIL] = COLLECTION_DETAIL_CANONICAL
        if collection in ("delivery_daily", "delivery_daily_restore", "handoff", "handoff_restore", "handoff_routes", "handoff_routes_restore", "manual_waf", "manual_waf_restore", "delivery_observe", "delivery_observe_restore", "delivery_ready", "delivery_ready_restore", "search_ready", "search_ready_restore", "relation_key", "relation_key_restore", "python_transport", "python_transport_restore", "sponsored_empty", "sponsored_empty_restore", "checkpoint", "checkpoint_restore"):
            prerequisites.update(COLLECTION_RANK_CANDIDATE)
            prerequisites.update(COLLECTION_EVIDENCE_CANDIDATE)
            prerequisites.update(COLLECTION_LAN_HEALTH_CANDIDATE)
            prerequisites.update(COLLECTION_MODEL_HOLD_CANDIDATE)
            prerequisites[COLLECTION_BROWSER] = COLLECTION_BROWSER_CANDIDATE
            prerequisites[COLLECTION_EXECUTOR] = COLLECTION_LAN_CANDIDATE[COLLECTION_EXECUTOR]
        if collection in ("handoff", "handoff_restore", "handoff_routes", "handoff_routes_restore", "manual_waf", "manual_waf_restore", "delivery_observe", "delivery_observe_restore", "delivery_ready", "delivery_ready_restore", "search_ready", "search_ready_restore", "relation_key", "relation_key_restore", "python_transport", "python_transport_restore", "sponsored_empty", "sponsored_empty_restore", "checkpoint", "checkpoint_restore"):
            prerequisites[COLLECTION_DAILY_CONTEXT] = COLLECTION_DAILY_CANDIDATE[COLLECTION_DAILY_CONTEXT]
        if collection in ("handoff_routes", "handoff_routes_restore"):
            prerequisites.update(COLLECTION_HANDOFF_CANDIDATE)
        if collection in ("manual_waf", "manual_waf_restore"):
            prerequisites[COLLECTION_HANDOFF_REPO] = COLLECTION_HANDOFF_CANDIDATE[COLLECTION_HANDOFF_REPO]
            prerequisites.update(COLLECTION_HANDOFF_ROUTES_CANDIDATE)
        if collection in ("delivery_observe", "delivery_observe_restore"):
            prerequisites[COLLECTION_HANDOFF_REPO] = COLLECTION_HANDOFF_CANDIDATE[COLLECTION_HANDOFF_REPO]
            prerequisites.update(COLLECTION_HANDOFF_ROUTES_CANDIDATE)
            prerequisites.update({n: h for n, h in COLLECTION_MANUAL_WAF_CANDIDATE.items() if n != COLLECTION_DETAIL})
        if collection in ("delivery_ready", "delivery_ready_restore"):
            prerequisites.pop(COLLECTION_DAILY_CONTEXT, None)
            prerequisites[COLLECTION_HANDOFF_REPO] = COLLECTION_HANDOFF_CANDIDATE[COLLECTION_HANDOFF_REPO]
            prerequisites.update(COLLECTION_HANDOFF_ROUTES_CANDIDATE)
            prerequisites.update(COLLECTION_MANUAL_WAF_CANDIDATE)
            prerequisites.update(COLLECTION_DELIVERY_OBSERVE_CANDIDATE)
            prerequisites.update(COLLECTION_SEARCH_READY_CANDIDATE)
        if collection in ("search_ready", "search_ready_restore"):
            prerequisites[COLLECTION_HANDOFF_REPO] = COLLECTION_HANDOFF_CANDIDATE[COLLECTION_HANDOFF_REPO]
            prerequisites.update(COLLECTION_HANDOFF_ROUTES_CANDIDATE)
            prerequisites.update({n: h for n, h in COLLECTION_MANUAL_WAF_CANDIDATE.items() if n != COLLECTION_DETAIL})
            prerequisites.update(COLLECTION_DELIVERY_READY_CANDIDATE)
        if collection in ("relation_key", "relation_key_restore", "python_transport", "python_transport_restore", "sponsored_empty", "sponsored_empty_restore", "checkpoint", "checkpoint_restore"):
            prerequisites[COLLECTION_HANDOFF_REPO] = COLLECTION_HANDOFF_CANDIDATE[COLLECTION_HANDOFF_REPO]
            prerequisites.update(COLLECTION_HANDOFF_ROUTES_CANDIDATE)
            prerequisites.update(COLLECTION_MANUAL_WAF_CANDIDATE)
            prerequisites.update(COLLECTION_DELIVERY_OBSERVE_CANDIDATE)
            prerequisites.update(COLLECTION_DELIVERY_READY_CANDIDATE)
            prerequisites.update(COLLECTION_SEARCH_READY_CANDIDATE)
        if python_transport:
            prerequisites.update(COLLECTION_RELATION_KEY_CANDIDATE)
            for name in ("main_loop.py", "runtime_client.py", "lease_client.py", "completion_receipts.py", "config.py"):
                path = root / "python/scoutops_crawler" / name
                protected[path] = read_file(path, 131072)
        if collection in ("sponsored_empty", "sponsored_empty_restore", "checkpoint", "checkpoint_restore"):
            prerequisites.update(COLLECTION_RELATION_KEY_CANDIDATE)
            path = root / "python" / COLLECTION_PYTHON_TRANSPORT
            data = read_file(path, 131072)
            if hashlib.sha256(data).hexdigest() != COLLECTION_PYTHON_TRANSPORT_CANDIDATE[COLLECTION_PYTHON_TRANSPORT]:
                raise RuntimeError("trend_collection_prerequisite_changed")
            protected[path] = data
        if collection in ("checkpoint", "checkpoint_restore"):
            prerequisites.update(COLLECTION_SPONSORED_EMPTY_CANDIDATE)
        for name, digest in prerequisites.items():
            path = root / "backend" / name
            if path in replacements:
                continue
            data = read_file(path, 131072)
            if hashlib.sha256(data).hexdigest() != digest:
                raise RuntimeError("trend_collection_prerequisite_changed")
            protected[path] = data
    return replacements, protected


COLLECTION_RELATION_KEY = "packages/database/dist/selection-completion-policy.js"
COLLECTION_RELATION_KEY_SOURCE = "944d0c7d503d16ba44950207202f3e4e2a03d651"
COLLECTION_RELATION_KEY_BASE = {COLLECTION_RELATION_KEY: "91c303c724e6b2acfc92370c8cd1ab9edf797e8566e7439292085ef8ab823a87"}
COLLECTION_RELATION_KEY_CANDIDATE = {COLLECTION_RELATION_KEY: "4319719331111246d1c3bc29853d78e711768b52d1b8c2c47a1b7bc2143cfd48"}


COLLECTION_PYTHON_TRANSPORT = "scoutops_crawler/runtime_transport.py"
COLLECTION_PYTHON_TRANSPORT_SOURCE = "a62ef7b95c19d40f58ecee1f117f6df9744a589d"
COLLECTION_PYTHON_TRANSPORT_BASE = {COLLECTION_PYTHON_TRANSPORT: "8b229dcb7477ca4fca69a68bd8f0f12d6a597798486e9dd5a53e0901ddd6d7b5"}
COLLECTION_PYTHON_TRANSPORT_CANDIDATE = {COLLECTION_PYTHON_TRANSPORT: "396d2e9cd3fa944fb8f469998bd00598c5861e0bb64d7f68a3b5905335a4cad0"}


COLLECTION_SPONSORED_EMPTY = "packages/provider-sources/dist/amazon-browser-contract.js"
COLLECTION_SPONSORED_EMPTY_SOURCE = "bab6cad4418e1910d030dc5cbf78abbdef253bda"
COLLECTION_SPONSORED_EMPTY_BASE = {
    COLLECTION_SPONSORED_EMPTY: "fb13c6635537fe69e6a4a30e07396a71f6b47c657a70c8855f89d69e7aca79e0",
    COLLECTION_DETAIL: "2f1f7ae410b88b78dd766a24f26cec9ff8484dacf71be2dcf1510f73b27fd43e",
}
COLLECTION_SPONSORED_EMPTY_CANDIDATE = {
    COLLECTION_SPONSORED_EMPTY: "7f408dc06ebb737acbb4328d95f24e8cd78aea1af4229aa820ab27ecf7c49074",
    COLLECTION_DETAIL: "d206cdd51447eaee72db5e279de770bb4f39dc1b7f4838067ed14498640d6b4b",
}


COLLECTION_CHECKPOINT_SOURCE = "8df4389996d0ad16c3ff478ddcc2d0eb64295eef"
COLLECTION_CHECKPOINT_BASE = {COLLECTION_DETAIL: "d206cdd51447eaee72db5e279de770bb4f39dc1b7f4838067ed14498640d6b4b"}
COLLECTION_CHECKPOINT_CANDIDATE = {COLLECTION_DETAIL: "906716a733d1ff03dcc497a22a49b3aa337e91c55923abe66b4c7c461c58e7e2"}


def collection_hashes(action):
    if action == "checkpoint":
        return COLLECTION_CHECKPOINT_BASE, COLLECTION_CHECKPOINT_CANDIDATE
    if action == "checkpoint_restore":
        return COLLECTION_CHECKPOINT_CANDIDATE, COLLECTION_CHECKPOINT_BASE
    if action == "sponsored_empty":
        return COLLECTION_SPONSORED_EMPTY_BASE, COLLECTION_SPONSORED_EMPTY_CANDIDATE
    if action == "sponsored_empty_restore":
        return COLLECTION_SPONSORED_EMPTY_CANDIDATE, COLLECTION_SPONSORED_EMPTY_BASE
    if action == "python_transport":
        return COLLECTION_PYTHON_TRANSPORT_BASE, COLLECTION_PYTHON_TRANSPORT_CANDIDATE
    if action == "python_transport_restore":
        return COLLECTION_PYTHON_TRANSPORT_CANDIDATE, COLLECTION_PYTHON_TRANSPORT_BASE
    if action == "relation_key":
        return COLLECTION_RELATION_KEY_BASE, COLLECTION_RELATION_KEY_CANDIDATE
    if action == "relation_key_restore":
        return COLLECTION_RELATION_KEY_CANDIDATE, COLLECTION_RELATION_KEY_BASE
    if action == "apply":
        return COLLECTION_BASE, COLLECTION_CANDIDATE
    if action == "restore":
        return COLLECTION_CANDIDATE, COLLECTION_BASE
    if action in ("executor", "executor_restore"):
        before, after = COLLECTION_EXECUTOR_BASE, COLLECTION_EXECUTOR_CANDIDATE
        if action == "executor_restore":
            before, after = after, before
        return {COLLECTION_EXECUTOR: before}, {COLLECTION_EXECUTOR: after}
    if action in ("browser", "browser_restore"):
        before, after = COLLECTION_BROWSER_BASE, COLLECTION_BROWSER_CANDIDATE
        if action == "browser_restore":
            before, after = after, before
        return {COLLECTION_BROWSER: before}, {COLLECTION_BROWSER: after}
    if action in ("executor_lock", "executor_lock_restore"):
        before, after = COLLECTION_EXECUTOR_CANDIDATE, COLLECTION_EXECUTOR_LOCK_CANDIDATE
        if action == "executor_lock_restore":
            before, after = after, before
        return {COLLECTION_EXECUTOR: before}, {COLLECTION_EXECUTOR: after}
    if action == "evidence":
        return COLLECTION_EVIDENCE_BASE, COLLECTION_EVIDENCE_CANDIDATE
    if action == "evidence_restore":
        return COLLECTION_EVIDENCE_CANDIDATE, COLLECTION_EVIDENCE_BASE
    if action == "rank":
        return COLLECTION_RANK_BASE, COLLECTION_RANK_CANDIDATE
    if action == "rank_restore":
        return COLLECTION_RANK_CANDIDATE, COLLECTION_RANK_BASE
    if action == "detail":
        return {COLLECTION_DETAIL: COLLECTION_DETAIL_BASE}, {COLLECTION_DETAIL: COLLECTION_DETAIL_CANDIDATE}
    if action == "detail_restore":
        return {COLLECTION_DETAIL: COLLECTION_DETAIL_CANDIDATE}, {COLLECTION_DETAIL: COLLECTION_DETAIL_BASE}
    if action == "detail_canonical":
        return {COLLECTION_DETAIL: COLLECTION_DETAIL_CANDIDATE}, {COLLECTION_DETAIL: COLLECTION_DETAIL_CANONICAL}
    if action == "detail_canonical_restore":
        return {COLLECTION_DETAIL: COLLECTION_DETAIL_CANONICAL}, {COLLECTION_DETAIL: COLLECTION_DETAIL_CANDIDATE}
    if action == "lan_rate":
        return COLLECTION_LAN_BASE, COLLECTION_LAN_CANDIDATE
    if action == "lan_rate_restore":
        return COLLECTION_LAN_CANDIDATE, COLLECTION_LAN_BASE
    if action == "lan_health":
        return COLLECTION_LAN_HEALTH_BASE, COLLECTION_LAN_HEALTH_CANDIDATE
    if action == "lan_health_restore":
        return COLLECTION_LAN_HEALTH_CANDIDATE, COLLECTION_LAN_HEALTH_BASE
    if action == "model_hold":
        return COLLECTION_MODEL_HOLD_BASE, COLLECTION_MODEL_HOLD_CANDIDATE
    if action == "model_hold_restore":
        return COLLECTION_MODEL_HOLD_CANDIDATE, COLLECTION_MODEL_HOLD_BASE
    if action == "delivery_daily":
        return COLLECTION_DAILY_BASE, COLLECTION_DAILY_CANDIDATE
    if action == "delivery_daily_restore":
        return COLLECTION_DAILY_CANDIDATE, COLLECTION_DAILY_BASE
    if action == "handoff":
        return COLLECTION_HANDOFF_BASE, COLLECTION_HANDOFF_CANDIDATE
    if action == "handoff_restore":
        return COLLECTION_HANDOFF_CANDIDATE, COLLECTION_HANDOFF_BASE
    if action == "handoff_routes":
        return COLLECTION_HANDOFF_ROUTES_BASE, COLLECTION_HANDOFF_ROUTES_CANDIDATE
    if action == "handoff_routes_restore":
        return COLLECTION_HANDOFF_ROUTES_CANDIDATE, COLLECTION_HANDOFF_ROUTES_BASE
    if action == "manual_waf":
        return COLLECTION_MANUAL_WAF_BASE, COLLECTION_MANUAL_WAF_CANDIDATE
    if action == "manual_waf_restore":
        return COLLECTION_MANUAL_WAF_CANDIDATE, COLLECTION_MANUAL_WAF_BASE
    if action == "delivery_observe":
        return COLLECTION_DELIVERY_OBSERVE_BASE, COLLECTION_DELIVERY_OBSERVE_CANDIDATE
    if action == "delivery_observe_restore":
        return COLLECTION_DELIVERY_OBSERVE_CANDIDATE, COLLECTION_DELIVERY_OBSERVE_BASE
    if action == "search_ready":
        return COLLECTION_SEARCH_READY_BASE, COLLECTION_SEARCH_READY_CANDIDATE
    if action == "search_ready_restore":
        return COLLECTION_SEARCH_READY_CANDIDATE, COLLECTION_SEARCH_READY_BASE
    if action == "delivery_ready":
        return COLLECTION_DELIVERY_READY_BASE, COLLECTION_DELIVERY_READY_CANDIDATE
    if action == "delivery_ready_restore":
        return COLLECTION_DELIVERY_READY_CANDIDATE, COLLECTION_DELIVERY_READY_BASE
    raise RuntimeError("trend_collection_manifest_invalid")


def install_with_claim_drain(install_fn, args, drain):
    try:
        drain.pause()
        drain.drain()
        drain.verify_final()
        return install_fn(*args)
    finally:
        drain.resume_owned()


def release_error_code(error):
    message = str(error)
    return (message if re.fullmatch(r"(?:trend|account_release)_[a-z_]+", message)
            else type(error).__name__)


def restart_identity_valid(before, after, python_transport=False):
    if not after.get("api") or not after.get("worker"):
        return False
    if python_transport:
        return (bool(after.get("python")) and after["python"] != before.get("python")
                and all(after[key] == before.get(key) for key in ("api", "worker")))
    return all(after[key] != before.get(key) for key in ("api", "worker"))


def install(root, expected_runtime, expected_module, build, encoded, digest, scheduler=None, rollback=False,
            report_action=None, amazon_modules=None, collection=None):
    root = Path(root)
    if root != Path("/www/wwwroot/ai选品"):
        raise RuntimeError("trend_project_mismatch")

    import fcntl
    import json
    import os
    import stat
    import sys
    import tempfile
    import time
    import urllib.request

    global MODULE_PHASE
    if report_action is not None and (expected_runtime != REPORT_RUNTIME_BASE or scheduler is not None or rollback):
        raise RuntimeError("trend_report_manifest_invalid")
    if amazon_modules is not None and (expected_runtime != REPORT_RUNTIME_BASE or scheduler is not None
                                       or rollback or report_action is not None):
        raise RuntimeError("trend_amazon_manifest_invalid")
    python_transport = collection in ("python_transport", "python_transport_restore")
    target = root / (REPORT_TARGET if report_action is not None else TARGET)
    for path in (root, root / "config", root / "runtime", root / "backend", target.parent):
        if not path.is_dir() or path.resolve(strict=True) != path:
            raise RuntimeError("trend_unsafe_directory")
    for path in (root, root / "config"):
        if path.stat().st_uid != os.geteuid() or path.stat().st_mode & 0o022:
            raise RuntimeError("trend_untrusted_root")
    lock = root / "config/account-release.lock"
    fd = os.open(lock, os.O_RDWR | os.O_NONBLOCK | os.O_NOFOLLOW)
    with os.fdopen(fd, "r+b") as handle:
        info = os.fstat(handle.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid()
                or info.st_mode & 0o077 or info.st_nlink != 1):
            raise RuntimeError("trend_unsafe_lock")
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        sys.path[:0] = ["/www/server/panel", "/www/server/panel/class"]
        import public

        node = public.M("sites").where("name=?", ("ai选品",)).find()
        python = public.M("sites").where("name=?", ("ai选品-python",)).find()
        site = public.M("sites").where("id=?", (29,)).find()
        if ((node.get("project_type"), node.get("path")) != ("Node", str(root / "backend"))
                or (python.get("project_type"), python.get("path")) != ("Python", str(root / "python"))
                or (site.get("name"), site.get("path")) != ("midouai.medouai.com", str(root / "frontend"))):
            raise RuntimeError("trend_wrong_baota_objects")
        for task_id in (5, 12):
            if str(public.M("crontab").where("id=?", (task_id,)).find().get("status")) != "0":
                raise RuntimeError("trend_backup_task_not_disabled")

        def read_file(path, limit):
            st = path.lstat()
            if (not stat.S_ISREG(st.st_mode) or not 0 < st.st_size <= limit
                    or st.st_nlink != 1 or path.resolve(strict=True) != path):
                raise RuntimeError("trend_unsafe_runtime_file")
            return path.read_bytes()

        state_file = root / "config/account-release-state.json"
        state = read_file(state_file, 65536)
        last = json.loads(state.splitlines()[-1])
        protected = {
            p: read_file(p, 262144) for p in (
                root / "config/product_scout.env", root / "config/release.env",
                root / "frontend/index.html", state_file,
            )
        }
        release = protected[root / "config/release.env"].decode().splitlines()
        if (last.get("phase") != "runtime_ready" or last.get("build_sha") != expected_runtime
                or not all(v in release for v in (
                    "BUILD_SHA=" + expected_runtime, "ACCOUNT_SCOPE_MODE=retired",
                    "RELEASE_SOURCE_MIGRATION_VERSION=0197_retire_tenancy_roots.up.sql",
                ))):
            raise RuntimeError("trend_base_runtime_changed")

        def get_health(base, ep):
            with urllib.request.urlopen(base + "/api/v1/health/" + ep, timeout=4) as reply:
                return json.load(reply)["data"]

        def ready(base):
            return (get_health(base, "version").get("build_sha") == expected_runtime
                    and get_health(base, "ready").get("status") == "ready"
                    and get_health(base, "available").get("services") ==
                    {"api": "available", "worker": "available"})

        def processes():
            snap = json.loads(read_file(root / "runtime/backend-supervisor.json", 262144))
            result = {
                key: snap["processes"][key].get("pid")
                for key in ("api", "worker")
                if snap["processes"][key].get("status") == "running"
            }
            for proc in Path("/proc").iterdir():
                if not proc.name.isdecimal():
                    continue
                try:
                    cwd = Path(os.readlink(str(proc / "cwd")))
                    args = (proc / "cmdline").read_bytes().split(b"\0")[1:]
                except (FileNotFoundError, ProcessLookupError):
                    continue
                if (cwd == root / "python" or root / "python" in cwd.parents) and (
                    b"scoutops_crawler" in args or any(x.endswith(b"/scoutops_crawler/__main__.py") for x in args)
                ):
                    result.setdefault("python", []).append(int(proc.name))
            result["python"] = sorted(result.get("python", []))
            return result

        if amazon_modules is not None:
            folders = [root / AMAZON_DIR, root / AMAZON_DIR / "bootstrap"]
            if collection is not None:
                folders += [(root / "backend" / n).parent for n in COLLECTION_BASE]
                folders += [(root / ("python" if python_transport else "backend") / n).parent for n in amazon_modules]
            for folder in folders:
                if not folder.is_dir() or folder.resolve(strict=True) != folder:
                    raise RuntimeError("trend_unsafe_directory")
            replacements, protected_modules = prepare_amazon(root, amazon_modules, read_file, collection)
        elif report_action is not None:
            replacements, protected_modules = prepare_report(
                target, expected_module, encoded, digest, read_file, report_action
            )
        else:
            replacements, protected_modules = prepare_modules(
                target, expected_module, encoded, digest, scheduler, read_file, rollback
            )
        protected.update(protected_modules)
        local = "http://127.0.0.1:4101"
        domain = "https://midouai.medouai.com"
        pids = processes()
        if (not pids.get("api") or not pids.get("worker") or not ready(local)
                or python_transport and not pids.get("python")):
            raise RuntimeError("trend_baseline_not_ready")
        staged, replaced = {}, []
        # Keep original bytes only in memory, to unwind a partial write before restart.
        originals = {path: read_file(path, 131072) for path in replacements} if amazon_modules is not None else {}
        try:
            for path, (incoming, _, _) in replacements.items():
                metadata = path.stat()
                fd, scratch = tempfile.mkstemp(prefix=".trend-release-", dir=str(path.parent))
                staged[path] = scratch
                with os.fdopen(fd, "wb") as stream:
                    stream.write(incoming)
                    stream.flush()
                    os.fchown(stream.fileno(), metadata.st_uid, metadata.st_gid)
                    os.fchmod(stream.fileno(), metadata.st_mode & 0o777)
                    os.fsync(stream.fileno())
            # Install the scheduler before the registry that opts in. Do not
            # restart on a partial install; either version accepts either input.
            for path, scratch in staged.items():
                os.replace(scratch, path)
                replaced.append(path)
                MODULE_PHASE = "installing"
            MODULE_PHASE = "installed"
        except Exception:
            for path in reversed(replaced) if amazon_modules is not None else ():
                metadata = path.stat()
                fd, scratch = tempfile.mkstemp(prefix=".trend-release-", dir=str(path.parent))
                staged[path] = scratch
                with os.fdopen(fd, "wb") as stream:
                    stream.write(originals[path])
                    stream.flush()
                    os.fchown(stream.fileno(), metadata.st_uid, metadata.st_gid)
                    os.fchmod(stream.fileno(), metadata.st_mode & 0o777)
                    os.fsync(stream.fileno())
                os.replace(scratch, path)
            if amazon_modules is not None:
                MODULE_PHASE = "not_installed"
            raise
        finally:
            for scratch in staged.values():
                if os.path.exists(scratch):
                    os.unlink(scratch)

        def modules_match():
            return all(read_file(path, 131072 if amazon_modules is not None else 65536) == item[0] for path, item in replacements.items())

        if not modules_match():
            raise RuntimeError("trend_module_readback_failed")

        restart = subprocess.run([sys.executable, RESTART, "python" if python_transport else "nodejs",
                                  "ai选品-python" if python_transport else "ai选品"],
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=95)
        if restart.returncode:
            raise RuntimeError("trend_baota_restart_failed")
        MODULE_PHASE = "python_restart_returned" if python_transport else "node_restart_returned"
        until = time.monotonic() + 75
        while time.monotonic() < until:
            try:
                after = processes()
                if (restart_identity_valid(pids, after, python_transport) and ready(local) and ready(domain)):
                    break
            except (OSError, KeyError, ValueError):
                pass
            time.sleep(2)
        else:
            raise RuntimeError("trend_python_not_ready_after_restart" if python_transport else "trend_node_not_ready_after_restart")
        if not python_transport and after["python"] != pids["python"]:
            raise RuntimeError("trend_unexpected_python_identity_change")
        if (not modules_match() or any(read_file(p, 262144) != b for p, b in protected.items())):
            raise RuntimeError("trend_unexpected_runtime_change")
        receipt = {"status": True, "overlay_sha": build, "runtime_base_sha": expected_runtime,
                   "restarted": "ai选品-python" if python_transport else "ai选品", "node_before": pids, "node_after": after}
        if amazon_modules is not None:
            receipt.update(modules={str(path.relative_to(root / ("python" if python_transport else "backend" if collection is not None else AMAZON_DIR))): {"previous": item[1], "installed": item[2]}
                                    for path, item in replacements.items()},
                           preserved_modules={p.name: hashlib.sha256(b).hexdigest() for p,b in protected_modules.items()})
        elif report_action is not None:
            receipt.update(report_action=report_action, module=target.name, module_sha256=digest,
                           previous_module_sha256=expected_module, preserved_modules=REPORT_PROTECTED)
        elif scheduler is None:
            receipt.update(module_sha256=digest, previous_module_sha256=expected_module)
        else:
            receipt.update(
                modules={path.name: {"previous": item[1], "installed": item[2]}
                         for path, item in replacements.items()},
                preserved_trend_sha256=expected_module, scheduler_rollback=rollback,
            )
        return receipt


def validate_changes(changed, scheduler=False, rollback=False):
    exact = {SOURCE, "scripts/baota-account-trend-release.py", "scripts/deploy-account-baota.py",
             "scripts/baota-account-static-release.py"}
    required = {SOURCE}
    if scheduler:
        required = {"apps/worker/src/" + name[:-3] + ".ts" for name in SCHEDULER_FILES}
        exact.update(required)
    if rollback:
        if not scheduler:
            raise RuntimeError("trend_scheduler_manifest_invalid")
        # Restored files may be identical to the base runtime. The caller
        # separately requires a change to both files relative to the stagger release.
        required = set()
    if not required.issubset(changed) or any(
        p not in exact and not p.startswith(("apps/web/src/", "docs/", "tests/")) for p in changed
    ):
        raise RuntimeError("trend_release_contains_other_runtime_changes")


def validate_report_changes(changed):
    exact = {REPORT_SOURCE, "scripts/baota-account-trend-release.py", "scripts/deploy-account-baota.py"}
    if REPORT_SOURCE not in changed or any(p not in exact and not p.startswith(("docs/", "tests/")) for p in changed):
        raise RuntimeError("trend_report_contains_other_runtime_changes")


def build_report_restore(repo):
    return subprocess.check_output(["node", "--input-type=module", "-e", r"""
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
const source=execFileSync('git',['show',process.argv[1]+':'+process.argv[2]],{encoding:'utf8'});
process.stdout.write(ts.transpileModule(source,{fileName:'report-export-worker.ts',
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText);
""", REPORT_RUNTIME_BASE, REPORT_SOURCE], cwd=repo)


def validate_amazon_changes(changed, audit=False):
    frozen = AMAZON_AUDIT_BASE if audit else AMAZON_BASE_HASHES
    modules = {"apps/api/src/" + name.removesuffix(".js") + ".ts" for name in frozen}
    exact = modules | {"scripts/baota-account-trend-release.py", "scripts/deploy-account-baota.py"}
    if not modules.issubset(changed) or any(p not in exact and not p.startswith(("docs/", "tests/")) for p in changed):
        raise RuntimeError("trend_amazon_contains_other_runtime_changes")


def collection_sources():
    return {n.replace("/dist/", "/src/").removesuffix(".js") + ".ts" for n in COLLECTION_BASE}


def validate_collection_changes(changed):
    source = collection_sources()
    web = {"apps/web/src/components/ProviderAdapterCenter.vue", "apps/web/src/source-1688-operator-action.ts"}
    followups = {n.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
                 for n in (COLLECTION_EXECUTOR, COLLECTION_BROWSER, COLLECTION_DETAIL, COLLECTION_DAILY_CONTEXT, COLLECTION_HANDOFF_REPO, *COLLECTION_HANDOFF_ROUTES_BASE, *COLLECTION_MANUAL_WAF_BASE, *COLLECTION_EVIDENCE_BASE, *COLLECTION_RANK_BASE)}
    exact = source | web | followups | {"packages/provider-sources/src/amazon-browser-contract.ts", "apps/crawler/tests/test_runtime_disconnect.py", "apps/crawler/scoutops_crawler/runtime_transport.py", "packages/database/src/selection-completion-policy.ts", "config/env.example", "scripts/deploy-account-baota.py", "scripts/baota-account-trend-release.py",
                            "scripts/baota-account-static-release.py"}
    if not (source | web).issubset(changed) or any(
        n not in exact and not n.startswith(("docs/", "tests/")) for n in changed
    ):
        raise RuntimeError("trend_collection_contains_other_runtime_changes")


def build_collection_restore(repo, name, source_sha=COLLECTION_SOURCE_BASE):
    if name == COLLECTION_PYTHON_TRANSPORT:
        return subprocess.check_output(["git", "show", source_sha + ":apps/crawler/" + name], cwd=repo)
    source = name.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
    return subprocess.check_output(["node", "--input-type=module", "-e", r"""
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
const file=process.argv[2];
const data=execFileSync('git',['show',process.argv[1]+':'+file],{encoding:'utf8'});
process.stdout.write(ts.transpileModule(data,{fileName:file.split('/').at(-1),compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText);
""", source_sha, source], cwd=repo)


def publish(repo, previous, expected_module, deploy, ssh_connection, scheduler_expected=None, rollback=False,
            report_action=None, amazon=False, amazon_audit=False, collection=None):
    if not re.fullmatch(r"[a-f0-9]{40}", previous or "") or not re.fullmatch(r"[a-f0-9]{64}", expected_module or ""):
        raise RuntimeError("trend_release_requires_expected_sha256_and_base_sha")
    if collection is not None:
        route, _ = collection_hashes(collection)
        key = (COLLECTION_DETAIL if collection in ("checkpoint", "checkpoint_restore") else
               COLLECTION_SPONSORED_EMPTY if collection in ("sponsored_empty", "sponsored_empty_restore") else
               COLLECTION_PYTHON_TRANSPORT if collection in ("python_transport", "python_transport_restore") else
               COLLECTION_RELATION_KEY if collection in ("relation_key", "relation_key_restore") else
               COLLECTION_DAILY_CONTEXT if collection in ("delivery_ready", "delivery_ready_restore") else
               "apps/api/dist/server.js" if collection in ("handoff_routes", "handoff_routes_restore") else
               COLLECTION_EXECUTOR if collection in ("executor", "executor_restore", "executor_lock", "executor_lock_restore") else
               COLLECTION_BROWSER if collection in ("browser", "browser_restore") else
               COLLECTION_EVIDENCE if collection in ("evidence", "evidence_restore") else
               COLLECTION_DETAIL if collection in ("detail", "detail_restore", "detail_canonical", "detail_canonical_restore", "delivery_daily", "delivery_daily_restore", "handoff", "handoff_restore", "manual_waf", "manual_waf_restore", "delivery_observe", "delivery_observe_restore", "delivery_ready", "delivery_ready_restore", "search_ready", "search_ready_restore") else
               COLLECTION_LAN_CLIENT if collection in ("lan_rate", "lan_rate_restore") else
               COLLECTION_LAN_HEALTH if collection in ("lan_health", "lan_health_restore") else
               "apps/worker/dist/collection-task-state-machine.js")
        if (previous != REPORT_RUNTIME_BASE or expected_module != route[key]
                or amazon or amazon_audit or scheduler_expected is not None or rollback or report_action is not None):
            raise RuntimeError("trend_collection_manifest_invalid")
    amazon = amazon or amazon_audit
    amazon_expected = AMAZON_AUDIT_BASE[AMAZON_AUDIT_MODULE] if amazon_audit else AMAZON_BASE_HASHES["amazon-public-browser-health.js"]
    if amazon and (previous != REPORT_RUNTIME_BASE or expected_module != amazon_expected
                   or scheduler_expected is not None or rollback or report_action is not None):
        raise RuntimeError("trend_amazon_manifest_invalid")
    if rollback and scheduler_expected is None:
        raise RuntimeError("trend_scheduler_manifest_invalid")
    if report_action is not None and (previous != REPORT_RUNTIME_BASE or scheduler_expected is not None
                                     or rollback or expected_module != report_hashes(report_action)[0]):
        raise RuntimeError("trend_report_manifest_invalid")
    if scheduler_expected is not None and (
        tuple(scheduler_expected) != SCHEDULER_FILES or any(
            not re.fullmatch(r"[a-f0-9]{64}", sha or "") for sha in scheduler_expected.values()
        )
    ):
        raise RuntimeError("trend_scheduler_manifest_invalid")

    def git(*args):
        return subprocess.check_output(["git", *args], cwd=repo).decode().strip()

    sha = git("rev-parse", "HEAD")
    if (git("status", "--porcelain") or deploy["normalize_github_repository"](git("remote", "get-url", "origin")).lower()
            != deploy["EXPECTED_GITHUB_REPOSITORY"].lower()
            or git("ls-remote", "--exit-code", "origin", "refs/heads/main") != sha + "\trefs/heads/main"):
        raise RuntimeError("trend_release_requires_clean_approved_main")
    deploy["verify_production_sha_history"](repo, previous, sha)
    if collection is not None:
        deploy["verify_production_sha_history"](repo, COLLECTION_SOURCE_BASE, sha)
        validate_collection_changes(git("diff", "--name-only", COLLECTION_SOURCE_BASE, sha).splitlines())
    elif amazon:
        source_base = AMAZON_AUDIT_SOURCE_BASE if amazon_audit else AMAZON_SOURCE_BASE
        deploy["verify_production_sha_history"](repo, source_base, sha)
        validate_amazon_changes(git("diff", "--name-only", source_base, sha).splitlines(), amazon_audit)
    elif report_action is not None:
        deploy["verify_production_sha_history"](repo, REPORT_SOURCE_BASE, sha)
        validate_report_changes(git("diff", "--name-only", REPORT_SOURCE_BASE, sha).splitlines())
    else:
        validate_changes(git("diff", "--name-only", previous, sha).splitlines(), scheduler_expected is not None, rollback)
    if rollback:
        deploy["verify_production_sha_history"](repo, STAGGER_RELEASE_SHA, sha)
        validate_changes(git("diff", "--name-only", STAGGER_RELEASE_SHA, sha).splitlines(), scheduler=True)
    for job in (("build:playwright-crawler",) if collection in ("checkpoint", "checkpoint_restore") else
                ("build:provider-sources", "build:playwright-crawler") if collection in ("sponsored_empty", "sponsored_empty_restore") else
                () if collection in ("python_transport", "python_transport_restore") else
                ("build:database",) if collection in ("relation_key", "relation_key_restore") else
                ("build:api",) if collection in ("handoff_routes", "handoff_routes_restore") else
                ("build:api", "build:playwright-crawler") if collection in ("handoff", "handoff_restore") else
                ("build:playwright-crawler",) if collection in ("detail", "detail_restore", "detail_canonical", "detail_canonical_restore", "delivery_daily", "delivery_daily_restore", "handoff", "handoff_restore", "manual_waf", "manual_waf_restore", "delivery_observe", "delivery_observe_restore", "delivery_ready", "delivery_ready_restore", "search_ready", "search_ready_restore") else
                ("build:data-quality", "build:worker") if collection in ("evidence", "evidence_restore") else
                ("build:worker", "build:provider-sources") if collection is not None else
                ("build:api" if amazon else "build:worker",)):
        subprocess.run([deploy["local_npm_executable"](), "run", job], cwd=repo, check=True)
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain"):
        raise RuntimeError("trend_release_source_changed_during_build")
    module_path = repo / (REPORT_TARGET if report_action is not None else TARGET).removeprefix("backend/")
    amazon_modules = None
    if collection is not None:
        amazon_modules = {}
        before_hashes, after_hashes = collection_hashes(collection)
        for name, before in before_hashes.items():
            lock_followup = collection in ("executor_lock", "executor_lock_restore")
            rank_followup = collection in ("rank", "rank_restore")
            canonical_followup = collection in ("detail_canonical", "detail_canonical_restore")
            lan_followup = collection in ("lan_rate", "lan_rate_restore")
            lan_health_followup = collection in ("lan_health", "lan_health_restore")
            model_hold_followup = collection in ("model_hold", "model_hold_restore")
            daily_followup = collection in ("delivery_daily", "delivery_daily_restore")
            handoff_followup = collection in ("handoff", "handoff_restore")
            handoff_routes_followup = collection in ("handoff_routes", "handoff_routes_restore")
            manual_waf_followup = collection in ("manual_waf", "manual_waf_restore")
            delivery_observe_followup = collection in ("delivery_observe", "delivery_observe_restore")
            search_ready_followup = collection in ("search_ready", "search_ready_restore")
            delivery_ready_followup = collection in ("delivery_ready", "delivery_ready_restore")
            relation_key_followup = collection in ("relation_key", "relation_key_restore")
            python_transport_followup = collection in ("python_transport", "python_transport_restore")
            sponsored_empty_followup = collection in ("sponsored_empty", "sponsored_empty_restore")
            checkpoint_followup = collection in ("checkpoint", "checkpoint_restore")
            source = (COLLECTION_CHECKPOINT_SOURCE if checkpoint_followup else
                      COLLECTION_SPONSORED_EMPTY_SOURCE if sponsored_empty_followup else
                      COLLECTION_PYTHON_TRANSPORT_SOURCE if python_transport_followup else
                      COLLECTION_RELATION_KEY_SOURCE if relation_key_followup else
                      COLLECTION_SEARCH_READY_SOURCE if search_ready_followup else
                      COLLECTION_DELIVERY_READY_SOURCE if delivery_ready_followup else
                      COLLECTION_DELIVERY_OBSERVE_SOURCE if delivery_observe_followup else
                      COLLECTION_MANUAL_WAF_SOURCE if manual_waf_followup else
                      COLLECTION_HANDOFF_ROUTES_SOURCE if handoff_routes_followup else
                      COLLECTION_HANDOFF_SOURCE if handoff_followup else
                      COLLECTION_EXECUTOR_CLOCK_SHA if lock_followup else
                      COLLECTION_RANK_SOURCE_BASE if rank_followup else
                      COLLECTION_LAN_SOURCE[name] if lan_followup else
                      COLLECTION_LAN_HEALTH_SOURCE if lan_health_followup else
                      COLLECTION_MODEL_HOLD_SOURCE if model_hold_followup else
                      COLLECTION_DAILY_SOURCE if daily_followup else
                      COLLECTION_DETAIL_DIAG_SOURCE if canonical_followup else COLLECTION_SOURCE_BASE)
            restored = build_collection_restore(repo, name, source)
            original = (COLLECTION_CHECKPOINT_BASE[name] if checkpoint_followup else
                        COLLECTION_SPONSORED_EMPTY_BASE[name] if sponsored_empty_followup else
                        COLLECTION_PYTHON_TRANSPORT_BASE[name] if python_transport_followup else
                        COLLECTION_RELATION_KEY_BASE[name] if relation_key_followup else
                        COLLECTION_SEARCH_READY_BASE[name] if search_ready_followup else
                        COLLECTION_DELIVERY_READY_BASE[name] if delivery_ready_followup else
                        COLLECTION_DELIVERY_OBSERVE_BASE[name] if delivery_observe_followup else
                        COLLECTION_MANUAL_WAF_BASE[name] if manual_waf_followup else
                        COLLECTION_HANDOFF_ROUTES_BASE[name] if handoff_routes_followup else
                        COLLECTION_HANDOFF_BASE[name] if handoff_followup else
                        COLLECTION_RANK_BASE[name] if rank_followup else
                        COLLECTION_LAN_BASE[name] if lan_followup else
                        COLLECTION_LAN_HEALTH_BASE[name] if lan_health_followup else
                        COLLECTION_MODEL_HOLD_BASE[name] if model_hold_followup else
                        COLLECTION_DAILY_BASE[name] if daily_followup else
                        COLLECTION_DETAIL_CANDIDATE if canonical_followup else
                        COLLECTION_EXECUTOR_CANDIDATE if lock_followup else
                        {**COLLECTION_BASE, COLLECTION_EXECUTOR: COLLECTION_EXECUTOR_BASE,
                         COLLECTION_BROWSER: COLLECTION_BROWSER_BASE, COLLECTION_DETAIL: COLLECTION_DETAIL_BASE,
                         **COLLECTION_EVIDENCE_BASE}[name])
            if hashlib.sha256(restored).hexdigest() != original:
                raise RuntimeError("trend_collection_restore_build_differs")
            data = (restored if collection == "restore" or collection.endswith("_restore") else
                    build_collection_restore(repo, name, sha) if relation_key_followup or python_transport_followup or sponsored_empty_followup or checkpoint_followup else (repo / name).read_bytes())
            after = hashlib.sha256(data).hexdigest()
            if after != after_hashes[name]:
                raise RuntimeError("trend_collection_build_differs")
            amazon_modules[name] = (before, base64.b64encode(zlib.compress(data)).decode(), after)
    elif amazon:
        amazon_modules = {}
        for name, before in (AMAZON_AUDIT_BASE if amazon_audit else AMAZON_BASE_HASHES).items():
            data = (repo / "apps/api/dist" / name).read_bytes()
            after = hashlib.sha256(data).hexdigest()
            if before == after or not 0 < len(data) <= 131072:
                raise RuntimeError("trend_amazon_payload_invalid")
            amazon_modules[name] = (before, base64.b64encode(zlib.compress(data)).decode(), after)
    module = b"" if amazon_modules is not None else build_report_restore(repo) if report_action == "restore" else module_path.read_bytes()
    if report_action is not None and hashlib.sha256(module).hexdigest() != report_hashes(report_action)[1]:
        raise RuntimeError("trend_report_build_differs")
    scheduler = None
    if scheduler_expected is not None:
        if hashlib.sha256(module).hexdigest() != expected_module:
            raise RuntimeError("trend_protected_build_differs")
        scheduler = {}
        for name, before in scheduler_expected.items():
            payload = module_path.with_name(name).read_bytes()
            after = hashlib.sha256(payload).hexdigest()
            if rollback and after != PRE_STAGGER_SHA256[name]:
                raise RuntimeError("trend_rollback_build_differs")
            scheduler[name] = (before, base64.b64encode(payload).decode(), after)
        module = b""
    args = (deploy["PROJECT_ROOT"], previous, expected_module, sha, base64.b64encode(module).decode(),
            hashlib.sha256(module).hexdigest(), scheduler, rollback, report_action, amazon_modules, collection)
    code = Path(__file__).read_text(encoding="utf-8")
    drain_code = ((repo / "scripts/baota-account-claim-drain.py").read_text(encoding="utf-8")
                  if collection in ("python_transport", "python_transport_restore", "checkpoint", "checkpoint_restore") else None)
    source = ("drain_code=" + repr(drain_code) + "\nnode=" + repr(deploy["NODE_BIN"]) +
              "\ncode=" + repr(code) + "\nargs=" + repr(args)) + r'''
import json,re
ns={"__name__":"trend_release"}
exec(compile(code,"trend_release","exec"),ns)
try:
 if drain_code is not None:
  drain_ns={"__name__":"claim_drain"};exec(compile(drain_code,"claim_drain","exec"),drain_ns)
  drain=drain_ns["BaselineClaimDrain"](ns["Path"](args[0]),node)
  result=ns["install_with_claim_drain"](ns["install"],args,drain)
 else:
  result=ns["install"](*args)
except Exception as exc:
 result={"status":False,"message":ns["MODULE_PHASE"]+":"+ns["release_error_code"](exc)}
print("SCOUTOPS_RESULT="+json.dumps(result))
'''
    with ssh_connection(deploy) as ssh:
        return deploy["remote_python"](ssh, source, timeout=400 if drain_code is not None else 205)
