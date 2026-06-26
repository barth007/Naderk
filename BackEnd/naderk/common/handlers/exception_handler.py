from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError, APIException
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404

from naderk.common.exceptions.base import BaseCustomException
from naderk.common.responses.builders import build_error_response

def custom_exception_handler(exc, context):
    """
    Global exception handler that normalizes all errors to RFC7807 problem details format.
    """
    # Call REST framework's default exception handler first to get the standard error response.
    response = exception_handler(exc, context)
    
    # Extract instance if available
    instance = None
    if context and 'request' in context:
        instance = context['request'].path

    if isinstance(exc, BaseCustomException):
        return build_error_response(
            type_uri=exc.type_uri,
            title=exc.title,
            status_code=exc.status_code,
            detail=exc.detail,
            instance=instance,
            errors=exc.errors
        )

    if isinstance(exc, (ValidationError, DjangoValidationError)):
        # Normalize validation errors
        errors = {}
        if hasattr(exc, 'detail'):
            if isinstance(exc.detail, dict):
                errors = exc.detail
            elif isinstance(exc.detail, list):
                errors = {"non_field_errors": exc.detail}
            else:
                errors = {"non_field_errors": [str(exc.detail)]}
        elif hasattr(exc, 'message_dict'):
            errors = exc.message_dict
        elif hasattr(exc, 'messages'):
            errors = {"non_field_errors": exc.messages}

        return build_error_response(
            type_uri='https://api.naderkeye.com/problems/validation-error',
            title='Validation Error',
            status_code=400,
            detail='One or more validation errors occurred.',
            instance=instance,
            errors=errors
        )
        
    if isinstance(exc, Http404):
        return build_error_response(
            type_uri='https://api.naderkeye.com/problems/not-found',
            title='Not Found',
            status_code=404,
            detail='The requested resource was not found.',
            instance=instance
        )

    if isinstance(exc, APIException):
        # Generic DRF APIException
        title = exc.__class__.__name__
        
        detail_msg = str(exc)
        errors = None
        
        if hasattr(exc, 'detail'):
            if isinstance(exc.detail, dict):
                detail_msg = str(exc.detail.get('detail', str(exc)))
                errors = exc.detail
            elif isinstance(exc.detail, list):
                detail_msg = str(exc.detail[0]) if len(exc.detail) > 0 else str(exc)
                errors = {"non_field_errors": exc.detail}
            else:
                detail_msg = str(exc.detail)
                
        return build_error_response(
            type_uri=f'https://api.naderkeye.com/problems/{title.lower()}',
            title=title,
            status_code=exc.status_code,
            detail=detail_msg,
            instance=instance,
            errors=errors
        )

    # For unhandled exceptions, we might want to log them and return a generic 500 error
    import traceback
    traceback.print_exc()
    
    # Return 500
    if response is None:
        return build_error_response(
            type_uri='https://api.naderkeye.com/problems/internal-server-error',
            title='Internal Server Error',
            status_code=500,
            detail='An unexpected error occurred.',
            instance=instance
        )

    return response
