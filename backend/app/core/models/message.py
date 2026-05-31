from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from typing import Optional

@dataclass
class Message:
    id: UUID
    client_id: UUID
    contact_id: UUID
    phone_number: str
    campaign_id: Optional[UUID] = None
    meta_message_id: Optional[str] = None
    status: str = "queued"  # queued, sent, delivered, read, failed, skipped_opt_out
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
