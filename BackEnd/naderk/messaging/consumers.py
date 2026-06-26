import json
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Q
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

from .models import Conversation, Message, MessageRead, ConversationParticipant, ConversationStatus

User = get_user_model()

class MessagingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        
        # Deny connection if user is anonymous
        if not self.user or self.user.is_anonymous:
            await self.close()
            return
            
        self.user_group_name = f"user_{self.user.id}"
        
        # Join user-specific group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        # If staff, join medical care team group
        self.is_staff = self.user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
        if self.is_staff:
            await self.channel_layer.group_add(
                "medical_care_team",
                self.channel_name
            )
            
        # Set online status in cache (5 minutes expiration)
        await self.set_online_status(True)
        
        await self.accept()
        
        # Broadcast staff status if staff member connected
        if self.is_staff:
            await self.broadcast_care_team_status(True)

    async def disconnect(self, close_code):
        if hasattr(self, "user") and self.user and not self.user.is_anonymous:
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
            
            if self.is_staff:
                await self.channel_layer.group_discard(
                    "medical_care_team",
                    self.channel_name
                )
                
            await self.set_online_status(False)
            
            # Broadcast status updates if staff disconnected
            if self.is_staff:
                await self.broadcast_care_team_status(False)

    async def receive_json(self, content):
        action = content.get("action")
        
        if action == "ping":
            await self.send_json({"action": "pong"})
            # Extend online status
            await self.set_online_status(True)
            return
            
        if action == "subscribe":
            conversation_id = content.get("conversation_id")
            if conversation_id:
                # Add to room group
                await self.channel_layer.group_add(
                    f"conversation_{conversation_id}",
                    self.channel_name
                )
                await self.send_json({
                    "action": "subscribed",
                    "conversation_id": conversation_id
                })
                
        elif action == "unsubscribe":
            conversation_id = content.get("conversation_id")
            if conversation_id:
                await self.channel_layer.group_discard(
                    f"conversation_{conversation_id}",
                    self.channel_name
                )
                
        elif action == "typing":
            conversation_id = content.get("conversation_id")
            is_typing = content.get("is_typing", False)
            if conversation_id:
                await self.handle_typing_status(conversation_id, is_typing)
                
        elif action == "read":
            conversation_id = content.get("conversation_id")
            if conversation_id:
                await self.mark_conversation_read(conversation_id)

    # Event handlers called by channel layer
    async def chat_message(self, event):
        await self.send_json({
            "action": "message",
            "message": event["message"]
        })

    async def internal_note(self, event):
        # Internal notes are strictly for staff
        if self.is_staff:
            await self.send_json({
                "action": "internal_note",
                "note": event["note"]
            })

    async def conversation_update(self, event):
        await self.send_json({
            "action": "conversation_update",
            "conversation": event["conversation"]
        })

    async def conversation_details_update(self, event):
        await self.send_json({
            "action": "conversation_details_update",
            "conversation": event["conversation"]
        })

    async def typing_status_update(self, event):
        # Don't echo typing status back to the sender
        if event["sender_id"] != str(self.user.id):
            await self.send_json({
                "action": "typing",
                "conversation_id": event["conversation_id"],
                "is_typing": event["is_typing"]
            })

    async def care_team_status_update(self, event):
        await self.send_json({
            "action": "care_team_status",
            "is_online": event["is_online"]
        })

    async def notification_received(self, event):
        await self.send_json({
            "action": "notification_received",
            "notification": event["notification"]
        })

    # Helper methods
    @database_sync_to_async
    def set_online_status(self, is_online):
        cache_key = f"user_online_{self.user.id}"
        if is_online:
            cache.set(cache_key, True, timeout=300) # 5 mins
            cache.set(f"user_last_seen_{self.user.id}", timezone.now(), timeout=86400) # 24 hrs
        else:
            cache.delete(cache_key)

    @database_sync_to_async
    def is_care_team_online(self):
        # Checks if any active agent or doctor is connected
        staff_users = User.objects.filter(
            Q(role=User.Role.AGENT) | Q(role=User.Role.DOCTOR) | Q(role=User.Role.ADMIN),
            is_active=True
        )
        for staff in staff_users:
            if cache.get(f"user_online_{staff.id}"):
                return True
        return False

    async def broadcast_care_team_status(self, connected):
        online = await self.is_care_team_online()
        # Broadcast to all connected clients
        await self.channel_layer.group_send(
            "medical_care_team_broadcast", # Custom group for patient updates
            {
                "type": "care_team_status_update",
                "is_online": online
            }
        )

    async def handle_typing_status(self, conversation_id, is_typing):
        # Find recipient user ID in database
        recipient_id = await self.get_conversation_recipient_id(conversation_id)
        if recipient_id:
            # Send directly to the other user's group
            await self.channel_layer.group_send(
                f"user_{recipient_id}",
                {
                    "type": "typing_status_update",
                    "conversation_id": conversation_id,
                    "sender_id": str(self.user.id),
                    "is_typing": is_typing
                }
            )

    @database_sync_to_async
    def get_conversation_recipient_id(self, conversation_id):
        try:
            conv = Conversation.objects.get(id=conversation_id)
            if self.is_staff:
                # If staff, recipient is the patient
                return str(conv.patient.id)
            else:
                # If patient, recipient is the assigned agent/doctor
                if conv.assigned_agent:
                    return str(conv.assigned_agent.id)
                elif conv.assigned_doctor:
                    return str(conv.assigned_doctor.id)
        except Conversation.DoesNotExist:
            pass
        return None

    @database_sync_to_async
    def mark_conversation_read(self, conversation_id):
        try:
            conv = Conversation.objects.get(id=conversation_id)
            unread_msgs = Message.objects.filter(
                conversation=conv,
                is_archived=False
            ).exclude(
                sender=self.user
            ).exclude(
                reads__user=self.user
            )
            if unread_msgs.exists():
                read_records = [MessageRead(message=m, user=self.user) for m in unread_msgs]
                MessageRead.objects.bulk_create(read_records, ignore_conflicts=True)
        except Conversation.DoesNotExist:
            pass
