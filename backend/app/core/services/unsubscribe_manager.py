import uuid
from uuid import UUID
from datetime import datetime
from app.ports.repository import CampaignRepositoryPort
from app.core.models.audit import AuditLog

class UnsubscribeManager:
    def __init__(self, repo: CampaignRepositoryPort):
        self.repo = repo

    async def process_unsubscribe(self, client_id: UUID, phone_number: str) -> None:
        """
        Flow B (Step 6):
        Triggered when a user sends "הסר" / "Unsubscribe" or requests opt-out.
        Finds the contact, flips their status to 'revoked', logs the timestamp,
        and saves an audit event trace.
        """
        # Revoke the opt-in flag in the database
        await self.repo.revoke_contact_opt_in(client_id, phone_number)
        
        # Log active audit tracking event
        await self.repo.create_audit_log(
            AuditLog(
                id=uuid.uuid4(),
                client_id=client_id,
                action="CONTACT_OPT_OUT",
                actor="user",
                payload={"phone_number": phone_number, "reason": "Incoming message unsubscribe request"}
            )
        )
