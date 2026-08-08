from django.test import TestCase
from django.urls import reverse

from naderk.cms.models import SiteSettings


class ApiRootTests(TestCase):
    """`/` on the API host had no route, so nginx served its own default page.
    It now identifies the deployment."""

    def test_root_returns_ok_with_pointers(self):
        res = self.client.get(reverse('api-root'))
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['status'], 'ok')
        self.assertIn('Welcome to the', body['message'])
        self.assertEqual(body['api_root'], '/api/v1/')
        self.assertEqual(body['health'], '/api/health/')

    def test_root_uses_the_cms_company_name(self):
        SiteSettings.objects.create(company_name='NaderkEla Care')
        body = self.client.get(reverse('api-root')).json()
        self.assertEqual(body['message'], 'Welcome to the NaderkEla Care API.')

    def test_root_falls_back_to_brand_setting_without_cms_settings(self):
        SiteSettings.objects.all().delete()
        body = self.client.get(reverse('api-root')).json()
        self.assertIn('Welcome to the', body['message'])
        self.assertNotIn('None', body['message'])

    def test_health_endpoint_still_works(self):
        res = self.client.get(reverse('health-check'))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'ok')
