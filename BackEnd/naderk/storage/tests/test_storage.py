"""File uploads: validation, where a file lands, and who may fetch a private one."""
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError
from django.core.files.uploadedfile import SimpleUploadedFile

from naderk.common.storage.exceptions import StorageProviderError, StorageValidationError
from naderk.common.storage.minio_provider import MinIOProvider
from naderk.common.storage.service import storage_service
from naderk.common.storage.utils import generate_object_key
from naderk.common.storage.validators import MAX_SIZE, validate
from naderk.core.models import User
from naderk.storage.checks import check_public_storage_endpoint
from naderk.storage.models import StoredFile
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

UPLOAD = '/api/v1/storage/upload/'


@pytest.fixture
def provider(monkeypatch):
    """Stands in for MinIO: nothing leaves the process."""
    fake = Mock()
    fake.upload.side_effect = lambda file, key, bucket, content_type: f'https://media.naderk.test/{bucket}/{key}'
    fake.generate_presigned_url.return_value = 'https://media.naderk.test/signed?sig=abc'
    monkeypatch.setattr(storage_service, '_provider', fake)
    return fake


def a_file(name='scan.png', size=10, content_type='image/png'):
    return SimpleUploadedFile(name, b'x' * size, content_type=content_type)


def upload(user, file=None, **data):
    return client_for(user).post(UPLOAD, {'file': file or a_file(), **data}, format='multipart')


# ── Upload endpoint ──────────────────────────────────────────────────────────

def test_upload_requires_sign_in(api_client):
    assert api_client.post(UPLOAD, {'file': a_file()}, format='multipart').status_code == 401


def test_public_upload_returns_a_url_and_records_the_file(patient, provider, settings):
    res = upload(patient, prefix='avatars')

    assert res.status_code == 200, res.content
    data = res.json()['data']
    stored = StoredFile.objects.get(id=data['file_id'])
    assert data['url'] == f"https://media.naderk.test/{settings.STORAGE['PUBLIC_BUCKET']}/{stored.object_key}"
    assert stored.object_key.startswith('avatars/') and stored.object_key.endswith('.png')
    assert (stored.uploaded_by, stored.is_public, stored.original_filename) == (patient, True, 'scan.png')
    assert (stored.file_size, stored.content_type) == (10, 'image/png')


def test_private_upload_goes_to_the_private_bucket_and_returns_no_url(patient, provider, settings):
    res = upload(patient, bucket_type='private')

    data = res.json()['data']
    stored = StoredFile.objects.get(id=data['file_id'])
    assert data['url'] == ''
    assert (stored.bucket, stored.is_public) == (settings.STORAGE['PRIVATE_BUCKET'], False)


def test_stored_name_never_comes_from_the_uploaded_name(patient, provider):
    upload(patient, a_file('My Passport Photo.PNG'))

    key = StoredFile.objects.get().object_key
    assert 'passport' not in key.lower() and key.endswith('.png')


def test_upload_without_a_file_is_a_validation_error(patient, provider):
    assert client_for(patient).post(UPLOAD, {}, format='multipart').status_code == 400


@pytest.mark.parametrize('name', ['run.exe', 'page.html', 'script.js', 'noextension'])
def test_disallowed_types_are_refused_and_nothing_is_stored(patient, provider, name):
    res = upload(patient, a_file(name))

    assert res.status_code == 400
    provider.upload.assert_not_called()
    assert not StoredFile.objects.exists()


def test_storage_failure_is_reported_and_leaves_no_record(patient, provider):
    provider.upload.side_effect = StorageProviderError('bucket unreachable')

    res = upload(patient)

    assert res.status_code == 500
    assert not StoredFile.objects.exists()


# ── Fetching a private file ──────────────────────────────────────────────────

def signed_url(user, stored):
    return client_for(user).get(f'/api/v1/storage/files/{stored.id}/url/')


@pytest.fixture
def private_file(patient, provider):
    file_id = upload(patient, a_file('result.pdf', content_type='application/pdf'),
                     bucket_type='private').json()['data']['file_id']
    return StoredFile.objects.get(id=file_id)


def test_uploader_gets_a_signed_url(patient, private_file, provider, settings):
    res = signed_url(patient, private_file)

    assert res.status_code == 200, res.content
    assert res.json()['data']['url'] == 'https://media.naderk.test/signed?sig=abc'
    provider.generate_presigned_url.assert_called_once_with(
        private_file.object_key, private_file.bucket, settings.STORAGE['URL_EXPIRATION'],
    )


def test_another_patient_cannot_get_a_signed_url(other_patient, private_file, provider):
    assert signed_url(other_patient, private_file).status_code == 403
    provider.generate_presigned_url.assert_not_called()


@pytest.mark.parametrize('role', [User.Role.DOCTOR, User.Role.ADMIN, User.Role.MEDICAL_AGENT])
def test_clinical_and_admin_staff_can_get_a_signed_url(private_file, role):
    assert signed_url(make_user('staff@naderk.test', role=role), private_file).status_code == 200


@pytest.mark.parametrize('role', [User.Role.AGENT, User.Role.OPERATIONS_MANAGER])
def test_non_clinical_staff_cannot(private_file, role):
    assert signed_url(make_user('staff@naderk.test', role=role), private_file).status_code == 403


def test_unknown_file_is_404(patient, provider):
    res = client_for(patient).get('/api/v1/storage/files/00000000-0000-0000-0000-000000000000/url/')

    assert res.status_code == 404


# ── Validation rules ─────────────────────────────────────────────────────────

@pytest.mark.parametrize('name', ['a.jpg', 'a.JPEG', 'a.png', 'a.webp', 'a.pdf', 'a.docx', 'a.xlsx', 'a.csv'])
def test_allowed_types_pass(name):
    validate(a_file(name))


@pytest.mark.parametrize('name', ['../etc/passwd.png', 'dir/a.png', 'dir\\a.png', 'a..png'])
def test_names_that_look_like_paths_are_refused(name):
    file = Mock(size=10)
    file.name = name      # SimpleUploadedFile would strip the directory part itself
    with pytest.raises(StorageValidationError, match='Invalid filename'):
        validate(file)


def test_size_limit_is_ten_megabytes():
    at_limit, over = Mock(size=MAX_SIZE), Mock(size=MAX_SIZE + 1)
    at_limit.name = over.name = 'a.png'

    validate(at_limit)
    with pytest.raises(StorageValidationError, match='maximum size'):
        validate(over)


def test_missing_file_is_refused():
    with pytest.raises(StorageValidationError):
        validate(None)


def test_object_keys_are_unique_and_keep_only_the_extension():
    first, second = generate_object_key('frames', 'Photo.JPG'), generate_object_key('frames', 'Photo.JPG')

    assert first != second
    assert first.startswith('frames/') and first.endswith('.jpg')
    assert '/' not in generate_object_key('', 'a.png')


# ── MinIO provider ───────────────────────────────────────────────────────────

@pytest.fixture
def minio(settings):
    settings.STORAGE = {**settings.STORAGE, 'ENDPOINT': 'http://minio:9000',
                        'PUBLIC_ENDPOINT': 'https://media.naderk.test'}
    provider = MinIOProvider()
    provider._client = Mock()
    return provider


def s3_error():
    return ClientError({'Error': {'Code': '500', 'Message': 'boom'}}, 'op')


def test_public_urls_use_the_browser_reachable_endpoint_not_the_internal_one(minio):
    url = minio.upload(a_file(), 'frames/a.png', 'naderk-public', 'image/png')

    assert url == 'https://media.naderk.test/naderk-public/frames/a.png'
    assert minio._client.upload_fileobj.call_args.kwargs['ExtraArgs'] == {'ContentType': 'image/png'}


def test_s3_errors_become_storage_errors(minio):
    minio._client.upload_fileobj.side_effect = s3_error()
    minio._client.delete_object.side_effect = s3_error()
    minio._client.generate_presigned_url.side_effect = s3_error()

    with pytest.raises(StorageProviderError):
        minio.upload(a_file(), 'k', 'b', 'image/png')
    with pytest.raises(StorageProviderError):
        minio.delete('k', 'b')
    with pytest.raises(StorageProviderError):
        minio.generate_presigned_url('k', 'b', 60)


def test_exists_reports_missing_objects_as_false(minio):
    assert minio.exists('k', 'b') is True
    minio._client.head_object.side_effect = s3_error()
    assert minio.exists('k', 'b') is False


# ── Deployment check ─────────────────────────────────────────────────────────

@pytest.mark.parametrize('endpoint, expected', [
    ('https://media.naderk.test', []),
    ('', ['storage.W002']),
    ('http://minio:9000', ['storage.W003']),
    ('http://localhost:9000', ['storage.W003']),
    ('http://media.naderk.test', ['storage.W001']),
])
def test_public_endpoint_check(settings, monkeypatch, endpoint, expected):
    settings.DEBUG = False
    settings.STORAGE = {**settings.STORAGE, 'PUBLIC_ENDPOINT': endpoint}
    monkeypatch.setattr('sys.argv', ['manage.py', 'check'])

    assert [issue.id for issue in check_public_storage_endpoint(None)] == expected


def test_public_endpoint_check_is_silent_in_development(settings, monkeypatch):
    settings.DEBUG = True
    settings.STORAGE = {**settings.STORAGE, 'PUBLIC_ENDPOINT': 'http://localhost:9000'}
    monkeypatch.setattr('sys.argv', ['manage.py', 'check'])

    assert check_public_storage_endpoint(None) == []
