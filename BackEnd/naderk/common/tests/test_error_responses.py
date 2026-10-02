"""Every error leaves the API as an RFC 7807 problem document."""
import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions as drf
from rest_framework.test import APIRequestFactory

from naderk.common.exceptions.auth import (
    AuthenticationRequiredException, InvalidOTPException, ResourceNotFoundException,
    ValidationFailedException,
)
from naderk.common.handlers.exception_handler import custom_exception_handler
from naderk.common.responses.builders import build_error_response, build_success_response


def handle(exc):
    context = {'request': APIRequestFactory().get('/api/v1/things/')}
    return custom_exception_handler(exc, context)


@pytest.mark.parametrize('make, status, slug', [
    (AuthenticationRequiredException, 401, 'not-authenticated'),
    (InvalidOTPException, 400, 'invalid-otp'),
    (ResourceNotFoundException, 404, 'not-found'),
    (lambda: ValidationFailedException(errors={'email': ['Taken.']}), 400, 'validation-error'),
])
def test_domain_exceptions(settings, make, status, slug):
    settings.API_BASE_URL = 'https://api.naderk.test/'

    res = handle(make())      # the type URI is built when the exception is raised

    assert res.status_code == status
    assert res.data['type'] == f'https://api.naderk.test/problems/{slug}'
    assert res.data['status'] == status
    assert res.data['instance'] == '/api/v1/things/'


def test_domain_exception_carries_field_errors_and_custom_detail():
    res = handle(ValidationFailedException(errors={'email': ['Taken.']}, detail='Nope'))

    assert res.data['errors'] == {'email': ['Taken.']}
    assert res.data['detail'] == 'Nope'


@pytest.mark.parametrize('exc, errors', [
    (drf.ValidationError({'name': ['Required.']}), {'name': ['Required.']}),
    (drf.ValidationError(['Bad.']), {'non_field_errors': ['Bad.']}),
    (DjangoValidationError({'name': ['Required.']}), {'name': ['Required.']}),
    (DjangoValidationError('Bad.'), {'non_field_errors': ['Bad.']}),
])
def test_validation_errors_are_normalised_to_a_field_map(exc, errors):
    res = handle(exc)

    assert res.status_code == 400
    assert res.data['title'] == 'Validation Error'
    assert {k: [str(m) for m in v] for k, v in res.data['errors'].items()} == errors


def test_http404():
    res = handle(Http404())

    assert (res.status_code, res.data['title']) == (404, 'Not Found')


@pytest.mark.parametrize('exc, status', [
    (drf.NotAuthenticated(), 401), (drf.PermissionDenied('No.'), 403),
    (drf.NotFound('Gone.'), 404), (drf.Throttled(), 429), (drf.MethodNotAllowed('PUT'), 405),
])
def test_other_api_exceptions_keep_their_status(exc, status):
    res = handle(exc)

    assert res.status_code == status
    assert res.data['status'] == status
    assert res.data['detail']


def test_unexpected_exception_is_a_500_that_leaks_nothing():
    res = handle(RuntimeError('database password is hunter2'))

    assert res.status_code == 500
    assert 'hunter2' not in str(res.data)
    assert res.data['title'] == 'Internal Server Error'


def test_success_envelope():
    assert build_success_response('Done', {'a': 1}, 201).data == {'success': True, 'message': 'Done', 'data': {'a': 1}}
    assert 'data' not in build_success_response('Done').data


def test_error_envelope_accepts_a_slug_or_a_full_url(settings):
    settings.API_BASE_URL = 'https://api.naderk.test'

    assert build_error_response('conflict', 'C', 409, 'd').data['type'] == 'https://api.naderk.test/problems/conflict'
    assert build_error_response('https://x.test/y', 'C', 409, 'd').data['type'] == 'https://x.test/y'
    assert 'errors' not in build_error_response('conflict', 'C', 409, 'd').data
