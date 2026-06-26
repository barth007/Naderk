from django.urls import path
from naderk.telehealth.apis import (
    SessionListApi, 
    SessionDetailApi, 
    JoinSessionApi, 
    SessionCreateApi, 
    SessionCompleteApi
)

urlpatterns = [
    path('sessions/', SessionListApi.as_view(), name='session-list'),
    path('sessions/<uuid:pk>/', SessionDetailApi.as_view(), name='session-detail'),
    path('sessions/<uuid:pk>/join/', JoinSessionApi.as_view(), name='session-join-pk'),
    path('session/', SessionCreateApi.as_view(), name='session-create'),
    path('session/<uuid:pk>/complete/', SessionCompleteApi.as_view(), name='session-complete'),
    path('token/', JoinSessionApi.as_view(), name='session-token'),
]
