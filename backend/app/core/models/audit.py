from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from typing import Dict, Any

@dataclass
class AuditLog:
    id: UUID
    client_id: UUID
    action: str
    actor: str  # user, system
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
