import asyncio
from celery import Celery
from uuid import UUID
from app.config import settings

# Initialize Celery
celery_app = Celery(
    "whatsapp_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Helper to run async code inside synchronous Celery worker threads
def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)

@celery_app.task(name="process_campaign")
def process_campaign_task(campaign_id_str: str):
    from app.adapters.database.connection import async_session_factory
    from app.adapters.database.repository import SqlCampaignRepository
    from app.adapters.queue.provider import CeleryQueueProvider
    from app.core.services.campaign_processor import CampaignProcessor
    
    campaign_id = UUID(campaign_id_str)
    
    async def _execute():
        async with async_session_factory() as session:
            repo = SqlCampaignRepository(session)
            queue = CeleryQueueProvider()
            processor = CampaignProcessor(repo, queue)
            await processor.prepare_campaign_sending(campaign_id)
            
    run_async(_execute())

@celery_app.task(name="send_single_message")
def send_single_message_task(message_id_str: str):
    from app.adapters.database.connection import async_session_factory
    from app.adapters.database.repository import SqlCampaignRepository
    from app.adapters.meta_whatsapp.provider import MetaWhatsAppProvider
    from uuid import UUID
    
    message_id = UUID(message_id_str)
    
    async def _execute():
        async with async_session_factory() as session:
            repo = SqlCampaignRepository(session)
            provider = MetaWhatsAppProvider()
            
            # Fetch message log details
            message = await repo.get_message_by_id(message_id)
            if not message or message.status != "queued":
                return
                
            # Rate Limiting / Throttling Dispatch Delay
            # Introduce a safe 2-second sleep duration to simulate spam-protection limits
            await asyncio.sleep(2.0)
            
            # Fetch client/tenant configs dynamically
            client = await repo.get_client(message.client_id)
            campaign = await repo.get_campaign(message.campaign_id) if message.campaign_id else None
            
            if not client or not campaign:
                await repo.update_message_status(
                    message_id=message_id,
                    status="failed",
                    error_code="CONFIG_ERROR",
                    error_message="Missing tenant or campaign configuration metadata"
                )
                return
                
            # Prepare configuration and variables
            client_config = {
                "meta_phone_number_id": client.meta_phone_number_id,
                "meta_permanent_access_token": client.meta_permanent_access_token
            }
            
            # Load template parameters (Mock components - easily expanded)
            components = []
            
            try:
                # Call outbound WhatsApp provider adapter
                res = await provider.send_template(
                    to_phone=message.phone_number,
                    template_name=campaign.template_name,
                    language=campaign.template_language,
                    components=components,
                    client_config=client_config
                )
                
                wamid = res.get("wamid")
                
                # Update status to sent
                await repo.update_message_status(
                    message_id=message_id,
                    status="sent",
                    meta_message_id=wamid
                )
                
                # Atomically increment sent_count on campaign
                await repo.increment_campaign_counter(campaign.id, "sent_count")
                
            except Exception as err:
                # Log Meta specific transmission error
                error_msg = str(err)
                await repo.update_message_status(
                    message_id=message_id,
                    status="failed",
                    error_code="META_DISPATCH_FAILURE",
                    error_message=error_msg[:450]
                )
                
                # Increment failed_count on campaign
                await repo.increment_campaign_counter(campaign.id, "failed_count")
                
    run_async(_execute())
