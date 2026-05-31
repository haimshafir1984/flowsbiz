from uuid import UUID
from typing import List, Optional
import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.ports.repository import CampaignRepositoryPort

from app.core.models.client import Client
from app.core.models.contact import Contact
from app.core.models.campaign import Campaign
from app.core.models.message import Message
from app.core.models.audit import AuditLog

from app.adapters.database.models import ClientORM, ContactORM, CampaignORM, MessageORM, AuditLogORM

class SqlCampaignRepository(CampaignRepositoryPort):
    def __init__(self, session: AsyncSession):
        self.session = session

    # Helpers to translate ORM to Domain
    def _to_client_domain(self, orm: ClientORM) -> Client:
        return Client(
            id=orm.id, name=orm.name, company_registration_number=orm.company_registration_number,
            website=orm.website, meta_waba_id=orm.meta_waba_id, meta_phone_number_id=orm.meta_phone_number_id,
            meta_permanent_access_token=orm.meta_permanent_access_token, status=orm.status,
            created_at=orm.created_at, updated_at=orm.updated_at
        )

    def _to_contact_domain(self, orm: ContactORM) -> Contact:
        return Contact(
            id=orm.id, client_id=orm.client_id, phone_number=orm.phone_number,
            first_name=orm.first_name, last_name=orm.last_name, custom_attributes=orm.custom_attributes,
            opt_in_status=orm.opt_in_status, opt_in_source=orm.opt_in_source,
            opt_in_date=orm.opt_in_date, created_at=orm.created_at
        )

    def _to_campaign_domain(self, orm: CampaignORM) -> Campaign:
        return Campaign(
            id=orm.id, client_id=orm.client_id, name=orm.name,
            template_name=orm.template_name, template_language=orm.template_language,
            status=orm.status, scheduled_at=orm.scheduled_at, started_at=orm.started_at,
            completed_at=orm.completed_at, total_contacts_count=orm.total_contacts_count,
            sent_count=orm.sent_count, delivered_count=orm.delivered_count,
            read_count=orm.read_count, failed_count=orm.failed_count
        )

    def _to_message_domain(self, orm: MessageORM) -> Message:
        return Message(
            id=orm.id, client_id=orm.client_id, contact_id=orm.contact_id, phone_number=orm.phone_number,
            campaign_id=orm.campaign_id, meta_message_id=orm.meta_message_id, status=orm.status,
            error_code=orm.error_code, error_message=orm.error_message,
            sent_at=orm.sent_at, delivered_at=orm.delivered_at, read_at=orm.read_at
        )

    # Port implementations
    async def get_client(self, client_id: UUID) -> Optional[Client]:
        stmt = select(ClientORM).where(ClientORM.id == client_id)
        res = await self.session.execute(stmt)
        orm = res.scalar_one_or_none()
        return self._to_client_domain(orm) if orm else None

    async def get_campaign(self, campaign_id: UUID) -> Optional[Campaign]:
        stmt = select(CampaignORM).where(CampaignORM.id == campaign_id)
        res = await self.session.execute(stmt)
        orm = res.scalar_one_or_none()
        return self._to_campaign_domain(orm) if orm else None

    async def update_campaign_status(self, campaign_id: UUID, status: str) -> None:
        stmt = update(CampaignORM).where(CampaignORM.id == campaign_id).values(status=status)
        now = datetime.datetime.utcnow()
        if status == "processing":
            stmt = stmt.values(started_at=now)
        elif status in ("completed", "failed"):
            stmt = stmt.values(completed_at=now)
        await self.session.execute(stmt)
        await self.session.commit()

    async def get_active_contacts(self, client_id: UUID) -> List[Contact]:
        stmt = select(ContactORM).where(
            ContactORM.client_id == client_id,
            ContactORM.opt_in_status == "granted"
        )
        res = await self.session.execute(stmt)
        orms = res.scalars().all()
        return [self._to_contact_domain(o) for o in orms]

    async def create_contacts_batch(self, contacts: List[Contact]) -> None:
        orms = [
            ContactORM(
                id=c.id,
                client_id=c.client_id,
                phone_number=c.phone_number,
                first_name=c.first_name,
                last_name=c.last_name,
                custom_attributes=c.custom_attributes,
                opt_in_status=c.opt_in_status,
                opt_in_source=c.opt_in_source,
                opt_in_date=c.opt_in_date,
                created_at=c.created_at
            )
            for c in contacts
        ]
        self.session.add_all(orms)
        await self.session.commit()

    async def create_message_log(self, message: Message) -> None:
        orm = MessageORM(
            id=message.id, client_id=message.client_id, campaign_id=message.campaign_id,
            contact_id=message.contact_id, phone_number=message.phone_number,
            status=message.status
        )
        self.session.add(orm)
        await self.session.commit()

    async def get_message_by_id(self, message_id: UUID) -> Optional[Message]:
        stmt = select(MessageORM).where(MessageORM.id == message_id)
        res = await self.session.execute(stmt)
        orm = res.scalar_one_or_none()
        return self._to_message_domain(orm) if orm else None

    async def get_message_by_wamid(self, wamid: str) -> Optional[Message]:
        stmt = select(MessageORM).where(MessageORM.meta_message_id == wamid)
        res = await self.session.execute(stmt)
        orm = res.scalar_one_or_none()
        return self._to_message_domain(orm) if orm else None

    async def update_message_status(
        self, 
        message_id: UUID, 
        status: str, 
        meta_message_id: Optional[str] = None,
        error_code: Optional[str] = None, 
        error_message: Optional[str] = None
    ) -> None:
        stmt = update(MessageORM).where(MessageORM.id == message_id).values(status=status)
        if meta_message_id:
            stmt = stmt.values(meta_message_id=meta_message_id)
        if error_code:
            stmt = stmt.values(error_code=error_code, error_message=error_message)
        
        now = datetime.datetime.utcnow()
        if status == "sent":
            stmt = stmt.values(sent_at=now)
        elif status == "delivered":
            stmt = stmt.values(delivered_at=now)
        elif status == "read":
            stmt = stmt.values(read_at=now)
            
        await self.session.execute(stmt)
        await self.session.commit()

    async def increment_campaign_counter(self, campaign_id: UUID, counter_name: str) -> None:
        stmt = update(CampaignORM).where(CampaignORM.id == campaign_id)
        if counter_name == "sent_count":
            stmt = stmt.values(sent_count=CampaignORM.sent_count + 1)
        elif counter_name == "delivered_count":
            stmt = stmt.values(delivered_count=CampaignORM.delivered_count + 1)
        elif counter_name == "read_count":
            stmt = stmt.values(read_count=CampaignORM.read_count + 1)
        elif counter_name == "failed_count":
            stmt = stmt.values(failed_count=CampaignORM.failed_count + 1)
            
        await self.session.execute(stmt)
        await self.session.commit()

    async def revoke_contact_opt_in(self, client_id: UUID, phone_number: str) -> None:
        stmt = update(ContactORM).where(
            ContactORM.client_id == client_id,
            ContactORM.phone_number == phone_number
        ).values(opt_in_status="revoked", opt_in_date=datetime.datetime.utcnow())
        await self.session.execute(stmt)
        await self.session.commit()

    async def create_audit_log(self, audit: AuditLog) -> None:
        orm = AuditLogORM(
            id=audit.id, client_id=audit.client_id, action=audit.action,
            actor=audit.actor, payload=audit.payload, timestamp=audit.timestamp
        )
        self.session.add(orm)
        await self.session.commit()
