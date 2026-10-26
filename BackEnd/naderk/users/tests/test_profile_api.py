"""The profile a user edits about themselves, and what finishing it unlocks."""
import datetime
from unittest.mock import Mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from naderk.appointments.models import DoctorAvailability
from naderk.common.storage.service import storage_service
from naderk.core.models import User
from naderk.users.models import DoctorProfile, PatientProfile, StaffProfile
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

PROFILE = '/api/v1/users/profile/'


def save(user, **body):
    return client_for(user).put(PROFILE, body, format='json')


# ── Profiles created with the account ────────────────────────────────────────

def test_each_role_gets_the_right_profiles(patient, doctor, admin_user):
    assert PatientProfile.objects.get(user=patient).patient_id.startswith('NE-')
    assert DoctorProfile.objects.get(user=doctor).specialization == 'OPHTHALMOLOGIST'
    assert StaffProfile.objects.get(user=doctor).employee_id.startswith('EMP-DOC-')
    assert StaffProfile.objects.get(user=admin_user).department == 'Administration'
    assert not PatientProfile.objects.filter(user=doctor).exists()


def test_patient_ids_are_unique(patient, other_patient):
    ids = set(PatientProfile.objects.values_list('patient_id', flat=True))

    assert len(ids) == 2


# ── Patient ──────────────────────────────────────────────────────────────────

def test_profile_requires_sign_in(api_client):
    assert api_client.get(PROFILE).status_code == 401
    assert api_client.put(PROFILE, {}, format='json').status_code == 401


def test_patient_reads_their_profile(patient):
    data = client_for(patient).get(PROFILE).json()['data']

    assert data['patient_id'].startswith('NE-')
    assert 'user' not in data and 'id' not in data


def test_saving_the_patient_profile_syncs_the_account_and_completes_onboarding(patient):
    res = save(patient, dob='1990-05-17', gender='Female', phone_number='+2348012345678',
               delivery_street='1 Test Street', delivery_city='Lagos', delivery_country='NG')

    assert res.status_code == 200, res.content
    patient.refresh_from_db()
    assert (patient.date_of_birth, patient.gender, patient.phone_number) == (
        datetime.date(1990, 5, 17), 'Female', '+2348012345678')
    assert patient.profile_completion_status == 'COMPLETED'
    assert patient.patient_profile.delivery_city == 'Lagos'


def test_a_partial_save_does_not_complete_onboarding_or_wipe_other_fields(patient):
    save(patient, city='Lagos', dob='1990-05-17')

    save(patient, state='Lagos State')

    patient.refresh_from_db()
    assert patient.profile_completion_status == 'PENDING'      # gender still missing
    assert (patient.patient_profile.city, patient.patient_profile.state) == ('Lagos', 'Lagos State')


def test_the_patient_id_cannot_be_changed(patient):
    original = patient.patient_profile.patient_id

    save(patient, patient_id='NE-0001')

    patient.patient_profile.refresh_from_db()
    assert patient.patient_profile.patient_id == original


@pytest.mark.parametrize('body, field', [({'dob': 'yesterday'}, 'dob'), ({'emergency_contact_email': 'nope'}, 'emergency_contact_email')])
def test_patient_profile_validation(patient, body, field):
    res = save(patient, **body)

    assert res.status_code == 400
    assert field in res.json()['errors']


def test_a_profile_is_private_to_its_owner(patient, other_patient):
    save(patient, city='Lagos')

    assert client_for(other_patient).get(PROFILE).json()['data']['city'] is None


# ── Doctor ───────────────────────────────────────────────────────────────────

COMPLETE = {
    'first_name': 'Ngozi', 'last_name': 'Okafor', 'phone_number': '+2348012345678',
    'date_of_birth': '1985-03-02', 'gender': 'Female', 'specialization': 'OPTOMETRIST',
    'license_number': 'MDCN-123', 'years_of_experience': 9, 'bio': 'Optometrist.', 'max_daily_patients': 12,
}


def test_doctor_reads_a_doctor_profile(doctor):
    data = client_for(doctor).get(PROFILE).json()['data']

    assert (data['email'], data['specialization']) == (doctor.email, 'OPHTHALMOLOGIST')


def test_completing_the_doctor_profile_updates_the_account_and_opens_their_diary(doctor):
    res = save(doctor, **COMPLETE, office_address='Suite 4')

    assert res.status_code == 200, res.content
    doctor.refresh_from_db()
    assert (doctor.first_name, doctor.gender, doctor.profile_completion_status) == ('Ngozi', 'Female', 'COMPLETED')
    assert doctor.doctor_profile.license_number == 'MDCN-123'
    assert doctor.staff_profile.office_address == 'Suite 4'
    weekdays = sorted(DoctorAvailability.objects.filter(doctor=doctor).values_list('weekday', flat=True))
    assert weekdays == [0, 1, 2, 3, 4]


def test_an_incomplete_doctor_profile_stays_pending_with_no_diary(doctor):
    save(doctor, **{**COMPLETE, 'license_number': ''})

    doctor.refresh_from_db()
    assert doctor.profile_completion_status == 'PENDING'
    assert not DoctorAvailability.objects.filter(doctor=doctor).exists()


def test_saving_again_does_not_duplicate_or_overwrite_a_customised_diary(doctor):
    save(doctor, **COMPLETE)
    DoctorAvailability.objects.filter(doctor=doctor, weekday=4).delete()      # doctor took Fridays off

    save(doctor, bio='Updated bio')

    assert DoctorAvailability.objects.filter(doctor=doctor).count() == 4


def test_a_doctor_cannot_set_their_own_fee_or_email(doctor):
    save(doctor, consultation_fee='1.00', consultation_duration=5, email='someone-else@naderk.test')

    doctor.refresh_from_db()
    assert (doctor.doctor_profile.consultation_fee, doctor.doctor_profile.consultation_duration) == (0, 30)
    assert doctor.email == 'doctor@naderk.test'


def test_profile_photo_is_mirrored_to_the_staff_profile(doctor):
    save(doctor, profile_picture='https://media.naderk.test/me.png', cover_photo='https://media.naderk.test/c.png')

    staff = StaffProfile.objects.get(user=doctor)
    assert (staff.profile_picture, staff.cover_photo) == (
        'https://media.naderk.test/me.png', 'https://media.naderk.test/c.png')


# ── Doctor directory and image upload ────────────────────────────────────────

def test_doctor_directory_lists_only_doctors(patient, doctor, admin_user):
    rows = client_for(patient).get('/api/v1/users/doctors/').json()['data']['results']

    assert [(row['email'], row['specialization']) for row in rows] == [(doctor.email, 'OPHTHALMOLOGIST')]


def test_doctor_directory_requires_sign_in(api_client):
    assert api_client.get('/api/v1/users/doctors/').status_code == 401


def test_image_upload_goes_to_the_public_avatars_folder(patient, monkeypatch):
    provider = Mock()
    provider.upload.side_effect = lambda file, key, bucket, content_type: f'https://media.naderk.test/{bucket}/{key}'
    monkeypatch.setattr(storage_service, '_provider', provider)
    client = client_for(patient)

    res = client.post('/api/v1/users/upload-image/', {'file': SimpleUploadedFile('me.png', b'x')}, format='multipart')

    assert res.status_code == 200, res.content
    assert '/avatars/' in res.json()['data']['url']
    assert client.post('/api/v1/users/upload-image/', {}, format='multipart').status_code == 400
