import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()

class TelehealthConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        
        # Deny connection if user is anonymous
        if not self.user or self.user.is_anonymous:
            await self.close()
            return
            
        await self.accept()

    async def disconnect(self, close_code):
        # Clean up any subscribed rooms
        if hasattr(self, "session_group_name") and self.session_group_name:
            await self.channel_layer.group_discard(
                self.session_group_name,
                self.channel_name
            )

    async def receive_json(self, content):
        action = content.get("action")
        
        if action == "ping":
            await self.send_json({"action": "pong"})
            return
            
        if action == "subscribe":
            session_id = content.get("session_id")
            # Events carry participants' names and emails, so only people who
            # may see the session can listen to it. Any logged-in user used to
            # be able to subscribe to any session id.
            if session_id and not await self.may_follow(session_id):
                await self.send_json({"action": "error", "detail": "Session not found."})
                return
            if session_id:
                self.session_group_name = f"telehealth_{session_id}"
                await self.channel_layer.group_add(
                    self.session_group_name,
                    self.channel_name
                )
                await self.send_json({
                    "action": "subscribed",
                    "session_id": session_id
                })
                
        elif action == "unsubscribe":
            session_id = content.get("session_id")
            if session_id:
                group_name = f"telehealth_{session_id}"
                await self.channel_layer.group_discard(
                    group_name,
                    self.channel_name
                )

    @database_sync_to_async
    def may_follow(self, session_id) -> bool:
        from django.core.exceptions import ValidationError
        from naderk.telehealth.models import TelehealthSession
        from naderk.telehealth.services.session_lifecycle import can_view_session
        try:
            session = TelehealthSession.objects.select_related('appointment').get(id=session_id)
        except (TelehealthSession.DoesNotExist, ValidationError, ValueError):
            return False
        return can_view_session(session, self.user)

    # Event handlers called by channel layer
    async def session_started(self, event):
        await self.send_json({
            "action": "session_started",
            "session_id": event["session_id"],
            "started_at": event.get("started_at")
        })

    async def participant_joined(self, event):
        await self.send_json({
            "action": "participant_joined",
            "session_id": event["session_id"],
            "user": event["user"],
            "role": event["role"]
        })

    async def participant_left(self, event):
        await self.send_json({
            "action": "participant_left",
            "session_id": event["session_id"],
            "user": event["user"],
            "role": event["role"]
        })

    async def session_ended(self, event):
        await self.send_json({
            "action": "session_ended",
            "session_id": event["session_id"],
            "ended_at": event.get("ended_at")
        })
