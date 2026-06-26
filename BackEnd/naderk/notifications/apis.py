from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from naderk.common.responses.builders import build_success_response, build_error_response
from .models import Notification
from .selectors import get_all_notifications, get_unread_notifications
from .serializers import NotificationSerializer

class NotificationListApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        notifications = get_all_notifications(request.user)
        unread_count = get_unread_notifications(request.user).count()
        serializer = NotificationSerializer(notifications, many=True)
        return build_success_response("Notifications retrieved successfully", {
            "results": serializer.data,
            "unread_count": unread_count
        })
        
    def post(self, request):
        # Mark all as read
        unread = get_unread_notifications(request.user)
        unread_count = unread.count()
        unread.update(is_read=True)
        return build_success_response(f"Marked {unread_count} notifications as read", None)

class NotificationReadApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return build_success_response("Notification marked as read", NotificationSerializer(notification).data)
        except Notification.DoesNotExist:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found",
                status_code=404,
                detail="Notification not found",
                instance=request.path
            )
