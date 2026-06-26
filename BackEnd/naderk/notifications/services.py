from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification

def create_notification(*, user, title, message, conversation=None) -> Notification:
    """
    Creates a new database notification record and broadcasts it via WebSocket.
    """
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        conversation=conversation
    )
    
    # Broadcast notification event to user
    _broadcast_notification_ws(notification)
    
    return notification

def _broadcast_notification_ws(notification: Notification):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
        
    async_to_sync(channel_layer.group_send)(
        f"user_{notification.user.id}",
        {
            "type": "notification_received",
            "notification": {
                "id": str(notification.id),
                "title": notification.title,
                "message": notification.message,
                "is_read": notification.is_read,
                "conversation_id": str(notification.conversation.id) if notification.conversation else None,
                "created_at": notification.created_at.isoformat()
            }
        }
    )
