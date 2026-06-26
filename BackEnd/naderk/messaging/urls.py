from django.urls import path
from . import apis

urlpatterns = [
    path('conversations/', apis.ConversationListCreateApi.as_view(), name='conversations-list-create'),
    path('conversations/<uuid:pk>/', apis.ConversationDetailApi.as_view(), name='conversations-detail'),
    path('conversations/<uuid:pk>/message/', apis.MessageCreateApi.as_view(), name='message-create'),
    path('conversations/<uuid:pk>/assign/', apis.ConversationAssignApi.as_view(), name='conversation-assign'),
    path('conversations/<uuid:pk>/notes/', apis.ConversationInternalNotesApi.as_view(), name='conversation-notes'),
    path('upload/', apis.AttachmentUploadApi.as_view(), name='attachment-upload'),
]
