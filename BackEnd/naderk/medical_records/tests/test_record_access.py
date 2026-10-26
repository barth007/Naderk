"""Who may read and write a patient's clinical records."""
import pytest

from naderk.appointments.tests import factories as appointments
from naderk.core.models import User
from naderk.ecommerce.tests import factories as store
from naderk.medical_records.models import DiagnosticResult, Medication
from naderk.medical_records.permissions import IsRecordOwnerOrDoctorWithActiveAppointment
from naderk.medical_records.tests import factories
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

BASE = '/api/v1/medical-records/'
LISTS = ['encounters/', 'prescriptions/', 'diagnostics/', 'scans/']
access = IsRecordOwnerOrDoctorWithActiveAppointment().has_patient_access


@pytest.fixture
def other_doctor():
    return make_user('doctor2@naderk.test', role=User.Role.DOCTOR)


@pytest.fixture
def records(patient, doctor):
    """One of every kind of record for `patient`, written by `doctor`."""
    enc = factories.encounter(patient, doctor)
    return {
        'encounter': enc,
        'medication': factories.medication(patient, doctor, encounter=enc),
        'diagnostic': factories.diagnostic(patient, encounter=enc),
        'scan': factories.scan(patient, uploaded_by=doctor, encounter=enc),
        'prescription': store.prescription(patient),
    }


def count(response):
    return response.json()['data']['count']


# ── The access rule itself ───────────────────────────────────────────────────

def test_a_doctor_with_an_open_appointment_has_access(patient, other_doctor):
    appointments.appointment(patient, appointments.service(), other_doctor, paid=True)

    assert access(other_doctor, patient) is True


@pytest.mark.parametrize('status', ['COMPLETED', 'CANCELLED', 'NO_SHOW'])
def test_a_finished_appointment_alone_does_not_give_access(patient, other_doctor, status):
    appointments.appointment(patient, appointments.service(), other_doctor, paid=True, status=status)

    assert access(other_doctor, patient) is False


def test_a_doctor_who_authored_any_record_keeps_access(patient, doctor, other_doctor, records):
    assert access(doctor, patient) is True
    assert access(other_doctor, patient) is False
    assert access(patient, patient) is True


# ── A patient reading their own ──────────────────────────────────────────────

@pytest.mark.parametrize('path', LISTS)
def test_patient_lists_their_own_records(patient, records, path):
    res = client_for(patient).get(BASE + path)

    assert res.status_code == 200, res.content
    assert count(res) == 1


def test_patient_overview(patient, records):
    data = client_for(patient).get(BASE + 'overview/').json()['data']

    assert data['patient_info']['email'] == patient.email
    assert data['patient_info']['patient_id'].startswith('NDK-') or data['patient_info']['patient_id']
    assert [len(data[key]) for key in ('recent_encounters', 'active_medications', 'recent_diagnostics',
                                       'recent_scans', 'eyewear_prescriptions')] == [1, 1, 1, 1, 1]


def test_only_active_medications_appear_in_the_overview(patient, doctor, records):
    factories.medication(patient, doctor, 'Old drops', status='COMPLETED')

    names = [m['name'] for m in client_for(patient).get(BASE + 'overview/').json()['data']['active_medications']]

    assert names == ['Latanoprost']


def test_encounter_detail_bundles_everything_recorded_in_that_visit(patient, records):
    data = client_for(patient).get(f"{BASE}encounters/{records['encounter'].id}/").json()['data']

    assert data['reference_number'].startswith('ENC-')
    assert [len(data[key]) for key in ('medications', 'diagnostics', 'scans')] == [1, 1, 1]
    assert data['doctor_detail']['last_name'] == 'Test'


def test_records_require_sign_in(api_client):
    for path in LISTS + ['overview/', 'medications/', 'patients/']:
        assert api_client.get(BASE + path).status_code == 401, path


# ── Other patients ───────────────────────────────────────────────────────────

def test_another_patient_cannot_open_single_records(other_patient, records):
    client = client_for(other_patient)

    assert client.get(f"{BASE}encounters/{records['encounter'].id}/").status_code == 403
    assert client.get(f"{BASE}diagnostics/{records['diagnostic'].id}/").status_code == 403
    assert client.get(f"{BASE}medications/{records['medication'].id}/").status_code == 404
    assert client.get(f"{BASE}prescriptions/{records['prescription'].id}/pdf/").status_code in (403, 404)


@pytest.mark.parametrize('path', LISTS + ['overview/'])
def test_a_patient_cannot_read_another_patients_records_by_passing_their_id(patient, other_patient, records, path):
    res = client_for(other_patient).get(BASE + path, {'patient_id': str(patient.id)})

    assert res.status_code in (403, 404)


# ── Doctors ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize('path', LISTS + ['overview/'])
def test_treating_doctor_reads_the_patients_records(patient, doctor, records, path):
    assert client_for(doctor).get(BASE + path, {'patient_id': str(patient.id)}).status_code == 200


@pytest.mark.parametrize('path', LISTS + ['overview/'])
def test_unrelated_doctor_is_refused(patient, other_doctor, records, path):
    assert client_for(other_doctor).get(BASE + path, {'patient_id': str(patient.id)}).status_code == 403


@pytest.mark.parametrize('path', LISTS + ['overview/'])
def test_staff_must_say_which_patient(doctor, path):
    client = client_for(doctor)
    client.raise_request_exception = False

    assert client.get(BASE + path).status_code == 400


def test_admin_reads_any_patient(patient, admin_user, records):
    assert count(client_for(admin_user).get(BASE + 'encounters/', {'patient_id': str(patient.id)})) == 1


@pytest.mark.parametrize('role', [User.Role.AGENT, User.Role.MEDICAL_AGENT, User.Role.OPTICIAN, User.Role.OPERATIONS_MANAGER])
def test_non_clinical_staff_cannot_read_clinical_records(patient, records, role):
    staff = make_user('staff@naderk.test', role=role)

    assert client_for(staff).get(BASE + 'encounters/', {'patient_id': str(patient.id)}).status_code == 403


def test_diagnostics_can_be_narrowed_to_one_consultation(patient, doctor, records):
    factories.diagnostic(patient, 'Visual field')        # not tied to the encounter

    scoped = client_for(doctor).get(BASE + 'diagnostics/', {
        'patient_id': str(patient.id), 'encounter_id': str(records['encounter'].id)})

    assert [row['test_name'] for row in scoped.json()['data']['results']] == ['OCT']


# ── Diagnostic results ───────────────────────────────────────────────────────

def record(user, patient, **body):
    body = {'patient_id': str(patient.id), 'test_name': 'Tonometry', 'category': 'Pressure', **body}
    return client_for(user).post(BASE + 'diagnostics/', body, format='json')


def test_treating_doctor_records_a_result_against_the_consultation(patient, doctor, records):
    res = record(doctor, patient, encounter_id=str(records['encounter'].id), result_summary='18 mmHg')

    assert res.status_code == 201, res.content
    created = DiagnosticResult.objects.get(test_name='Tonometry')
    assert (created.patient, created.encounter, created.status) == (patient, records['encounter'], 'PENDING')


def test_a_doctor_cannot_record_a_result_for_a_patient_they_do_not_treat(patient, other_doctor, records):
    res = record(other_doctor, patient)

    assert res.status_code == 403
    assert not DiagnosticResult.objects.filter(test_name='Tonometry').exists()


def test_recording_refusals(patient, other_patient, doctor, records):
    other_encounter = factories.encounter(other_patient, doctor)

    assert record(patient, patient).status_code == 403
    assert record(doctor, doctor).status_code == 400                                   # not a patient
    assert record(doctor, patient, encounter_id=str(other_encounter.id)).status_code == 400
    assert record(doctor, patient, encounter_id='00000000-0000-0000-0000-000000000000').status_code == 400
    assert record(doctor, patient, test_name='').status_code == 400
    assert DiagnosticResult.objects.count() == 1


def test_amending_and_removing_a_result(patient, doctor, other_doctor, records):
    url = f"{BASE}diagnostics/{records['diagnostic'].id}/"

    assert client_for(patient).patch(url, {'status': 'READY'}, format='json').status_code == 403
    assert client_for(other_doctor).patch(url, {'status': 'READY'}, format='json').status_code == 403
    assert client_for(doctor).patch(url, {'status': 'NOT_A_STATUS'}, format='json').status_code == 400

    res = client_for(doctor).patch(url, {'status': 'READY', 'result_summary': 'Normal'}, format='json')
    assert res.status_code == 200, res.content
    records['diagnostic'].refresh_from_db()
    assert (records['diagnostic'].status, records['diagnostic'].result_summary) == ('READY', 'Normal')

    assert client_for(patient).delete(url).status_code == 403
    assert client_for(doctor).delete(url).status_code == 200
    assert not DiagnosticResult.objects.exists()


# ── Medications ──────────────────────────────────────────────────────────────

def prescribe(user, patient, **body):
    body = {'patient_id': str(patient.id), 'name': 'Timolol', 'dosage': '1 drop', 'frequency': 'Twice daily',
            'start_date': '2030-02-01', **body}
    return client_for(user).post(BASE + 'medications/', body, format='json')


def test_doctor_prescribes_and_the_patient_sees_it(patient, doctor, records):
    res = prescribe(doctor, patient, encounter_id=str(records['encounter'].id))

    assert res.status_code == 201, res.content
    assert res.json()['data']['prescribed_by_name'] == 'Dr. Doctor Test'
    names = {m['name'] for m in client_for(patient).get(BASE + 'medications/').json()['data']}
    assert names == {'Latanoprost', 'Timolol'}


def test_only_doctors_prescribe(patient, admin_user):
    assert prescribe(patient, patient).status_code == 403
    assert prescribe(admin_user, patient).status_code == 403


def test_a_doctor_sees_and_deletes_only_what_they_prescribed(patient, doctor, other_doctor, records):
    theirs = factories.medication(patient, other_doctor, 'Other drug')
    mine = records['medication']

    listed = {m['name'] for m in client_for(doctor).get(BASE + 'medications/', {'patient_id': str(patient.id)}).json()['data']}
    assert listed == {'Latanoprost'}
    assert client_for(doctor).get(f'{BASE}medications/{theirs.id}/').status_code == 404
    assert client_for(doctor).delete(f'{BASE}medications/{theirs.id}/').status_code == 404
    assert client_for(patient).delete(f'{BASE}medications/{mine.id}/').status_code == 403

    assert client_for(doctor).delete(f'{BASE}medications/{mine.id}/').status_code == 200
    assert not Medication.objects.filter(pk=mine.pk).exists()


def test_medication_validation(patient, doctor):
    res = prescribe(doctor, patient, name='', start_date='not-a-date')

    assert res.status_code == 400
    assert {'name', 'start_date'} <= set(res.json()['errors'])


def test_a_doctor_cannot_prescribe_for_a_patient_they_do_not_treat(patient, other_doctor):
    assert prescribe(other_doctor, patient).status_code in (400, 403)


def test_prescribing_for_an_unknown_patient_is_a_validation_error(doctor):
    client = client_for(doctor)
    client.raise_request_exception = False

    res = client.post(BASE + 'medications/', {
        'patient_id': '00000000-0000-0000-0000-000000000000', 'name': 'Timolol', 'dosage': '1 drop',
        'frequency': 'Twice daily', 'start_date': '2030-02-01'}, format='json')

    assert res.status_code == 400


# ── The doctor's patient list ────────────────────────────────────────────────

def test_patient_list_is_for_clinical_and_admin_staff(patient, doctor, records):
    assert client_for(doctor).get(BASE + 'patients/').status_code == 200
    assert client_for(patient).get(BASE + 'patients/').status_code == 403
    assert client_for(make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER)).get(BASE + 'patients/').status_code == 403
