from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from naderk.ecommerce.models import Prescription

User = get_user_model()


class PrescriptionPdfTests(TestCase):
    """
    The dashboard linked straight at prescription_file — the Cloudinary upload,
    no longer in use — so "Download PDF" 404'd. The generated document is the
    record, and it must carry the CMS branding rather than a hardcoded name.
    """

    def setUp(self):
        from decimal import Decimal
        from rest_framework.test import APIClient
        from naderk.ecommerce.models import Prescription

        self.client = APIClient()
        self.patient = User.objects.create_user(
            email='pdfpatient@test.com', password='pw12345!', role='PATIENT'
        )
        self.client.force_authenticate(user=self.patient)
        self.prescription = Prescription.objects.create(
            patient=self.patient, pupillary_distance=Decimal('63.00'),
        )

    def _url(self, query=''):
        return f'/api/v1/medical-records/prescriptions/{self.prescription.id}/pdf/{query}'

    def _body(self, res):
        return b''.join(res.streaming_content) if res.streaming else res.content

    def test_returns_a_pdf_as_an_attachment(self):
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertIn('attachment;', res['Content-Disposition'])
        self.assertTrue(self._body(res).startswith(b'%PDF-'))

    def test_inline_disposition_for_preview(self):
        res = self.client.get(self._url('?disposition=inline'))
        self.assertEqual(res.status_code, 200)
        self.assertIn('inline;', res['Content-Disposition'])

    def test_uses_the_cms_company_name(self):
        from naderk.cms.models import SiteSettings

        SiteSettings.objects.all().delete()
        SiteSettings.objects.create(company_name='Renamed Clinic Ltd')

        from naderk.medical_records.apis import _prescription_pdf_brand
        name, _logo = _prescription_pdf_brand()
        self.assertEqual(name, 'Renamed Clinic Ltd')

    def test_renders_when_the_logo_is_unreachable(self):
        from naderk.cms.models import SiteSettings

        SiteSettings.objects.all().delete()
        SiteSettings.objects.create(
            company_name='Clinic', logo_url='http://127.0.0.1:9/nope.png'
        )
        # A broken logo must not take the prescription down with it.
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)
        self.assertTrue(self._body(res).startswith(b'%PDF-'))

    def test_another_patient_cannot_fetch_it(self):
        other = User.objects.create_user(
            email='other@test.com', password='pw12345!', role='PATIENT'
        )
        self.client.force_authenticate(user=other)
        res = self.client.get(self._url())
        self.assertIn(res.status_code, (403, 404))
