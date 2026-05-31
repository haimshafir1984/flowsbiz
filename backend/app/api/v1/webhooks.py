from fastapi import APIRouter, Depends, Query, Request, HTTPException
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from app.adapters.database.connection import get_db_session
from app.adapters.database.repository import SqlCampaignRepository
from app.adapters.meta_whatsapp.provider import MetaWhatsAppProvider
from app.core.services.unsubscribe_manager import UnsubscribeManager
from app.adapters.database.models import ClientORM

router = APIRouter()

@router.get("")
def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """
    HTTP GET endpoint for Meta to verify our webhook subscription challenge.
    """
    try:
        provider = MetaWhatsAppProvider()
        challenge_res = provider.verify_webhook(hub_mode, hub_token, hub_challenge)
        return int(challenge_res) if challenge_res.isdigit() else challenge_res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db_session)):
    """
    HTTP POST callback from Meta detailing real-time message status updates 
    and incoming texts for Opt-out handling (Flow B).
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    repo = SqlCampaignRepository(db)
    
    # Process Webhook Payload changes
    entry_list = payload.get("entry", [])
    for entry in entry_list:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            
            # Flow B - Delivery Status Updates
            statuses = value.get("statuses", [])
            for status_info in statuses:
                wamid = status_info.get("id")
                status = status_info.get("status")  # sent, delivered, read, failed
                errors = status_info.get("errors", [])
                
                message = await repo.get_message_by_wamid(wamid)
                if message:
                    err_code = str(errors[0].get("code")) if errors else None
                    err_msg = errors[0].get("message") if errors else None
                    
                    # Update status
                    await repo.update_message_status(
                        message_id=message.id,
                        status=status,
                        error_code=err_code,
                        error_message=err_msg
                    )
                    
                    # Update Campaign tracking counters atomically
                    if status == "delivered" and message.status != "delivered":
                        await repo.increment_campaign_counter(message.campaign_id, "delivered_count")
                    elif status == "read" and message.status != "read":
                        await repo.increment_campaign_counter(message.campaign_id, "read_count")
                    elif status == "failed" and message.status != "failed":
                        await repo.increment_campaign_counter(message.campaign_id, "failed_count")
                        
            # Flow B - Incoming messages (check keyword "הסר" / "Unsubscribe")
            messages = value.get("messages", [])
            for msg in messages:
                text_body = msg.get("text", {}).get("body", "").strip()
                phone = msg.get("from")
                
                # Opt-out keywords check
                if text_body in ("הסר", "להסיר", "Unsubscribe", "stop", "STOP", "unsub"):
                    # Find first active tenant client to apply the revocation
                    client_stmt = select(ClientORM).where(ClientORM.status == "active").limit(1)
                    res = await db.execute(client_stmt)
                    client = res.scalar_one_or_none()
                    
                    if client:
                        # Format number to E.164
                        formatted_phone = f"+{phone}" if not phone.startswith("+") else phone
                        unsub_mgr = UnsubscribeManager(repo)
                        await unsub_mgr.process_unsubscribe(
                            client_id=client.id,
                            phone_number=formatted_phone
                        )
                        
    return {"status": "success"}

# Mock Endpoint helper for Frontend testing
@router.post("/simulate-webhook")
async def simulate_webhook(
    event_type: str, # status_delivered, status_read, user_unsubscribe
    wamid: Optional[str] = None,
    phone_number: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Helper API allowing the dashboard frontend to mock/simulate webhook arrivals 
    without having production Meta API callbacks configured.
    """
    repo = SqlCampaignRepository(db)
    
    if event_type in ("status_delivered", "status_read"):
        if not wamid:
            raise HTTPException(status_code=400, detail="wamid parameter is required for status simulations")
            
        status = "delivered" if event_type == "status_delivered" else "read"
        
        # Dispatch status updates
        message = await repo.get_message_by_wamid(wamid)
        if message:
            await repo.update_message_status(message.id, status)
            if status == "delivered" and message.status != "delivered":
                await repo.increment_campaign_counter(message.campaign_id, "delivered_count")
            elif status == "read" and message.status != "read":
                await repo.increment_campaign_counter(message.campaign_id, "read_count")
            return {"status": "simulated", "message": f"Message {wamid} marked as {status}"}
        else:
            raise HTTPException(status_code=404, detail=f"Tracking log with wamid {wamid} not found")
            
    elif event_type == "user_unsubscribe":
        if not phone_number:
            raise HTTPException(status_code=400, detail="phone_number parameter is required for unsubscribe simulation")
            
        client_stmt = select(ClientORM).where(ClientORM.status == "active").limit(1)
        res = await db.execute(client_stmt)
        client = res.scalar_one_or_none()
        
        if client:
            unsub_mgr = UnsubscribeManager(repo)
            await unsub_mgr.process_unsubscribe(client.id, phone_number)
            return {"status": "simulated", "message": f"Opt-in revoked for {phone_number}"}
        else:
            raise HTTPException(status_code=404, detail="No active client profile registered to apply opt-out")
            
    raise HTTPException(status_code=400, detail="Unknown event_type simulator trigger")
