from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, Dict, Any

class ClientCreateSchema(BaseModel):
    name: str
    company_registration_number: str
    website: str
    meta_waba_id: str
    meta_phone_number_id: str
    meta_permanent_access_token: str
    status: Optional[str] = "active"

class ContactCreateSchema(BaseModel):
    phone_number: str = Field(..., description="E.164 phone format, e.g. +972500000000")
    first_name: str
    last_name: str
    custom_attributes: Optional[Dict[str, Any]] = None

class CampaignCreateSchema(BaseModel):
    client_id: UUID
    name: str
    template_name: str
    template_language: str = "he"
