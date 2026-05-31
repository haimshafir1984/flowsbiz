import httpx
from typing import Dict, Any, List
import uuid
from app.ports.whatsapp_provider import WhatsAppProviderPort
from app.config import settings

class MetaWhatsAppProvider(WhatsAppProviderPort):
    
    async def send_template(
        self,
        to_phone: str,
        template_name: str,
        language: str,
        components: List[Dict[str, Any]],
        client_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        
        phone_number_id = client_config.get("meta_phone_number_id")
        access_token = client_config.get("meta_permanent_access_token")
        
        # Validation check / Mock fallback for development ease
        if not phone_number_id or not access_token or access_token.startswith("mock_"):
            # Generates a standard wamid string format for testing
            mock_wamid = f"wamid.HBgL{uuid.uuid4().hex[:16].upper()}="
            return {
                "wamid": mock_wamid,
                "status": "mock_sent",
                "details": f"Development simulation: sent '{template_name}' to {to_phone}"
            }
            
        url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language
                }
            }
        }
        
        if components:
            payload["template"]["components"] = components
            
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(url, json=payload, headers=headers, timeout=10.0)
                res_data = res.json()
                
                if res.status_code == 200:
                    messages = res_data.get("messages", [])
                    if messages:
                        return {"wamid": messages[0].get("id"), "status": "sent"}
                    raise ValueError("Meta API responded with 200 but no message IDs were returned.")
                
                error_detail = res_data.get("error", {})
                raise ValueError(
                    f"Meta Cloud API failure (HTTP {res.status_code}): {error_detail.get('message', 'Unknown Error')}"
                )
            except httpx.HTTPError as http_err:
                raise RuntimeError(f"Network transport error calling Meta: {str(http_err)}")

    def verify_webhook(self, hub_mode: str, hub_token: str, hub_challenge: str) -> str:
        if hub_mode == "subscribe" and hub_token == settings.META_VERIFY_TOKEN:
            return hub_challenge
        raise ValueError("Invalid verification token or missing parameters")
