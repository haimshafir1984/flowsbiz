from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Boolean, DateTime, ForeignKey, JSON, UUID
import datetime
from uuid import UUID as PyUUID

class Base(DeclarativeBase):
    pass

class ClientORM(Base):
    __tablename__ = "clients"
    
    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    company_registration_number: Mapped[str] = mapped_column(String(100))
    website: Mapped[str] = mapped_column(String(255))
    meta_waba_id: Mapped[str] = mapped_column(String(255))
    meta_phone_number_id: Mapped[str] = mapped_column(String(255))
    meta_permanent_access_token: Mapped[str] = mapped_column(String(1024))
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class ContactORM(Base):
    __tablename__ = "contacts"
    
    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    client_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), index=True)
    phone_number: Mapped[str] = mapped_column(String(50), index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    custom_attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    opt_in_status: Mapped[str] = mapped_column(String(50), default="granted")
    opt_in_source: Mapped[str] = mapped_column(String(100), default="import")
    opt_in_date: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

class CampaignORM(Base):
    __tablename__ = "campaigns"
    
    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    client_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    template_name: Mapped[str] = mapped_column(String(255))
    template_language: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="draft")
    scheduled_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    total_contacts_count: Mapped[int] = mapped_column(default=0)
    sent_count: Mapped[int] = mapped_column(default=0)
    delivered_count: Mapped[int] = mapped_column(default=0)
    read_count: Mapped[int] = mapped_column(default=0)
    failed_count: Mapped[int] = mapped_column(default=0)

class MessageORM(Base):
    __tablename__ = "messages"
    
    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    client_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"))
    campaign_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    contact_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    phone_number: Mapped[str] = mapped_column(String(50))
    meta_message_id: Mapped[str] = mapped_column(String(255), nullable=True, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued")
    error_code: Mapped[str] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str] = mapped_column(String(500), nullable=True)
    sent_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    read_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)

class AuditLogORM(Base):
    __tablename__ = "audit_logs"
    
    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    client_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"))
    action: Mapped[str] = mapped_column(String(255))
    actor: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
