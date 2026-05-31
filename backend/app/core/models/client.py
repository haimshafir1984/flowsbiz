from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    CLIENT = "CLIENT"

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

@dataclass
class User:
    id: UUID
    username: str
    role: UserRole
    client_id: UUID | None = None  # None for ADMIN users, ForeignKey for CLIENT users

