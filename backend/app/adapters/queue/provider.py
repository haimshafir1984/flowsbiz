from uuid import UUID
from app.ports.queue_provider import QueueProviderPort

class CeleryQueueProvider(QueueProviderPort):
    def enqueue_campaign_processing(self, campaign_id: UUID) -> None:
        # Import Celery task dynamically to avoid circular imports
        from app.adapters.queue.tasks import process_campaign_task
        process_campaign_task.delay(str(campaign_id))

    def enqueue_single_message_send(self, message_id: UUID) -> None:
        # Import Celery task dynamically to avoid circular imports
        from app.adapters.queue.tasks import send_single_message_task
        send_single_message_task.delay(str(message_id))
