import importlib

from app.utils import log_files

import_router_module = importlib.import_module("app.routers.import_router")


def test_upload_does_not_fail_when_debug_log_is_unwritable(client, test_user, auth_headers, monkeypatch):
    """Upload should continue even if manual debug logging cannot write."""
    original_open = log_files.Path.open

    def guarded_open(path, *args, **kwargs):
        if path.name == "debug_manual.log":
            raise PermissionError("debug log is not writable")
        return original_open(path, *args, **kwargs)

    monkeypatch.setattr(log_files.Path, "open", guarded_open)
    monkeypatch.setattr(import_router_module, "process_excel_file", lambda content, db: [{}])

    response = client.post(
        "/import/upload",
        headers=auth_headers,
        files={
            "file": (
                "test.xlsx",
                b"fake excel content",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["invoices"]) == 1
    assert "file_hash" in data
