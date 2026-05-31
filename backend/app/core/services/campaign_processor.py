import uuid
from uuid import UUID
from datetime import datetime
from app.ports.repository import CampaignRepositoryPort
from app.ports.queue_provider import QueueProviderPort
from app.core.models.message import Message
from app.core.models.audit import AuditLog

class CampaignProcessor:
    def __init__(self, repo: CampaignRepositoryPort, queue: QueueProviderPort):
        self.repo = repo
        self.queue = queue

    async def prepare_campaign_sending(self, campaign_id: UUID) -> None:
        """
        Flow A (Step 2 & 3):
        Loads campaign metadata, fetches verified active contacts who have opted in ('granted'),
        creates queued message logs, enqueues background worker sends, and updates campaign status.
        """
        campaign = await self.repo.get_campaign(campaign_id)
        if not campaign:
            raise ValueError(f"Campaign with ID {campaign_id} not found.")

        if campaign.status in ("processing", "completed"):
            # Avoid duplicate campaign rollouts
            return

        # Update status to processing
        await self.repo.update_campaign_status(campaign_id, "processing")
        
        # Log Audit Event
        await self.repo.create_audit_log(
            AuditLog(
                id=uuid.uuid4(),
                client_id=campaign.client_id,
                action="CAMPAIGN_START",
                actor="system",
                payload={"campaign_id": str(campaign_id), "name": campaign.name}
            )
        )

        # Retrieve active opt-in contacts under this tenant
        contacts = await self.repo.get_active_contacts(campaign.client_id)
        
        if not contacts:
            await self.repo.update_campaign_status(campaign_id, "completed")
            return

        # Prepare sending sequence
        for contact in contacts:
            # Create a transmission log record
            msg_id = uuid.uuid4()
            msg_log = Message(
                id=msg_id,
                client_id=campaign.client_id,
                contact_id=contact.id,
                phone_number=contact.phone_number,
                campaign_id=campaign_id,
                status="queued"
            )
            await self.repo.create_message_log(msg_log)
            
            # Enqueue the background sending task
            self.queue.enqueue_single_message_send(msg_id)
