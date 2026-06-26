from rest_framework import status
from .base import BaseCustomException

class AuthenticationRequiredException(BaseCustomException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Authentication credentials were not provided or are invalid.'
    default_code = 'not_authenticated'
    default_type_uri = 'https://api.naderkeye.com/problems/not-authenticated'
    default_title = 'Authentication required'

class InvalidOTPException(BaseCustomException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'The provided OTP is invalid or has expired.'
    default_code = 'invalid_otp'
    default_type_uri = 'https://api.naderkeye.com/problems/invalid-otp'
    default_title = 'Invalid OTP'

class ValidationFailedException(BaseCustomException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'One or more validation errors occurred.'
    default_code = 'validation_error'
    default_type_uri = 'https://api.naderkeye.com/problems/validation-error'
    default_title = 'Validation Error'
    
    def __init__(self, errors=None, *args, **kwargs):
        super().__init__(errors=errors, *args, **kwargs)

class ResourceNotFoundException(BaseCustomException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'The requested resource was not found.'
    default_code = 'not_found'
    default_type_uri = 'https://api.naderkeye.com/problems/not-found'
    default_title = 'Resource Not Found'
