from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from typing import Optional

@dataclass
class Campaign:
    id: UUID
    client_id: UUID
    name: str
    template_name: str
    template_language: str
    status: str = "draft"  # draft, scheduled, processing, completed, failed
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_contacts_count: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    read_count: int = 0
    failed_count: int = 0
