from abc import ABC, abstractmethod
from uuid import UUID

class QueueProviderPort(ABC):
    
    @abstractmethod
    def enqueue_campaign_processing(self, campaign_id: UUID) -> None:
        """
        Enqueues a job to fetch contacts and prepare the sending sequence for a Campaign.
        """
        pass

    @abstractmethod
    def enqueue_single_message_send(self, message_id: UUID) -> None:
        """
        Enqueues a single message transmission worker task.
        """
        pass
