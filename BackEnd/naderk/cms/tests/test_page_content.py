from django.test import TestCase


class PageContentTests(TestCase):
    """
    Page copy lived in TypeScript constants — about.constants.ts alone is 168
    lines — so changing a headline or a picture needed a developer and a deploy.
    """

    def setUp(self):
        from rest_framework.test import APIClient
        from django.contrib.auth import get_user_model
        User = get_user_model()

        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='cms-admin@x.com', password='pw12345!', role='ADMIN'
        )
        from django.core.management import call_command
        from io import StringIO
        call_command('seed_page_content', '--page', 'about', stdout=StringIO())

    def test_public_read_needs_no_auth(self):
        res = self.client.get('/api/v1/cms/pages/about/')
        self.assertEqual(res.status_code, 200)
        sections = res.json()['data']['sections']
        self.assertIn('hero', sections)
        self.assertIn('core_pillars', sections)

    def test_unknown_page_is_404(self):
        self.assertEqual(self.client.get('/api/v1/cms/pages/nope/').status_code, 404)

    def test_schema_is_admin_only(self):
        self.assertIn(self.client.get('/api/v1/cms/pages/about/schema/').status_code, (401, 403))
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get('/api/v1/cms/pages/about/schema/').status_code, 200)

    def test_saving_a_section_changes_the_public_page(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.put(
            '/api/v1/cms/pages/about/sections/hero/',
            {'content': {'title': 'Brand New Title', 'badge': 'B'}},
            format='json',
        )
        self.assertEqual(res.status_code, 200)

        self.client.force_authenticate(user=None)
        public = self.client.get('/api/v1/cms/pages/about/').json()['data']['sections']
        self.assertEqual(public['hero']['title'], 'Brand New Title')

    def test_unknown_fields_are_stripped(self):
        """A stale client must not be able to write arbitrary keys into the blob."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.put(
            '/api/v1/cms/pages/about/sections/hero/',
            {'content': {'title': 'T', 'evil': 'x'}},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('evil', res.json()['data']['content'])

    def test_unknown_section_is_rejected(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.put(
            '/api/v1/cms/pages/about/sections/not_a_section/',
            {'content': {}}, format='json',
        )
        self.assertEqual(res.status_code, 404)

    def test_seeder_does_not_clobber_edits(self):
        from django.core.management import call_command
        from io import StringIO
        from naderk.cms.models import PageSection

        section = PageSection.objects.get(page='about', section_key='hero')
        section.content = {'title': 'Edited by hand'}
        section.save(update_fields=['content'])

        call_command('seed_page_content', '--page', 'about', stdout=StringIO())
        section.refresh_from_db()
        self.assertEqual(section.content['title'], 'Edited by hand')
