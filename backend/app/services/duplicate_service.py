from collections import defaultdict
from datetime import date, datetime
from typing import Any, Iterable

from sqlalchemy.orm import Session

from ..models import Invoice


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().upper()


def _normalize_invoice_number(value: Any) -> str:
    return _normalize_text(value).replace(" ", "")


def _normalize_amount(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _normalize_date(value: Any) -> str:
    if value in (None, "", "nan"):
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    try:
        return datetime.fromisoformat(str(value)).date().isoformat()
    except ValueError:
        text = str(value).strip()
        return text[:10]


def build_duplicate_key(item: Any) -> tuple[str, str, float, str]:
    return (
        _normalize_text(getattr(item, "cif", None) if not isinstance(item, dict) else item.get("cif")),
        _normalize_invoice_number(getattr(item, "factura", None) if not isinstance(item, dict) else item.get("factura")),
        _normalize_amount(getattr(item, "importe", None) if not isinstance(item, dict) else item.get("importe")),
        _normalize_date(
            getattr(item, "fecha_vencimiento", None) if not isinstance(item, dict) else item.get("fecha_vencimiento")
        ),
    )


def summarize_duplicate_groups(items: Iterable[Any]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, float, str], list[Any]] = defaultdict(list)
    for item in items:
        grouped[build_duplicate_key(item)].append(item)

    groups = []
    for (_cif, factura, amount, due_date), entries in grouped.items():
        if len(entries) < 2:
            continue

        batch_ids = []
        invoice_ids = []
        for entry in entries:
            batch_id = getattr(entry, "batch_id", None) if not isinstance(entry, dict) else entry.get("batch_id")
            invoice_id = getattr(entry, "id", None) if not isinstance(entry, dict) else entry.get("id")
            if batch_id is not None:
                batch_ids.append(batch_id)
            if invoice_id is not None:
                invoice_ids.append(invoice_id)

        groups.append(
            {
                "reference": factura or "Sin referencia",
                "amount": amount,
                "due_date": due_date or None,
                "occurrences": len(entries),
                "total_amount": round(amount * len(entries), 2),
                "batch_ids": sorted(set(batch_ids)),
                "invoice_ids": sorted(set(invoice_ids)),
            }
        )

    groups.sort(key=lambda group: (-group["occurrences"], -group["total_amount"], group["reference"]))
    return groups


def annotate_import_duplicates(invoices: list[dict[str, Any]], db: Session | None) -> list[dict[str, Any]]:
    if not invoices:
        return invoices

    file_groups: dict[tuple[str, str, float, str], list[dict[str, Any]]] = defaultdict(list)
    for invoice in invoices:
        file_groups[build_duplicate_key(invoice)].append(invoice)

    db_groups: dict[tuple[str, str, float, str], list[Invoice]] = defaultdict(list)
    if db is not None:
        cifs = sorted({_normalize_text(invoice.get("cif")) for invoice in invoices if invoice.get("cif")})
        references = sorted(
            {_normalize_invoice_number(invoice.get("factura")) for invoice in invoices if invoice.get("factura")}
        )
        if cifs and references:
            existing_invoices = (
                db.query(Invoice)
                .filter(Invoice.cif.in_(cifs), Invoice.factura.in_(references))
                .all()
            )
            for existing in existing_invoices:
                db_groups[build_duplicate_key(existing)].append(existing)

    for invoice in invoices:
        key = build_duplicate_key(invoice)
        duplicate_messages = []
        file_duplicates = max(len(file_groups[key]) - 1, 0)
        db_duplicates = len(db_groups.get(key, []))
        total_duplicates = file_duplicates + db_duplicates

        invoice["duplicate_status"] = None
        invoice["duplicate_message"] = None
        invoice["duplicate_count"] = total_duplicates

        if file_duplicates:
            duplicate_messages.append(
                f"Duplicada en archivo ({file_duplicates + 1} coincidencias con misma factura, importe y vencimiento)"
            )

        if db_duplicates:
            batch_refs = sorted({existing.batch_id for existing in db_groups[key] if existing.batch_id is not None})
            if batch_refs:
                duplicate_messages.append(
                    f"Ya existe en base de datos en lotes {', '.join(f'#{batch_id}' for batch_id in batch_refs[:3])}"
                )
            else:
                duplicate_messages.append("Ya existe en base de datos")

        if duplicate_messages:
            invoice["duplicate_status"] = "BOTH" if file_duplicates and db_duplicates else "FILE" if file_duplicates else "DATABASE"
            invoice["duplicate_message"] = " | ".join(duplicate_messages)
            existing_message = str(invoice.get("validation_message") or "").strip()
            invoice["validation_message"] = " | ".join(
                part for part in [existing_message, invoice["duplicate_message"]] if part
            )
            if invoice.get("status") == "VALID":
                invoice["status"] = "WARNING"

    return invoices
