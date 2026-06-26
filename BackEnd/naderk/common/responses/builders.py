from rest_framework.response import Response

def build_success_response(message: str, data: dict = None, status_code: int = 200) -> Response:
    """
    Builds a standardized success response.
    """
    payload = {
        "success": True,
        "message": message,
    }
    if data is not None:
        payload["data"] = data
        
    return Response(payload, status=status_code)

def build_error_response(
    type_uri: str, 
    title: str, 
    status_code: int, 
    detail: str, 
    instance: str = None, 
    errors: dict = None
) -> Response:
    """
    Builds a standardized RFC7807 problem details error response.
    """
    payload = {
        "type": type_uri,
        "title": title,
        "status": status_code,
        "detail": detail,
    }
    
    if instance:
        payload["instance"] = instance
        
    if errors:
        payload["errors"] = errors
        
    return Response(payload, status=status_code)
