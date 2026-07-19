from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class Attachment:
    filename: str
    content: bytes
    content_type: str
    inline: bool = False
    content_id: Optional[str] = None


@dataclass
class EmailMessage:
    to: List[str]
    subject: str
    html_body: str
    text_body: str = ''
    from_email: Optional[str] = None
    reply_to: Optional[str] = None
    cc: List[str] = field(default_factory=list)
    bcc: List[str] = field(default_factory=list)
    attachments: List[Attachment] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    message_stream: Optional[str] = None
    track_opens: bool = True
    track_links: bool = True
    # Set by the service layer before dispatch — providers store this on the log
    log_id: Optional[str] = None


class EmailProvider(ABC):
    """Abstract interface every email provider must implement."""

    @abstractmethod
    def send(self, message: EmailMessage) -> str:
        """
        Send a single message.
        Returns the provider's message ID (for delivery tracking).
        Raises EmailDeliveryError or EmailProviderError on failure.
        """

    def send_bulk(self, messages: List[EmailMessage]) -> List[str]:
        """
        Send multiple messages. Default: sequential loop.
        Providers may override with a native batch API.
        Returns list of provider message IDs in the same order.
        """
        return [self.send(msg) for msg in messages]

    def get_delivery_status(self, provider_message_id: str) -> Optional[str]:
        """
        Query provider for current delivery status of a sent message.
        Returns a status string or None if not supported.
        """
        return None

    def validate_configuration(self) -> None:
        """
        Verify required credentials / settings are present.
        Raises EmailConfigurationError if anything is missing.
        """
