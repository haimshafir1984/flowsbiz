from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from typing import Dict, Any

@dataclass
class Contact:
    id: UUID
    client_id: UUID
    phone_number: str  # E.164
    first_name: str
    last_name: str
    custom_attributes: Dict[str, Any] = field(default_factory=dict)
    opt_in_status: str = "granted"  # granted, revoked
    opt_in_source: str = "import"
    opt_in_date: datetime = field(default_factory=datetime.utcnow)
    created_at: datetime = field(default_factory=datetime.utcnow)
