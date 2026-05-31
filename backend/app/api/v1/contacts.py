from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
import csv
import io
from typing import List, Optional
from app.adapters.database.connection import get_db_session
from app.adapters.database.models import ContactORM
from app.api.schemas import ContactCreateSchema
from app.adapters.database.repository import SqlCampaignRepository
from app.core.models.contact import Contact
from sqlalchemy import select, update
import datetime

router = APIRouter()

@router.get("/{client_id}")
async def list_contacts(client_id: UUID, db: AsyncSession = Depends(get_db_session)):
    """
    Retrieve all registered contacts for a tenant.
    """
    stmt = select(ContactORM).where(ContactORM.client_id == client_id).order_by(ContactORM.created_at.desc())
    res = await db.execute(stmt)
    orms = res.scalars().all()
    return orms

@router.post("/{client_id}", status_code=201)
async def create_contact(
    client_id: UUID, 
    payload: ContactCreateSchema, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Register a new contact with custom parameters.
    """
    # Clean check if number exists
    stmt = select(ContactORM).where(
        ContactORM.client_id == client_id, 
        ContactORM.phone_number == payload.phone_number
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    
    if existing:
        # Re-subscribe contact if they previously opted out
        existing.opt_in_status = "granted"
        existing.first_name = payload.first_name
        existing.last_name = payload.last_name
        existing.custom_attributes = payload.custom_attributes or {}
        existing.opt_in_date = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing
        
    contact = ContactORM(
        id=uuid4(),
        client_id=client_id,
        phone_number=payload.phone_number,
        first_name=payload.first_name,
        last_name=payload.last_name,
        custom_attributes=payload.custom_attributes or {},
        opt_in_status="granted"
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact

@router.put("/{contact_id}/opt-status")
async def toggle_opt_status(
    contact_id: UUID, 
    opt_status: str, 
    db: AsyncSession = Depends(get_db_session)
):
    """
    Manually toggle contact opt-in status.
    """
    if opt_status not in ("granted", "revoked"):
        raise HTTPException(status_code=400, detail="Invalid status option. Must be 'granted' or 'revoked'")
        
    stmt = update(ContactORM).where(ContactORM.id == contact_id).values(
        opt_in_status=opt_status, 
        opt_in_date=datetime.datetime.utcnow()
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "Status updated successfully"}

@router.post("/upload/{client_id}", status_code=201)
async def upload_contacts_csv(
    client_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Upload a CSV file containing contacts. Automatically sanitizes phone numbers
    and maps extra columns to custom_attributes.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
        
    try:
        content = await file.read()
        csv_text = content.decode('utf-8')
        csv_file = io.StringIO(csv_text)
        reader = csv.DictReader(csv_file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")
        
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers.")
        
    headers = [h.strip() for h in reader.fieldnames]
    
    # Identify key columns
    phone_col = None
    first_name_col = None
    last_name_col = None
    
    for h in headers:
        hl = h.lower()
        if 'phone' in hl or 'number' in hl or 'טלפון' in hl or hl == 'to':
            phone_col = h
        elif 'first' in hl or 'name' in hl or 'שם פרטי' in hl or hl == 'שם':
            first_name_col = h
        elif 'last' in hl or 'family' in hl or 'משפחה' in hl or 'שם משפחה' in hl:
            last_name_col = h
            
    if not phone_col:
        # Fallback to first column if nothing matches
        phone_col = headers[0]
        
    # Helper to sanitize phone to E.164
    def sanitize_phone(phone: str) -> str:
        clean = "".join([c for c in phone if c.isdigit() or c == '+'])
        if not clean:
            return ""
        
        # Local Israeli prefix mapping: e.g. 0501234567 -> +972501234567
        if clean.startswith("0") and len(clean) == 10:
            clean = "+972" + clean[1:]
        elif not clean.startswith("+"):
            if len(clean) == 9:
                clean = "+972" + clean
            else:
                clean = "+" + clean
        return clean

    contacts_batch = []
    
    for row in reader:
        raw_phone = row.get(phone_col, "").strip()
        if not raw_phone:
            continue
            
        phone = sanitize_phone(raw_phone)
        if not phone:
            continue
            
        first_name = row.get(first_name_col, "אורח/ת").strip() if first_name_col else "אורח/ת"
        last_name = row.get(last_name_col, "").strip() if last_name_col else ""
        
        # Any extra columns go to custom_attributes
        custom_attr = {}
        for h in headers:
            if h not in (phone_col, first_name_col, last_name_col):
                val = row.get(h, "")
                if val is not None:
                    clean_h = h.strip()
                    custom_attr[clean_h] = val.strip() if isinstance(val, str) else val
                    
        # Check if attribute variables exist. Let's make sure parameter indices are supported too
        if "1" not in custom_attr:
            custom_attr["1"] = first_name
        if "2" not in custom_attr:
            custom_attr["2"] = last_name or "חבר/ה"
            
        contact_id = uuid4()
        contact = Contact(
            id=contact_id,
            client_id=client_id,
            phone_number=phone,
            first_name=first_name,
            last_name=last_name,
            custom_attributes=custom_attr,
            opt_in_status="granted",
            opt_in_source="csv_import"
        )
        contacts_batch.append(contact)
        
    if not contacts_batch:
        raise HTTPException(status_code=400, detail="No valid contacts with phone numbers found in CSV.")
        
    repo = SqlCampaignRepository(db)
    await repo.create_contacts_batch(contacts_batch)
    
    # Save active audit log
    from app.core.models.audit import AuditLog
    await repo.create_audit_log(
        AuditLog(
            id=uuid4(),
            client_id=client_id,
            action="CONTACTS_IMPORT",
            actor="user",
            payload={"count": len(contacts_batch), "file": file.filename}
        )
    )
    
    return {"status": "success", "imported_count": len(contacts_batch)}
