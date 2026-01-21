from fastapi import APIRouter, Depends, Query
from ..routers.auth_router import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from pydantic import BaseModel
from ..database import get_db
from ..models import Batch, Provider, Invoice

router = APIRouter(
    prefix="/search", 
    tags=["search"],
    dependencies=[Depends(get_current_user)]
)

class SearchResult(BaseModel):
    type: str # 'batch' | 'provider' | 'invoice'
    id: str   # ID to navigate to
    title: str
    subtitle: str
    url: str

@router.get("/", response_model=List[SearchResult])
def global_search(q: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    results = []
    limit = 5
    search = f"%{q}%"

    # 1. Search Batches
    batches_query = db.query(Batch).filter(
        or_(
            Batch.name.ilike(search),
            # Cast ID to string for ilike or just check separate condition if digit
            # For simplicity, if q is digit, we check ID exact match or check if ID string contains q
        )
    )
    if q.isdigit():
         batches_query = db.query(Batch).filter(or_(Batch.name.ilike(search), Batch.id == int(q)))
    else:
         batches_query = db.query(Batch).filter(Batch.name.ilike(search))

    batches = batches_query.limit(limit).all()
    for b in batches:
        # Calculate total (Batch model doesn't have total_amount column)
        total_amount = sum(inv.importe for inv in b.invoices) if b.invoices else 0.0
        
        results.append({
            "type": "batch",
            "id": str(b.id),
            "title": f"Remesa #{b.id}: {b.name}",
            "subtitle": f"{total_amount:,.2f}€ • {b.created_at.strftime('%d/%m/%Y')}",
            "url": f"/history?batchId={b.id}"
        })

    # 2. Search Providers
    providers = db.query(Provider).filter(
        or_(
            Provider.name.ilike(search),
            Provider.cif.ilike(search)
        )
    ).limit(limit).all()

    for p in providers:
        results.append({
            "type": "provider",
            "id": p.cif,
            "title": p.name or "Sin Nombre",
            "subtitle": f"CIF: {p.cif} • {p.email or ''}",
            "url": f"/providers/{p.cif}"
        })
    
    # 3. Search Invoices (by Number)
    invoices = db.query(Invoice).filter(
        Invoice.factura.ilike(search)
    ).limit(limit).all()
    
    for inv in invoices:
        results.append({
            "type": "invoice",
            "id": str(inv.id),
            "title": f"Fac. {inv.factura}",
            "subtitle": f"{inv.nombre} • {inv.importe:.2f}€",
            "url": f"/providers/{inv.cif}"
        })

    return results
