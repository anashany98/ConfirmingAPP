import logging
import os
from pathlib import Path


logger = logging.getLogger(__name__)


def resolve_log_dir() -> Path:
    candidates: list[Path] = []
    configured_dir = os.getenv("APP_LOG_DIR")
    if configured_dir:
        candidates.append(Path(configured_dir))

    if Path("/app").exists():
        candidates.append(Path("/app/logs"))

    candidates.append(Path(__file__).resolve().parents[2] / "logs")
    candidates.append(Path.cwd() / "logs")

    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
        except OSError:
            logger.warning("Could not create log directory %s", candidate, exc_info=True)

    return Path.cwd()


def append_log_line(file_name: str, message: str) -> bool:
    log_path = resolve_log_dir() / file_name
    try:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(message)
        return True
    except OSError:
        logger.warning("Could not write log file %s", log_path, exc_info=True)
        return False
