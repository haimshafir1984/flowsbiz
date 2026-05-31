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
from app.api.dependencies import admin_required, client_or_admin_required
from app.core.models.client import User, UserRole

router = APIRouter()

# --- Client (Tenant) Management (Admins Only) ---

@router.get("/clients")
async def list_clients(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(admin_required)
):
    """
    List all active clients. Restricted to global Admin only.
    """
    stmt = select(ClientORM).order_by(ClientORM.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/clients", status_code=201)
async def create_client(
    payload: ClientCreateSchema, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(admin_required)
):
    """
    Create a new client/tenant. Restricted to global Admin only.
    """
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

# --- Global Security Audit Log (Admins Only) ---

@router.get("/global/audits")
async def get_global_audits(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(admin_required)
):
    """
    Fetch global audit logs across all clients. Restricted to global Admin only.
    """
    stmt = select(AuditLogORM).order_by(AuditLogORM.timestamp.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

# --- Scoped Campaigns & Logs Management ---

@router.get("/{client_id}")
async def list_campaigns(
    client_id: UUID, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(client_or_admin_required)
):
    """
    List campaigns for a specific client. Ensures client isolation.
    """
    if current_user.role == UserRole.CLIENT and current_user.client_id != client_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: Cannot query other tenants' campaigns."
        )
        
    stmt = select(CampaignORM).where(CampaignORM.client_id == client_id).order_by(CampaignORM.started_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/{client_id}", status_code=201)
async def create_campaign(
    client_id: UUID, 
    payload: CampaignCreateSchema, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(client_or_admin_required)
):
    """
    Create a new campaign. Ensures tenant validation.
    """
    if current_user.role == UserRole.CLIENT and current_user.client_id != client_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: Cannot create campaigns for other tenants."
        )
        
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

@router.post("/{campaign_id}/dispatch")
async def dispatch_campaign(
    campaign_id: UUID, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(client_or_admin_required)
):
    """
    Dispatch campaign messages. Handles tenant-level validations.
    """
    stmt = select(CampaignORM).where(CampaignORM.id == campaign_id)
    res = await db.execute(stmt)
    campaign = res.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if current_user.role == UserRole.CLIENT and campaign.client_id != current_user.client_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: This campaign does not belong to your account."
        )
        
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

@router.get("/{campaign_id}/messages")
async def get_campaign_messages(
    campaign_id: UUID, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(client_or_admin_required)
):
    """
    Fetch granular dispatch tracking logs for a campaign. Ensures tenant isolation.
    """
    stmt = select(CampaignORM).where(CampaignORM.id == campaign_id)
    res = await db.execute(stmt)
    campaign = res.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if current_user.role == UserRole.CLIENT and campaign.client_id != current_user.client_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: This campaign does not belong to your account."
        )
        
    stmt = select(MessageORM).where(MessageORM.campaign_id == campaign_id).order_by(MessageORM.sent_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{client_id}/audits")
async def get_client_audits(
    client_id: UUID, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(client_or_admin_required)
):
    """
    Fetch tenant audit trails. Ensures tenant isolation.
    """
    if current_user.role == UserRole.CLIENT and current_user.client_id != client_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: Cannot fetch other tenants' audit logs."
        )
        
    stmt = select(AuditLogORM).where(AuditLogORM.client_id == client_id).order_by(AuditLogORM.timestamp.desc())
    res = await db.execute(stmt)
    return res.scalars().all()
