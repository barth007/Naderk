from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from naderk.core.models import User
from naderk.appointments.models import MedicalService
from .models import Specialization, DoctorProfile, specialization_label


class SpecializationSeedTests(TestCase):
    def test_built_ins_are_seeded_by_migration(self):
        codes = set(Specialization.objects.values_list('code', flat=True))
        self.assertTrue(
            {'OPTOMETRIST', 'OPHTHALMOLOGIST', 'ENT', 'GENERAL_PRACTITIONER'}.issubset(codes)
        )

    def test_label_resolves_from_table(self):
        self.assertEqual(specialization_label('ENT'), 'ENT Specialist')

    def test_label_falls_back_for_unknown_code(self):
        self.assertEqual(specialization_label('RETINA_SPECIALIST'), 'Retina Specialist')

    def test_label_handles_empty(self):
        self.assertEqual(specialization_label(''), '')
        self.assertEqual(specialization_label(None), '')


class SpecializationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='a@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.patient = User.objects.create_user(email='p@x.com', password='pw12345!')
        self.url = reverse('dashboard:specializations')

    def _detail(self, spec):
        return reverse('dashboard:specialization-detail', args=[spec.id])

    def test_any_signed_in_user_can_read(self):
        """Doctor onboarding needs this list, so it can't be admin-only."""
        self.client.force_authenticate(user=self.patient)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.json()['data']), 4)

    def test_non_admin_cannot_create(self):
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(self.url, {'name': 'Retina Specialist'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_admin_creates_and_code_is_derived_from_name(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(self.url, {'name': 'Retina Specialist'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['data']['code'], 'RETINA_SPECIALIST')

    def test_code_normalises_punctuation_and_spacing(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(self.url, {'name': "Paediatric  Eye-Care!"}, format='json')
        self.assertEqual(res.json()['data']['code'], 'PAEDIATRIC_EYE_CARE')

    def test_duplicate_code_is_rejected(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, {'name': 'Retina Specialist'}, format='json')
        res = self.client.post(self.url, {'name': 'retina specialist'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_name_only_of_punctuation_is_rejected(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(self.url, {'name': '!!!'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_rename_keeps_code_stable(self):
        self.client.force_authenticate(user=self.admin)
        spec = Specialization.objects.get(code='ENT')
        res = self.client.patch(self._detail(spec), {'name': 'Ear Nose & Throat'}, format='json')
        self.assertEqual(res.status_code, 200)
        spec.refresh_from_db()
        self.assertEqual(spec.name, 'Ear Nose & Throat')
        self.assertEqual(spec.code, 'ENT')

    def test_code_cannot_be_changed_via_patch(self):
        self.client.force_authenticate(user=self.admin)
        spec = Specialization.objects.get(code='ENT')
        self.client.patch(self._detail(spec), {'code': 'HIJACKED'}, format='json')
        spec.refresh_from_db()
        self.assertEqual(spec.code, 'ENT')

    def test_inactive_hidden_from_dropdown_list_but_visible_to_admin(self):
        spec = Specialization.objects.get(code='ENT')
        spec.is_active = False
        spec.save()

        self.client.force_authenticate(user=self.patient)
        codes = [s['code'] for s in self.client.get(self.url).json()['data']]
        self.assertNotIn('ENT', codes)

        self.client.force_authenticate(user=self.admin)
        codes = [s['code'] for s in self.client.get(self.url, {'include_inactive': 'true'}).json()['data']]
        self.assertIn('ENT', codes)

    def test_cannot_delete_specialization_still_in_use(self):
        self.client.force_authenticate(user=self.admin)
        spec = Specialization.objects.get(code='OPTOMETRIST')
        MedicalService.objects.create(
            name='Eye Exam', slug='eye-exam', requires_doctor=True,
            required_specialization='OPTOMETRIST', fee=5000,
        )
        res = self.client.delete(self._detail(spec))
        self.assertEqual(res.status_code, 409)
        spec.refresh_from_db()
        self.assertTrue(spec.is_active)

    def test_counts_distinguish_doctors_from_services(self):
        """The service form warns on doctor_count == 0, so it must not be
        inflated by services also using the code."""
        self.client.force_authenticate(user=self.admin)
        MedicalService.objects.create(
            name='Eye Exam', slug='eye-exam', requires_doctor=True,
            required_specialization='OPTOMETRIST', fee=5000,
        )
        row = next(s for s in self.client.get(self.url).json()['data'] if s['code'] == 'OPTOMETRIST')
        self.assertEqual(row['doctor_count'], 0)
        self.assertEqual(row['service_count'], 1)
        self.assertEqual(row['in_use'], 1)

        doc = User.objects.create_user(email='od@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=doc).update(specialization='OPTOMETRIST')
        row = next(s for s in self.client.get(self.url).json()['data'] if s['code'] == 'OPTOMETRIST')
        self.assertEqual(row['doctor_count'], 1)
        self.assertEqual(row['service_count'], 1)

    def test_unused_specialization_is_deactivated_on_delete(self):
        self.client.force_authenticate(user=self.admin)
        spec = Specialization.objects.create(code='UNUSED', name='Unused')
        res = self.client.delete(self._detail(spec))
        self.assertEqual(res.status_code, 200)
        spec.refresh_from_db()
        self.assertFalse(spec.is_active)


class ServiceAcceptsNewSpecializationTests(TestCase):
    """The whole point: an admin-added specialization must be usable on a
    service with no code change or deploy."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='a2@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.client.force_authenticate(user=self.admin)

    def test_service_can_require_a_newly_added_specialization(self):
        created = self.client.post(
            reverse('dashboard:specializations'), {'name': 'Retina Specialist'}, format='json',
        ).json()['data']

        res = self.client.post(reverse('dashboard:admin-services'), {
            'name': 'Retina Screening', 'requires_doctor': True,
            'required_specialization': created['code'], 'fee': '20000',
            'billing_type': 'PER_VISIT',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['data']['required_specialization'], 'RETINA_SPECIALIST')

    def test_unknown_specialization_is_still_rejected(self):
        res = self.client.post(reverse('dashboard:admin-services'), {
            'name': 'Bogus', 'requires_doctor': True,
            'required_specialization': 'NOT_A_REAL_SPEC', 'fee': '100',
            'billing_type': 'PER_VISIT',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_inactive_specialization_is_rejected_on_new_service(self):
        spec = Specialization.objects.get(code='ENT')
        spec.is_active = False
        spec.save()
        res = self.client.post(reverse('dashboard:admin-services'), {
            'name': 'ENT Thing', 'requires_doctor': True,
            'required_specialization': 'ENT', 'fee': '100', 'billing_type': 'PER_VISIT',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class AddStaffSpecializationTests(TestCase):
    """Admin-created doctors used to silently inherit the signal default."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='a3@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.client.force_authenticate(user=self.admin)
        self.url = reverse('dashboard:admin-staff')

    def _payload(self, **over):
        base = {'first_name': 'New', 'last_name': 'Doc', 'email': 'newdoc@x.com', 'role': 'DOCTOR'}
        base.update(over)
        return base

    def test_doctor_without_specialization_is_rejected(self):
        res = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(email='newdoc@x.com').exists())

    def test_doctor_with_invalid_specialization_is_rejected(self):
        res = self.client.post(self.url, self._payload(specialization='MADE_UP'), format='json')
        self.assertEqual(res.status_code, 400)

    def test_doctor_specialization_is_applied(self):
        res = self.client.post(self.url, self._payload(specialization='OPTOMETRIST'), format='json')
        self.assertIn(res.status_code, (200, 201))
        profile = DoctorProfile.objects.get(user__email='newdoc@x.com')
        self.assertEqual(profile.specialization, 'OPTOMETRIST')

    def test_admin_created_doctor_gets_default_availability(self):
        """Otherwise they're recommended but every date shows zero slots."""
        from naderk.appointments.models import DoctorAvailability
        self.client.post(self.url, self._payload(specialization='OPTOMETRIST'), format='json')
        doctor = User.objects.get(email='newdoc@x.com')
        self.assertEqual(DoctorAvailability.objects.filter(doctor=doctor, is_active=True).count(), 5)

    def test_non_doctor_role_does_not_require_specialization(self):
        res = self.client.post(
            self.url, self._payload(role='OPTICIAN', email='newopt@x.com'), format='json',
        )
        self.assertIn(res.status_code, (200, 201))
