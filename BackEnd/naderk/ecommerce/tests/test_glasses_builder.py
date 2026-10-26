"""The glasses builder: admin-configured fields and prescription-driven lens rules."""
from decimal import Decimal

import pytest

from naderk.ecommerce.models import BuilderFieldConfig, LensOption, LensRecommendationRule, LensType
from naderk.ecommerce.services import (
    DEFAULT_BUILDER_FIELDS, compute_prescription_metrics, ensure_default_builder_fields,
    evaluate_lens_recommendations,
)
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

BUILDER = '/api/v1/marketplace/builder/'
R = LensRecommendationRule


def lens(name):
    return LensType.objects.create(name=name, description='x')


def rule(metric='SPH', operator=R.Operator.GTE, threshold='6.00', action=R.Action.RECOMMEND,
         types=(), options=(), **extra):
    created = R.objects.create(name=extra.pop('name', 'Rule'), metric=metric, operator=operator,
                               threshold=Decimal(threshold), action=action, **extra)
    created.target_lens_types.set(types)
    created.target_lens_options.set(options)
    return created


# ── Metrics ──────────────────────────────────────────────────────────────────

def test_metrics_use_the_stronger_eye_whatever_its_sign():
    metrics = compute_prescription_metrics({
        'right_sph': '-1.50', 'left_sph': '-6.25', 'right_cyl': '0.75', 'left_cyl': '-0.50',
        'right_add': '', 'left_add': None, 'pupillary_distance': '63', 'extra': {'CUSTOM_TINT': '2', 'NOTE': 'abc'},
    })

    assert metrics['SPH'] == Decimal('-6.25')
    assert metrics['CYL'] == Decimal('0.75')
    assert metrics['ADD'] is None
    assert metrics['PD'] == Decimal('63')
    assert (metrics['CUSTOM_TINT'], metrics['NOTE']) == (Decimal('2'), None)


def test_unparseable_values_are_treated_as_missing():
    assert compute_prescription_metrics({'right_sph': 'strong', 'left_sph': '-2'})['SPH'] == Decimal('-2')
    assert compute_prescription_metrics({})['SPH'] is None


# ── Rules ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize('operator, threshold, threshold_max, value, matches', [
    (R.Operator.GTE, '6.00', None, '-6.00', True),      # absolute value by default
    (R.Operator.GTE, '6.00', None, '-5.75', False),
    (R.Operator.GT, '6.00', None, '6.00', False),
    (R.Operator.LTE, '2.00', None, '-2.00', True),
    (R.Operator.LT, '2.00', None, '2.00', False),
    (R.Operator.EQ, '0.00', None, '0', True),
    (R.Operator.BETWEEN, '2.00', '4.00', '-3.00', True),
    (R.Operator.BETWEEN, '2.00', '4.00', '4.25', False),
    (R.Operator.BETWEEN, '2.00', None, '3.00', False),  # no upper bound configured
])
def test_operators(operator, threshold, threshold_max, value, matches):
    high_index = lens('High index')
    rule(operator=operator, threshold=threshold, types=[high_index],
         threshold_max=Decimal(threshold_max) if threshold_max else None)

    result = evaluate_lens_recommendations({'right_sph': value})

    assert (result['recommended_lens_type_ids'] == [str(high_index.id)]) is matches


def test_signed_comparison_when_absolute_is_off():
    plus_lens = lens('Plus lens')
    rule(operator=R.Operator.GTE, threshold='2.00', use_absolute=False, types=[plus_lens])

    assert evaluate_lens_recommendations({'right_sph': '-5.00'})['recommended_lens_type_ids'] == []
    assert evaluate_lens_recommendations({'right_sph': '2.50'})['recommended_lens_type_ids'] == [str(plus_lens.id)]


def test_each_action_fills_its_own_list_and_messages_are_collected():
    high_index, standard, progressive = lens('High index'), lens('Standard'), lens('Progressive')
    coating = LensOption.objects.create(name='Anti-glare')
    rule(types=[high_index], options=[coating], message='Thinner lenses suit strong prescriptions.')
    rule(action=R.Action.HIDE, types=[standard], name='Hide standard')
    rule(metric='ADD', threshold='0.75', action=R.Action.RESTRICT, types=[progressive], name='Reading add')

    result = evaluate_lens_recommendations({'left_sph': '-7.00', 'right_add': '1.50'})

    assert result['recommended_lens_type_ids'] == [str(high_index.id)]
    assert result['recommended_lens_option_ids'] == [str(coating.id)]
    assert result['hidden_lens_type_ids'] == [str(standard.id)]
    assert result['allowed_lens_type_ids'] == [str(progressive.id)]
    assert result['allowed_lens_option_ids'] is None            # no option was restricted
    assert result['messages'] == ['Thinner lenses suit strong prescriptions.']
    assert result['metrics']['SPH'] == '-7.00'


def test_nothing_matches_without_values_or_with_inactive_rules():
    high_index = lens('High index')
    rule(types=[high_index], is_active=False)
    rule(metric='CYL', threshold='0.00', types=[high_index], name='Needs CYL')

    result = evaluate_lens_recommendations({'right_sph': '-9.00'})

    assert result['recommended_lens_type_ids'] == []
    assert result['allowed_lens_type_ids'] is None


def test_rules_can_test_a_custom_field():
    tinted = lens('Tinted')
    rule(metric='CUSTOM_LIGHT_SENSITIVITY', threshold='3', types=[tinted])

    result = evaluate_lens_recommendations({'extra': {'CUSTOM_LIGHT_SENSITIVITY': '4'}})

    assert result['recommended_lens_type_ids'] == [str(tinted.id)]


def test_recommendations_endpoint(patient, api_client):
    high_index = lens('High index')
    rule(types=[high_index])

    res = client_for(patient).post(BUILDER + 'recommendations/', {'right_sph': '-6.50'}, format='json')

    assert res.status_code == 200, res.content
    assert res.json()['data']['recommended_lens_type_ids'] == [str(high_index.id)]
    assert api_client.post(BUILDER + 'recommendations/', {}, format='json').status_code == 401


# ── Field configuration ──────────────────────────────────────────────────────

def test_default_fields_are_seeded_once():
    ensure_default_builder_fields()
    ensure_default_builder_fields()

    assert BuilderFieldConfig.objects.count() == len(DEFAULT_BUILDER_FIELDS)
    sph = BuilderFieldConfig.objects.get(field_key='SPH')
    assert (sph.is_required, sph.min_value, sph.max_value) == (True, Decimal('-20'), Decimal('20'))


def test_patients_see_only_visible_fields_admins_see_all(patient, admin_user):
    patient_keys = {f['field_key'] for f in client_for(patient).get(BUILDER + 'config/').json()['data']}
    admin_keys = {f['field_key'] for f in client_for(admin_user).get(BUILDER + 'config/').json()['data']}

    assert 'NEAR_PD' not in patient_keys and 'SPH' in patient_keys
    assert 'NEAR_PD' in admin_keys


def test_admin_updates_fields_in_bulk(patient, admin_user):
    ensure_default_builder_fields()
    near_pd = BuilderFieldConfig.objects.get(field_key='NEAR_PD')

    res = client_for(admin_user).put(BUILDER + 'config/', {'fields': [
        {'id': str(near_pd.id), 'is_visible': True, 'is_required': True},
        {'id': '00000000-0000-0000-0000-000000000000', 'is_visible': False},     # unknown: skipped
    ]}, format='json')

    assert res.status_code == 200, res.content
    near_pd.refresh_from_db()
    assert (near_pd.is_visible, near_pd.is_required) == (True, True)
    assert client_for(patient).put(BUILDER + 'config/', {'fields': []}, format='json').status_code == 403


def test_admin_adds_and_removes_a_custom_field(admin_user):
    client = client_for(admin_user)

    first = client.post(BUILDER + 'config/', {'label': 'Light sensitivity', 'max_value': '5'}, format='json')
    second = client.post(BUILDER + 'config/', {'label': 'Light sensitivity'}, format='json')

    assert (first.status_code, second.status_code) == (201, 201)
    assert first.json()['data']['field_key'] == 'CUSTOM_LIGHT_SENSITIVITY'
    assert second.json()['data']['field_key'] == 'CUSTOM_LIGHT_SENSITIVITY_2'
    assert first.json()['data']['is_custom'] is True

    assert client.delete(f"{BUILDER}config/{first.json()['data']['id']}/").status_code == 200
    assert not BuilderFieldConfig.objects.filter(field_key='CUSTOM_LIGHT_SENSITIVITY').exists()


def test_built_in_fields_cannot_be_deleted(admin_user, patient):
    ensure_default_builder_fields()
    sph = BuilderFieldConfig.objects.get(field_key='SPH')

    assert client_for(admin_user).delete(f'{BUILDER}config/{sph.id}/').status_code == 400
    assert client_for(patient).delete(f'{BUILDER}config/{sph.id}/').status_code == 403
    assert BuilderFieldConfig.objects.filter(pk=sph.pk).exists()


# ── Rule administration ──────────────────────────────────────────────────────

def test_admin_manages_rules(admin_user):
    client = client_for(admin_user)
    high_index = lens('High index')

    created = client.post(BUILDER + 'rules/', {
        'name': 'Strong minus', 'metric': 'SPH', 'operator': 'GTE', 'threshold': '6.00',
        'action': 'RECOMMEND', 'target_lens_type_ids': [str(high_index.id)],
    }, format='json')
    assert created.status_code == 201, created.content
    pk = created.json()['data']['id']
    assert created.json()['data']['target_lens_type_names'] == ['High index']

    assert client.patch(f'{BUILDER}rules/{pk}/', {'threshold': '8.00'}, format='json').status_code == 200
    assert R.objects.get(pk=pk).threshold == Decimal('8.00')
    assert len(client.get(BUILDER + 'rules/').json()['data']) == 1

    assert client.delete(f'{BUILDER}rules/{pk}/').status_code == 200
    assert not R.objects.exists()


def test_a_between_rule_needs_an_upper_bound(admin_user):
    res = client_for(admin_user).post(BUILDER + 'rules/', {
        'name': 'Mid range', 'metric': 'SPH', 'operator': 'BETWEEN', 'threshold': '2.00', 'action': 'RECOMMEND',
    }, format='json')

    assert res.status_code == 400
    assert 'threshold_max' in res.json()['errors']


def test_rules_are_admin_only(patient, doctor):
    existing = rule()

    for user in (patient, doctor):
        client = client_for(user)
        assert client.get(BUILDER + 'rules/').status_code == 403
        assert client.post(BUILDER + 'rules/', {}, format='json').status_code == 403
        assert client.patch(f'{BUILDER}rules/{existing.id}/', {}, format='json').status_code == 403
        assert client.delete(f'{BUILDER}rules/{existing.id}/').status_code == 403


def test_unknown_rule_is_404(admin_user):
    client = client_for(admin_user)
    missing = f'{BUILDER}rules/00000000-0000-0000-0000-000000000000/'

    assert client.patch(missing, {}, format='json').status_code == 404
    assert client.delete(missing).status_code == 404
