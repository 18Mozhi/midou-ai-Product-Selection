from dataclasses import dataclass


@dataclass(frozen=True)
class FoundationTask:
    task_id: str
    organization_id: str
    workspace_id: str
    request_id: str
    trace_id: str


def validate_task(task: FoundationTask) -> FoundationTask:
    """Reject unscoped collection work before a provider can run."""
    if not task.organization_id.strip():
        raise ValueError("organization_id is required")
    if not task.workspace_id.strip():
        raise ValueError("workspace_id is required")
    return task
