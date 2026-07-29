import traceback

from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError, APIException
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404

from naderk.common.exceptions.base import BaseCustomException, _problems_url
from naderk.common.responses.builders import build_error_response


def custom_exception_handler(exc, context):
    """
    Global exception handler — normalizes all errors to RFC 7807 problem details format.
    Type URIs are built from settings.API_BASE_URL so they reflect the current environment.
    """
    response = exception_handler(exc, context)

    instance = context['request'].path if context and 'request' in context else None

    if isinstance(exc, BaseCustomException):
        return build_error_response(
            type_uri=exc.type_uri,
            title=exc.title,
            status_code=exc.status_code,
            detail=exc.detail,
            instance=instance,
            errors=exc.errors,
        )

    if isinstance(exc, (ValidationError, DjangoValidationError)):
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
            type_uri=_problems_url('validation-error'),
            title='Validation Error',
            status_code=400,
            detail='One or more validation errors occurred.',
            instance=instance,
            errors=errors,
        )

    if isinstance(exc, Http404):
        return build_error_response(
            type_uri=_problems_url('not-found'),
            title='Not Found',
            status_code=404,
            detail='The requested resource was not found.',
            instance=instance,
        )

    if isinstance(exc, APIException):
        title = exc.__class__.__name__
        detail_msg = str(exc)
        errors = None

        if hasattr(exc, 'detail'):
            if isinstance(exc.detail, dict):
                detail_msg = str(exc.detail.get('detail', str(exc)))
                errors = exc.detail
            elif isinstance(exc.detail, list):
                detail_msg = str(exc.detail[0]) if exc.detail else str(exc)
                errors = {"non_field_errors": exc.detail}
            else:
                detail_msg = str(exc.detail)

        return build_error_response(
            type_uri=_problems_url(title.lower()),
            title=title,
            status_code=exc.status_code,
            detail=detail_msg,
            instance=instance,
            errors=errors,
        )

    # Unhandled exception → 500
    traceback.print_exc()

    if response is None:
        return build_error_response(
            type_uri=_problems_url('internal-server-error'),
            title='Internal Server Error',
            status_code=500,
            detail='An unexpected error occurred.',
            instance=instance,
        )

    return response
