from django.template.loader import render_to_string
from django.test import TestCase, override_settings

from naderk.cms.models import SiteSettings
from naderk.common.email.branding import get_email_brand


@override_settings(BRAND_NAME='EnvBrand', BRAND_LOGO_URL='https://env.example/logo.png')
class EmailBrandFromCmsTests(TestCase):
    """Emails must follow the CMS, not the BRAND_* env vars."""

    def test_falls_back_to_env_without_cms_row(self):
        brand = get_email_brand()
        self.assertEqual(brand['brand_name'], 'EnvBrand')
        self.assertEqual(brand['brand_logo_url'], 'https://env.example/logo.png')

    def test_cms_overrides_env(self):
        SiteSettings.objects.create(
            company_name='CmsBrand', logo_url='https://cms.example/logo.png',
            address='1 Main St', phone_primary='0800', email_support='hi@cms.example',
            facebook_url='https://facebook.com/cms',
        )
        brand = get_email_brand()
        self.assertEqual(brand['brand_name'], 'CmsBrand')
        self.assertEqual(brand['brand_logo_url'], 'https://cms.example/logo.png')
        self.assertEqual(brand['brand_socials'], [{'label': 'Facebook', 'url': 'https://facebook.com/cms'}])

    def test_blank_cms_logo_keeps_env_logo(self):
        SiteSettings.objects.create(company_name='CmsBrand', logo_url='')
        self.assertEqual(get_email_brand()['brand_logo_url'], 'https://env.example/logo.png')

    def test_rendered_email_uses_cms_brand_and_footer(self):
        SiteSettings.objects.create(
            company_name='CmsBrand', address='1 Main St', email_support='hi@cms.example',
        )
        html = render_to_string(
            'email/authentication/otp.html',
            {**get_email_brand(), 'code': '123456', 'expires_minutes': 5},
        )
        self.assertIn('CmsBrand', html)
        self.assertIn('1 Main St', html)
        self.assertIn('hi@cms.example', html)
        self.assertNotIn('EnvBrand', html)
