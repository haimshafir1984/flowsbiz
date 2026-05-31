from abc import ABC, abstractmethod
from typing import Dict, Any, List

class WhatsAppProviderPort(ABC):
    
    @abstractmethod
    async def send_template(
        self,
        to_phone: str,
        template_name: str,
        language: str,
        components: List[Dict[str, Any]],
        client_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Sends a WhatsApp Template message using Meta's Cloud API.
        
        Args:
            to_phone: The recipient's phone number in E.164 format.
            template_name: The registered Meta template name.
            language: The language code (e.g., 'he', 'en').
            components: Variable components for customization (parameters).
            client_config: Dict containing:
                - meta_phone_number_id
                - meta_permanent_access_token
                
        Returns:
            Dict containing the API response, e.g. {"wamid": "..."}
        """
        pass

    @abstractmethod
    def verify_webhook(self, hub_mode: str, hub_token: str, hub_challenge: str) -> str:
        """
        Verifies Meta's subscription webhook challenge.
        """
        pass
