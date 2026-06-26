from rest_framework.exceptions import APIException

class BaseCustomException(APIException):
    """
    Base exception class that all custom exceptions should inherit from.
    Allows passing additional context for the RFC7807 response.
    """
    status_code = 500
    default_detail = 'A server error occurred.'
    default_code = 'error'
    default_type_uri = 'https://api.naderkeye.com/problems/server-error'
    default_title = 'Server Error'

    def __init__(self, detail=None, code=None, type_uri=None, title=None, errors=None):
        if detail is not None:
            self.detail = detail
        else:
            self.detail = self.default_detail

        if code is not None:
            self.code = code
        else:
            self.code = self.default_code
            
        self.type_uri = type_uri or self.default_type_uri
        self.title = title or self.default_title
        self.errors = errors
