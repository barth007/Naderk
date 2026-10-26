"""Blog: what the public can read, and who may write, publish and feature posts."""
import pytest

from naderk.cms.models import BlogCategory, BlogPost
from naderk.cms.services.blog import create_blog_post, publish_blog_post
from naderk.core.models import User
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

BLOGS = '/api/v1/cms/blogs/'
CATEGORIES = '/api/v1/cms/categories/'


def general():
    return BlogCategory.objects.get_or_create(name='General')[0]


def post(author, title='Caring for your eyes', published=True, **extra):
    extra.setdefault('category', general())
    blog = create_blog_post(author=author, title=title, content=extra.pop('content', 'Some advice.'), **extra)
    return publish_blog_post(blog) if published else blog


def titles(response):
    return [row['title'] for row in response.json()['data']['results']]


@pytest.fixture
def other_doctor():
    return make_user('doctor2@naderk.test', role=User.Role.DOCTOR)


# ── Public reading ───────────────────────────────────────────────────────────

def test_public_list_shows_only_published_posts(api_client, doctor):
    post(doctor, 'Published')
    post(doctor, 'Draft', published=False)
    BlogPost.objects.create(author=doctor, title='Archived', content='x', status='archived', category=general())

    res = api_client.get(BLOGS)

    assert res.status_code == 200
    assert titles(res) == ['Published']
    assert res.json()['data']['count'] == 1


def test_public_list_filters(api_client, doctor):
    eye_care = BlogCategory.objects.create(name='Eye care')
    post(doctor, 'Glaucoma basics', category=eye_care, is_featured=True)
    post(doctor, 'Choosing frames', content='All about acetate.')

    assert titles(api_client.get(BLOGS, {'search': 'glaucoma'})) == ['Glaucoma basics']
    assert titles(api_client.get(BLOGS, {'search': 'ACETATE'})) == ['Choosing frames']
    assert titles(api_client.get(BLOGS, {'category': 'eye-care'})) == ['Glaucoma basics']
    assert titles(api_client.get(BLOGS, {'featured': 'true'})) == ['Glaucoma basics']
    assert titles(api_client.get(BLOGS, {'featured': 'false'})) == ['Choosing frames']


def test_public_list_is_paginated(api_client, doctor):
    for n in range(12):
        post(doctor, f'Post {n}')

    first = api_client.get(BLOGS).json()['data']
    second = api_client.get(BLOGS, {'page': 2}).json()['data']
    small = api_client.get(BLOGS, {'page_size': 5}).json()['data']

    assert (first['count'], len(first['results']), len(second['results'])) == (12, 10, 2)
    assert first['next'] and second['previous']
    assert len(small['results']) == 5


def test_reading_a_post_counts_a_view(api_client, doctor):
    blog = post(doctor)

    res = api_client.get(f'{BLOGS}{blog.slug}/')
    api_client.get(f'{BLOGS}{blog.slug}/')

    assert res.status_code == 200
    assert res.json()['data']['content'] == 'Some advice.'
    blog.refresh_from_db()
    assert blog.views_count == 2


def test_drafts_and_unknown_slugs_are_404_to_the_public(api_client, doctor):
    draft = post(doctor, published=False)

    assert api_client.get(f'{BLOGS}{draft.slug}/').status_code == 404
    assert api_client.get(f'{BLOGS}no-such-post/').status_code == 404


def test_public_author_id_is_the_users_uuid(api_client, doctor):
    post(doctor)

    assert api_client.get(BLOGS).json()['data']['results'][0]['author']['id'] == str(doctor.id)


# ── Slugs and reading time ───────────────────────────────────────────────────

def test_slugs_are_unique_and_always_routable(doctor):
    first, second = post(doctor, 'Dry eyes'), post(doctor, 'Dry eyes')
    numeric, symbols = post(doctor, '2026'), post(doctor, '眼睛')

    assert (first.slug, second.slug) == ('dry-eyes', 'dry-eyes-1')
    assert numeric.slug == 'post-2026'        # a bare number would be read as a post id
    assert symbols.slug == 'post'             # nothing sluggable in the title


def test_reading_time_is_estimated_from_the_content(doctor):
    short = post(doctor, 'Short', content='word ' * 50)
    long = post(doctor, 'Long', content='word ' * 1000)

    assert (short.reading_time, long.reading_time) == ('1 min read', '5 min read')


# ── Writing ──────────────────────────────────────────────────────────────────

def create(user, **body):
    body = {'title': 'T', 'content': 'C', 'category_id': general().id, **body}
    return client_for(user).post(f'{BLOGS}create/', body, format='json')


def test_doctor_creates_a_draft_by_default(doctor):
    res = create(doctor)

    assert res.status_code == 201, res.content
    assert res.json()['data']['status'] == 'DRAFT'
    assert BlogPost.objects.get().author == doctor


def test_creating_with_published_status_publishes_at_once(doctor, api_client):
    res = create(doctor, status='PUBLISHED')

    data = res.json()['data']
    assert data['status'] == 'PUBLISHED' and data['published_at']
    assert api_client.get(f"{BLOGS}{data['slug']}/").status_code == 200


@pytest.mark.parametrize('role', [User.Role.PATIENT, User.Role.AGENT, User.Role.OPTICIAN])
def test_other_roles_cannot_write_posts(role):
    assert create(make_user('x@naderk.test', role=role)).status_code == 403
    assert not BlogPost.objects.exists()


def test_anonymous_cannot_write_posts(api_client):
    assert api_client.post(f'{BLOGS}create/', {'title': 'T', 'content': 'C'}, format='json').status_code == 401


@pytest.mark.parametrize('body', [{'title': ''}, {'content': '   '}])
def test_title_and_content_are_required(doctor, body):
    assert create(doctor, **body).status_code == 400


def test_unknown_category_is_refused(doctor):
    assert create(doctor, category_id=9999).status_code == 404


def test_a_post_cannot_be_created_without_a_category(doctor):
    """The view treats category_id as optional, but the model's validation does not."""
    res = create(doctor, category_id=None)

    assert res.status_code == 400
    assert 'category' in res.json()['errors']


def test_only_cms_staff_can_feature_a_post(doctor, admin_user):
    by_doctor = create(doctor, is_featured=True).json()['data']
    by_admin = create(admin_user, title='Admin post', is_featured=True).json()['data']

    assert (by_doctor['is_featured'], by_admin['is_featured']) == (False, True)


def test_author_edits_their_own_post(doctor):
    blog = post(doctor, published=False)

    res = client_for(doctor).put(f'{BLOGS}{blog.id}/', {'title': 'New title', 'content': 'word ' * 600}, format='json')

    assert res.status_code == 200, res.content
    blog.refresh_from_db()
    assert (blog.title, blog.reading_time) == ('New title', '3 min read')
    assert blog.slug == 'caring-for-your-eyes'      # links to the post keep working


def test_a_doctor_cannot_touch_another_doctors_post(doctor, other_doctor):
    blog = post(doctor)
    as_other = client_for(other_doctor)

    assert as_other.put(f'{BLOGS}{blog.id}/', {'title': 'Hijacked'}, format='json').status_code == 403
    assert as_other.delete(f'{BLOGS}{blog.id}/').status_code == 403
    assert as_other.post(f'{BLOGS}{blog.id}/draft/').status_code == 403
    assert as_other.post(f'{BLOGS}{blog.id}/publish/').status_code == 403
    blog.refresh_from_db()
    assert (blog.title, blog.status) == ('Caring for your eyes', 'published')


def test_cms_staff_can_manage_any_post(doctor, admin_user):
    blog = post(doctor, published=False)

    assert client_for(admin_user).post(f'{BLOGS}{blog.id}/publish/').status_code == 200
    assert client_for(admin_user).delete(f'{BLOGS}{blog.id}/').status_code == 200
    assert not BlogPost.objects.exists()


def test_publish_then_back_to_draft(doctor, api_client):
    blog = post(doctor, published=False)

    published = client_for(doctor).post(f'{BLOGS}{blog.id}/publish/').json()['data']
    assert published['status'] == 'PUBLISHED'
    assert api_client.get(f'{BLOGS}{blog.slug}/').status_code == 200

    client_for(doctor).post(f'{BLOGS}{blog.id}/draft/')
    assert api_client.get(f'{BLOGS}{blog.slug}/').status_code == 404


def test_republishing_keeps_the_original_publication_date(doctor):
    blog = post(doctor)
    first = blog.published_at
    client_for(doctor).post(f'{BLOGS}{blog.id}/draft/')

    client_for(doctor).post(f'{BLOGS}{blog.id}/publish/')

    blog.refresh_from_db()
    assert blog.published_at == first


@pytest.mark.parametrize('requested, stored', [('PUBLISHED', 'published'), ('ARCHIVED', 'archived'), ('draft', 'draft')])
def test_status_can_be_changed_through_the_edit_form(doctor, requested, stored):
    blog = post(doctor, published=(requested == 'draft'))

    client_for(doctor).put(f'{BLOGS}{blog.id}/', {'status': requested}, format='json')

    blog.refresh_from_db()
    assert blog.status == stored


def test_unknown_post_is_404(doctor):
    assert client_for(doctor).put(f'{BLOGS}9999/', {'title': 'x'}, format='json').status_code == 404
    assert client_for(doctor).post(f'{BLOGS}9999/publish/').status_code == 404


# ── Author and admin lists ───────────────────────────────────────────────────

def test_my_posts_lists_every_status_but_only_mine(doctor, other_doctor):
    post(doctor, 'Mine published')
    post(doctor, 'Mine draft', published=False)
    post(other_doctor, 'Theirs')

    res = client_for(doctor).get(f'{BLOGS}my/')

    assert sorted(titles(res)) == ['Mine draft', 'Mine published']
    assert client_for(make_user('p@naderk.test')).get(f'{BLOGS}my/').status_code == 403


def test_all_posts_is_for_cms_staff_only(doctor, other_doctor, admin_user):
    post(doctor, 'One', published=False)
    post(other_doctor, 'Two')

    assert sorted(titles(client_for(admin_user).get(f'{BLOGS}all/'))) == ['One', 'Two']
    assert client_for(doctor).get(f'{BLOGS}all/').status_code == 403


# ── Categories ───────────────────────────────────────────────────────────────

def test_categories_are_public(api_client):
    BlogCategory.objects.create(name='Eye care')

    rows = api_client.get(CATEGORIES).json()['data']['results']

    assert ('Eye care', 'eye-care') in [(c['name'], c['slug']) for c in rows]


def test_cms_staff_manage_categories(admin_user):
    client = client_for(admin_user)

    created = client.post(f'{CATEGORIES}create/', {'name': 'Eye care', 'description': 'Tips'}, format='json')
    pk = created.json()['data']['id']
    renamed = client.put(f'{CATEGORIES}{pk}/', {'name': 'Vision care'}, format='json')

    assert (created.status_code, renamed.status_code) == (201, 200)
    assert BlogCategory.objects.get(pk=pk).name == 'Vision care'
    assert client.delete(f'{CATEGORIES}{pk}/').status_code == 200
    assert not BlogCategory.objects.filter(pk=pk).exists()


def test_category_names_are_unique_whatever_the_case(admin_user):
    client = client_for(admin_user)
    BlogCategory.objects.create(name='Eye care')
    other = BlogCategory.objects.create(name='Frames')

    assert client.post(f'{CATEGORIES}create/', {'name': 'EYE CARE'}, format='json').status_code == 409
    assert client.put(f'{CATEGORIES}{other.id}/', {'name': 'eye care'}, format='json').status_code == 409
    assert client.post(f'{CATEGORIES}create/', {'name': ' '}, format='json').status_code == 400


def test_doctors_and_patients_cannot_manage_categories(doctor, patient):
    category = BlogCategory.objects.create(name='Eye care')

    for user in (doctor, patient):
        client = client_for(user)
        assert client.post(f'{CATEGORIES}create/', {'name': 'New'}, format='json').status_code == 403
        assert client.put(f'{CATEGORIES}{category.id}/', {'name': 'New'}, format='json').status_code == 403
        assert client.delete(f'{CATEGORIES}{category.id}/').status_code == 403


def test_deleting_a_category_keeps_its_posts(doctor, admin_user):
    category = BlogCategory.objects.create(name='Eye care')
    blog = post(doctor, category=category)

    client_for(admin_user).delete(f'{CATEGORIES}{category.id}/')

    blog.refresh_from_db()
    assert blog.category is None
