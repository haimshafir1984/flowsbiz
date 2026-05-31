from abc import ABC, abstractmethod
from uuid import UUID
from typing import List, Optional, Dict, Any
from app.core.models.client import Client
from app.core.models.contact import Contact
from app.core.models.campaign import Campaign
from app.core.models.message import Message
from app.core.models.audit import AuditLog

class CampaignRepositoryPort(ABC):
    
    @abstractmethod
    async def get_client(self, client_id: UUID) -> Optional[Client]:
        """Fetch client profile settings."""
        pass
        
    @abstractmethod
    async def get_campaign(self, campaign_id: UUID) -> Optional[Campaign]:
        """Fetch campaign metadata."""
        pass
        
    @abstractmethod
    async def update_campaign_status(self, campaign_id: UUID, status: str) -> None:
        """Atomically update a campaign's operational status."""
        pass

    @abstractmethod
    async def get_active_contacts(self, client_id: UUID) -> List[Contact]:
        """Fetch all contacts under the tenant whose opt-in is granted."""
        pass

    @abstractmethod
    async def create_contacts_batch(self, contacts: List[Contact]) -> None:
        """Optimized batch insertion of multiple contact profiles."""
        pass

    @abstractmethod
    async def create_message_log(self, message: Message) -> None:
        """Insert a new message transmission log."""
        pass

    @abstractmethod
    async def get_message_by_id(self, message_id: UUID) -> Optional[Message]:
        """Fetch message log by UUID."""
        pass

    @abstractmethod
    async def get_message_by_wamid(self, wamid: str) -> Optional[Message]:
        """Fetch message log by Meta Message ID."""
        pass

    @abstractmethod
    async def update_message_status(
        self, 
        message_id: UUID, 
        status: str, 
        meta_message_id: Optional[str] = None,
        error_code: Optional[str] = None, 
        error_message: Optional[str] = None
    ) -> None:
        """Update individual message tracking status and record timestamps."""
        pass

    @abstractmethod
    async def increment_campaign_counter(self, campaign_id: UUID, counter_name: str) -> None:
        """Atomically increment a specific counter on a Campaign (e.g. sent_count, read_count)."""
        pass

    @abstractmethod
    async def revoke_contact_opt_in(self, client_id: UUID, phone_number: str) -> None:
        """Flip a contact's opt_in_status to 'revoked'."""
        pass

    @abstractmethod
    async def create_audit_log(self, audit: AuditLog) -> None:
        """Save a new audit trace."""
        pass
