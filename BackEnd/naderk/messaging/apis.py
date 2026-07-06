from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

from naderk.common.responses.builders import build_success_response, build_error_response
from .models import Conversation, Message, MessageRead, ConversationParticipant
from .selectors import (
    get_user_conversations, 
    get_conversation_messages, 
    get_conversation_activities, 
    get_conversation_internal_notes
)
from .serializers import (
    ConversationSerializer, 
    MessageSerializer, 
    InternalNoteSerializer, 
    ConversationActivitySerializer,
    CreateConversationSerializer, 
    CreateMessageSerializer, 
    CreateInternalNoteSerializer, 
    AssignConversationSerializer
)
from .services import (
    create_conversation, 
    send_message, 
    create_internal_note, 
    assign_conversation, 
    resolve_conversation, 
    upload_attachment
)

User = get_user_model()

class ConversationListCreateApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        conversations = get_user_conversations(request.user)
        serializer = ConversationSerializer(conversations, many=True, context={'request': request})
        return build_success_response("Conversations retrieved successfully", {"results": serializer.data})
        
    def post(self, request):
        if request.user.role != User.Role.PATIENT:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Access Denied",
                status_code=403,
                detail="Only patients can initiate conversations.",
                instance=request.path
            )
            
        serializer = CreateConversationSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="One or more validation errors occurred.",
                instance=request.path,
                errors=serializer.errors
            )
            
        data = serializer.validated_data
        
        try:
            conversation = create_conversation(
                patient=request.user,
                category=data['category'],
                subject=data.get('subject', ''),
                initial_message=data['message'],
                attachment_url=data.get('attachment_url'),
                related_appointment_id=data.get('related_appointment_id')
            )
            
            response_serializer = ConversationSerializer(conversation, context={'request': request})
            return build_success_response(
                message="Conversation created successfully",
                data=response_serializer.data,
                status_code=201
            )
        except Exception as e:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/bad-request",
                title="Bad Request",
                status_code=400,
                detail=str(e),
                instance=request.path
            )

class ConversationDetailApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            conversation = Conversation.objects.get(id=pk)
        except Conversation.DoesNotExist:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found",
                status_code=404,
                detail="Conversation not found",
                instance=request.path
            )
            
        is_staff = request.user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
        has_access = is_staff or conversation.patient == request.user or conversation.participants.filter(user=request.user).exists()
        
        if not has_access:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Access Denied",
                status_code=403,
                detail="You do not have access to this conversation.",
                instance=request.path
            )
            
        # 1. Mark unread messages as read
        unread_msgs = Message.objects.filter(
            conversation=conversation, 
            is_archived=False
        ).exclude(
            sender=request.user
        ).exclude(
            reads__user=request.user
        )
        
        if unread_msgs.exists():
            with transaction.atomic():
                read_records = [MessageRead(message=m, user=request.user) for m in unread_msgs]
                MessageRead.objects.bulk_create(read_records, ignore_conflicts=True)
                
        # 2. Serialize payloads
        messages = get_conversation_messages(conversation, request.user)
        activities = get_conversation_activities(conversation, request.user)
        
        notes_data = []
        if is_staff:
            notes = get_conversation_internal_notes(conversation, request.user)
            notes_data = InternalNoteSerializer(notes, many=True).data
            
        conv_serialized = ConversationSerializer(conversation, context={'request': request}).data
        messages_serialized = MessageSerializer(messages, many=True, context={'request': request}).data
        activities_serialized = ConversationActivitySerializer(activities, many=True).data
        
        return build_success_response("Conversation details retrieved", {
            "conversation": conv_serialized,
            "messages": messages_serialized,
            "activities": activities_serialized,
            "internal_notes": notes_data
        })

class MessageCreateApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            conversation = Conversation.objects.get(id=pk)
        except Conversation.DoesNotExist:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found",
                status_code=404,
                detail="Conversation not found",
                instance=request.path
            )
            
        is_staff = request.user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
        has_access = is_staff or conversation.patient == request.user or conversation.participants.filter(user=request.user).exists()
        
        if not has_access:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Access Denied",
                status_code=403,
                detail="You do not have access to this conversation.",
                instance=request.path
            )
            
        serializer = CreateMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="One or more validation errors occurred.",
                instance=request.path,
                errors=serializer.errors
            )
            
        try:
            message = send_message(
                conversation=conversation,
                sender=request.user,
                content=serializer.validated_data['content'],
                attachment_url=serializer.validated_data.get('attachment_url')
            )
            
            response_serializer = MessageSerializer(message, context={'request': request})
            return build_success_response("Message sent successfully", response_serializer.data, 201)
        except Exception as e:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/bad-request",
                title="Bad Request",
                status_code=400,
                detail=str(e),
                instance=request.path
            )

class AttachmentUploadApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        if 'file' not in request.FILES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/bad-request",
                title="Bad Request",
                status_code=400,
                detail="No file uploaded.",
                instance=request.path
            )
            
        uploaded_file = request.FILES['file']
        
        # Validations
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.pdf']
        import os
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in allowed_extensions:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="File type not supported. Allowed formats: JPG, PNG, PDF.",
                instance=request.path
            )
            
        max_size = 5 * 1024 * 1024 # 5MB
        if uploaded_file.size > max_size:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="File is too large. Max size is 5MB.",
                instance=request.path
            )
            
        try:
            url = upload_attachment(uploaded_file)
            return build_success_response("File uploaded successfully", {"url": url})
        except Exception as e:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/storage-error",
                title="Storage Upload Error",
                status_code=500,
                detail=str(e),
                instance=request.path
            )

class ConversationAssignApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        TRIAGE_ROLES = {User.Role.MEDICAL_AGENT, User.Role.AGENT, User.Role.ADMIN, User.Role.SUPER_ADMIN}
        if request.user.role not in TRIAGE_ROLES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Access Denied",
                status_code=403,
                detail="Only clinical staff can assign conversations.",
                instance=request.path
            )
            
        try:
            conversation = Conversation.objects.get(id=pk)
        except Conversation.DoesNotExist:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found",
                status_code=404,
                detail="Conversation not found",
                instance=request.path
            )
            
        serializer = AssignConversationSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="Invalid assignment fields.",
                instance=request.path,
                errors=serializer.errors
            )
            
        data = serializer.validated_data
        
        agent = None
        if 'assigned_agent_id' in data:
            if data['assigned_agent_id'] is None:
                conversation.assigned_agent = None
            else:
                try:
                    agent = User.objects.get(id=data['assigned_agent_id'], role__in=[User.Role.MEDICAL_AGENT, User.Role.AGENT, User.Role.ADMIN])
                except User.DoesNotExist:
                    return build_error_response(
                        type_uri="https://api.naderkeye.com/problems/not-found",
                        title="Not Found",
                        status_code=400,
                        detail="Selected agent not found.",
                        instance=request.path
                    )
                    
        doctor = None
        if 'assigned_doctor_id' in data:
            if data['assigned_doctor_id'] is None:
                conversation.assigned_doctor = None
            else:
                try:
                    doctor = User.objects.get(id=data['assigned_doctor_id'], role=User.Role.DOCTOR)
                except User.DoesNotExist:
                    return build_error_response(
                        type_uri="https://api.naderkeye.com/problems/not-found",
                        title="Not Found",
                        status_code=400,
                        detail="Selected doctor not found.",
                        instance=request.path
                    )
                    
        try:
            conversation = assign_conversation(
                conversation=conversation,
                actor=request.user,
                agent=agent,
                doctor=doctor,
                department=data.get('department'),
                status=data.get('status'),
                priority=data.get('priority'),
                reason=data.get('reason')
            )
        except Exception as e:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/bad-request",
                title="Bad Request",
                status_code=400,
                detail=str(e),
                instance=request.path
            )
        
        return build_success_response("Conversation updated successfully", ConversationSerializer(conversation, context={'request': request}).data)

class ConversationInternalNotesApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        is_staff = request.user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
        if not is_staff:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Access Denied",
                status_code=403,
                detail="Only staff can view internal notes.",
                instance=request.path
            )
            
        try:
            conversation = Conversation.objects.get(id=pk)
            notes = get_conversation_internal_notes(conversation, request.user)
            serializer = InternalNoteSerializer(notes, many=True)
            return build_success_response("Notes retrieved", {"results": serializer.data})
        except Exception as e:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/bad-request",
                title="Bad Request",
                status_code=400,
                detail=str(e),
                instance=request.path
            )
            
    def post(self, request, pk):
        is_staff = request.user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
        if not is_staff:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Access Denied",
                status_code=403,
                detail="Only staff can create internal notes.",
                instance=request.path
            )
            
        try:
            conversation = Conversation.objects.get(id=pk)
        except Conversation.DoesNotExist:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found",
                status_code=404,
                detail="Conversation not found",
                instance=request.path
            )
            
        serializer = CreateInternalNoteSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="Validation failed",
                instance=request.path,
                errors=serializer.errors
            )
            
        note = create_internal_note(
            conversation=conversation,
            author=request.user,
            content=serializer.validated_data['content']
        )
        
        return build_success_response("Note added successfully", InternalNoteSerializer(note).data, 201)
