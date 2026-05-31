from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
from typing import List
from sqlalchemy import select
import datetime

from app.adapters.database.connection import get_db_session
from app.adapters.database.models import ClientORM, CampaignORM, MessageORM, AuditLogORM
from app.adapters.queue.provider import CeleryQueueProvider
from app.api.schemas import ClientCreateSchema, CampaignCreateSchema

router = APIRouter()

# Client (Tenant) Management
@router.get("/clients")
async def list_clients(db: AsyncSession = Depends(get_db_session)):
    stmt = select(ClientORM).order_by(ClientORM.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/clients", status_code=201)
async def create_client(payload: ClientCreateSchema, db: AsyncSession = Depends(get_db_session)):
    client = ClientORM(
        id=uuid4(),
        name=payload.name,
        company_registration_number=payload.company_registration_number,
        website=payload.website,
        meta_waba_id=payload.meta_waba_id,
        meta_phone_number_id=payload.meta_phone_number_id,
        meta_permanent_access_token=payload.meta_permanent_access_token,
        status=payload.status or "active"
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client

# Campaigns Management
@router.get("/{client_id}")
async def list_campaigns(client_id: UUID, db: AsyncSession = Depends(get_db_session)):
    stmt = select(CampaignORM).where(CampaignORM.client_id == client_id).order_by(CampaignORM.started_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/{client_id}", status_code=201)
async def create_campaign(
    client_id: UUID, 
    payload: CampaignCreateSchema, 
    db: AsyncSession = Depends(get_db_session)
):
    campaign = CampaignORM(
        id=uuid4(),
        client_id=client_id,
        name=payload.name,
        template_name=payload.template_name,
        template_language=payload.template_language,
        status="draft",
        total_contacts_count=0
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign

# Flow A - Campaign Dispatch Trigger
@router.post("/{campaign_id}/dispatch")
async def dispatch_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db_session)):
    stmt = select(CampaignORM).where(CampaignORM.id == campaign_id)
    res = await db.execute(stmt)
    campaign = res.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status in ("processing", "completed"):
        raise HTTPException(status_code=400, detail="Campaign is already processing or completed")
        
    # Get active opt-in contacts count for total segment size
    from app.adapters.database.models import ContactORM
    contacts_stmt = select(ContactORM).where(
        ContactORM.client_id == campaign.client_id,
        ContactORM.opt_in_status == "granted"
    )
    contacts_res = await db.execute(contacts_stmt)
    active_contacts = contacts_res.scalars().all()
    
    campaign.total_contacts_count = len(active_contacts)
    campaign.status = "scheduled"
    await db.commit()
    
    # Trigger background worker using Celery Queue Adapter
    queue = CeleryQueueProvider()
    queue.enqueue_campaign_processing(campaign.id)
    
    return {"message": "Campaign queued and scheduled for background execution", "status": "scheduled"}

# Metrics Logging and Auditing
@router.get("/{campaign_id}/messages")
async def get_campaign_messages(campaign_id: UUID, db: AsyncSession = Depends(get_db_session)):
    """
    Fetch granular dispatch tracking logs for a campaign.
    """
    stmt = select(MessageORM).where(MessageORM.campaign_id == campaign_id).order_by(MessageORM.sent_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{client_id}/audits")
async def get_client_audits(client_id: UUID, db: AsyncSession = Depends(get_db_session)):
    """
    Fetch tenant audit trails.
    """
    stmt = select(AuditLogORM).where(AuditLogORM.client_id == client_id).order_by(AuditLogORM.timestamp.desc())
    res = await db.execute(stmt)
    return res.scalars().all()
