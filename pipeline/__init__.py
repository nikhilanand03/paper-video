"""Pipeline package — re-exports for backward compatibility.

External code can still do:
    from pipeline import create_job, get_job, run_pipeline, Status, OUTPUT_ROOT
"""

from pipeline.orchestrator import (
    JobManager,
    Pipeline,
    Status,
    RENDER_MODE,
    OUTPUT_ROOT,
    UPLOADED_PDFS_DIR,
    PIPELINE_STAGES_FULL,
    PIPELINE_STAGES_FRAMES_ONLY,
    # Backward-compat free functions
    create_job,
    get_job,
    run_pipeline,
    # Internals used by tests
    _default_manager,
    _default_pipeline,
    _jobs,
    _sanitize,
    _next_run_name,
)

__all__ = [
    "JobManager", "Pipeline", "Status",
    "RENDER_MODE", "OUTPUT_ROOT", "UPLOADED_PDFS_DIR",
    "PIPELINE_STAGES_FULL", "PIPELINE_STAGES_FRAMES_ONLY",
    "create_job", "get_job", "run_pipeline",
    "_default_manager", "_default_pipeline", "_jobs",
    "_sanitize", "_next_run_name",
]
