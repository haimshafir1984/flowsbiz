from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

@dataclass
class Client:
    id: UUID
    name: str
    company_registration_number: str
    website: str
    meta_waba_id: str
    meta_phone_number_id: str
    meta_permanent_access_token: str
    status: str  # active, suspended
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
