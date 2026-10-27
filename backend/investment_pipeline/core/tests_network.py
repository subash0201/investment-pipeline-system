"""Tests for the investment-network features (portfolios, engagement, communities,
members, recommendations, service requests, dashboards, sign-up, import)."""
import io
import json
import tempfile
from decimal import Decimal
from pathlib import Path

from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APITestCase

from .models import (
    Community, CommunityPost, PortfolioComment, PortfolioLike, Project, ServiceRequest, Stage, User,
)

LONG = 'Community solar and storage micro-grid for twelve villages.'


class NetworkCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.sam = User.objects.create_user('sam@example.com', 'pw', first_name='Sam', last_name='Rivera',
                                           actor_type='startup', sdg_interests=[7], followed_collections=['member'])
        cls.priya = User.objects.create_user('priya@example.com', 'pw', first_name='Priya', last_name='Nair',
                                             actor_type='investor', sdg_interests=[2, 13],
                                             followed_collections=['draft'])
        cls.admin = User.objects.create_superuser('alex@example.com', 'pw', first_name='Alex', last_name='Morgan')
        cls.public = Project.objects.create(
            name='Digital Market Price Information System', description=LONG, owner=cls.admin,
            stage=Stage.REGISTERED, collection='draft', category='Agriculture and Food', primary_sdg=2,
            reference='2_SDG2_INT_005', total_investment=Decimal('5000000000'),
            digital_investment=Decimal('1000000000'), ai_investment=Decimal('800000000'),
            details={'purpose': 'Improve price transparency.'})
        cls.nap = Project.objects.create(
            name='Climate-Smart Agriculture', description=LONG, owner=cls.admin, stage=Stage.REGISTERED,
            collection='nap', category='Agriculture', primary_sdg=13, total_investment=Decimal('2000000000'))
        cls.draft = Project.objects.create(name='Secret draft', description='', owner=cls.sam)

    def setUp(self):
        cache.clear()  # rate limits

    def login(self, user):
        self.client.force_authenticate(user)


class PublicPortfolioTests(NetworkCase):
    def test_anonymous_can_browse_but_not_see_drafts(self):
        response = self.client.get('/api/portfolios/')
        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in response.data['results']]
        self.assertIn(self.public.name, names)
        self.assertNotIn('Secret draft', names)
        self.assertEqual(self.client.get(f'/api/portfolios/{self.draft.id}/').status_code, 404)

    def test_owner_can_open_own_draft(self):
        self.login(self.sam)
        self.assertEqual(self.client.get(f'/api/portfolios/{self.draft.id}/').status_code, 200)

    def test_filters_and_sorting(self):
        rows = self.client.get('/api/portfolios/?collection=nap').data['results']
        self.assertEqual([r['id'] for r in rows], [self.nap.id])
        rows = self.client.get('/api/portfolios/?sdg=2').data['results']
        self.assertEqual([r['id'] for r in rows], [self.public.id])
        rows = self.client.get('/api/portfolios/?q=2_SDG2').data['results']
        self.assertEqual([r['id'] for r in rows], [self.public.id])
        rows = self.client.get('/api/portfolios/?sort=largest').data['results']
        self.assertEqual(rows[0]['id'], self.public.id)

    def test_detail_has_sections_and_costing(self):
        data = self.client.get(f'/api/portfolios/{self.public.id}/').data
        self.assertEqual(data['collection_display'], 'Draft Portfolio')
        self.assertEqual(data['sections'], [{'key': 'purpose', 'label': 'Purpose', 'text': 'Improve price transparency.'}])
        self.assertEqual(Decimal(data['total_investment']), Decimal('5000000000'))
        self.assertFalse(data['can_manage'])

    def test_compare_keeps_order_and_caps_at_four(self):
        ids = f'{self.nap.id},{self.public.id},{self.draft.id}'
        data = self.client.get(f'/api/portfolios/compare/?ids={ids}').data
        self.assertEqual([row['id'] for row in data], [self.nap.id, self.public.id])  # draft is not public


class EngagementTests(NetworkCase):
    def test_like_requires_login_and_toggles(self):
        url = f'/api/portfolios/{self.public.id}/like/'
        self.assertEqual(self.client.post(url).status_code, 401)
        self.login(self.priya)
        self.assertEqual(self.client.post(url).data['likes'], 1)
        self.assertEqual(self.client.post(url).data['likes'], 1)  # liking twice is harmless
        listed = self.client.get('/api/portfolios/?collection=draft').data['results'][0]
        self.assertTrue(listed['liked'])
        self.assertEqual(self.client.delete(url).data, {'liked': False, 'likes': 0, 'comments': 0, 'shares': 0})

    def test_comments(self):
        url = f'/api/portfolios/{self.public.id}/comments/'
        self.assertEqual(self.client.post(url, {'body': 'Hi'}).status_code, 401)
        self.login(self.priya)
        self.assertEqual(self.client.post(url, {'body': '   '}).status_code, 400)
        created = self.client.post(url, {'body': 'Interested in a pilot.'}).data
        self.assertTrue(created['can_delete'])
        self.client.force_authenticate(None)
        listed = self.client.get(url).data
        self.assertEqual(listed[0]['user_name'], 'Priya Nair')
        self.assertEqual(listed[0]['user_actor'], 'Investor')
        self.login(self.sam)
        self.assertEqual(self.client.delete(f'/api/comments/{created["id"]}/').status_code, 403)
        self.login(self.admin)
        self.assertEqual(self.client.delete(f'/api/comments/{created["id"]}/').status_code, 204)

    def test_share_counts_and_validates_channel(self):
        url = f'/api/portfolios/{self.public.id}/share/'
        self.assertEqual(self.client.post(url, {'channel': 'whatsapp'}).data['shares'], 1)
        self.assertEqual(self.client.post(url, {'channel': 'fax'}).status_code, 400)


class SignUpAndProfileTests(NetworkCase):
    def test_join_creates_user_account_with_profile(self):
        response = self.client.post('/api/auth/register/', {
            'first_name': 'Maya', 'last_name': 'Gurung', 'email': 'MAYA@example.com',
            'password': 'a-strong-pass-123', 'actor_type': 'investment_firm', 'organization': 'Everest Capital',
            'sdg_interests': [9, 7, 9], 'followed_collections': ['sovereign'],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['user']['role'], 'USER')
        self.assertEqual(response.data['user']['actor_type_display'], 'Investment Firm')
        user = User.objects.get(email='maya@example.com')
        self.assertEqual(user.sdg_interests, [7, 9])
        self.assertFalse(user.is_staff)

    def test_join_validation(self):
        bad = self.client.post('/api/auth/register/', {
            'first_name': 'X', 'email': 'sam@example.com', 'password': 'short', 'actor_type': 'pirate',
        }, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertIn('email', bad.data)
        self.assertIn('actor_type', bad.data)

    def test_join_cannot_grant_admin(self):
        response = self.client.post('/api/auth/register/', {
            'first_name': 'Eve', 'email': 'eve@example.com', 'password': 'a-strong-pass-123',
            'actor_type': 'media', 'role': 'ADMIN', 'is_staff': True,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get(email='eve@example.com').role, 'USER')

    def test_edit_profile(self):
        self.login(self.sam)
        response = self.client.patch('/api/auth/me/', {
            'headline': 'Founder', 'sdg_interests': [13], 'role': 'ADMIN'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['headline'], 'Founder')
        self.assertEqual(response.data['role'], 'USER')
        self.assertEqual(self.client.patch('/api/auth/me/', {'sdg_interests': [18]}, format='json').status_code, 400)


class PortfolioProfileTests(NetworkCase):
    def test_owner_edits_profile_after_registration_but_not_name(self):
        self.login(self.sam)
        project = self.client.post('/api/projects/', {'name': 'Solar', 'description': LONG, 'submit': True}).data
        self.assertEqual(project['collection'], 'member')
        url = f'/api/projects/{project["id"]}/'
        ok = self.client.patch(url, {'category': 'Energy', 'total_investment': '1500000',
                                     'details': {'purpose': 'Power 12 villages', 'risk_register': ''}}, format='json')
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data['details'], {'purpose': 'Power 12 villages'})
        self.assertEqual(self.client.patch(url, {'name': 'Renamed'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'details': {'nonsense': 'x'}}, format='json').status_code, 400)

    def test_only_admin_sets_catalogue_collection(self):
        self.login(self.sam)
        refused = self.client.post('/api/projects/', {'name': 'X', 'collection': 'nap'}, format='json')
        self.assertEqual(refused.status_code, 400)
        self.login(self.admin)
        allowed = self.client.post('/api/projects/', {'name': 'Y', 'collection': 'nap'}, format='json')
        self.assertEqual(allowed.status_code, 201)
        self.assertEqual(allowed.data['collection'], 'nap')


class CommunityTests(NetworkCase):
    def test_communities_are_seeded_by_migration(self):
        data = self.client.get('/api/communities/').data
        self.assertEqual(len(data), 11)
        self.assertEqual({row['pillar'] for row in data}, {'information', 'knowledge', 'communities', 'investment'})

    def test_join_post_leave(self):
        slug = 'investors-circle'
        self.login(self.priya)
        self.assertEqual(self.client.post(f'/api/communities/{slug}/posts/', {'body': 'Hi'}).status_code, 403)
        self.assertTrue(self.client.post(f'/api/communities/{slug}/join/').data['is_member'])
        post = self.client.post(f'/api/communities/{slug}/posts/',
                                {'body': 'Looking for co-investors', 'project': self.public.id}, format='json')
        self.assertEqual(post.status_code, 201, post.data)
        self.assertEqual(post.data['project_name'], self.public.name)
        self.assertEqual(self.client.get(f'/api/communities/{slug}/').data['post_count'], 1)
        left = self.client.post(f'/api/communities/{slug}/leave/').data
        self.assertFalse(left['is_member'])
        self.assertEqual(left['member_count'], 0)

    def test_cannot_attach_a_draft_to_a_post(self):
        self.login(self.sam)
        self.client.post('/api/communities/investors-circle/join/')
        response = self.client.post('/api/communities/investors-circle/posts/',
                                    {'body': 'x', 'project': self.draft.id}, format='json')
        self.assertEqual(response.status_code, 400)


class MembersAndRecommendationTests(NetworkCase):
    def test_directory_requires_login_and_hides_email(self):
        self.assertEqual(self.client.get('/api/members/').status_code, 401)
        self.login(self.sam)
        rows = self.client.get('/api/members/?actor_type=investor').data['results']
        self.assertEqual([r['name'] for r in rows], ['Priya Nair'])
        self.assertNotIn('email', rows[0])

    def test_recommendations_follow_interests(self):
        self.login(self.priya)
        data = self.client.get('/api/recommendations/').data
        self.assertTrue(data['profile_complete'])
        self.assertEqual(data['results'][0]['id'], self.public.id)  # draft collection + SDG 2
        self.assertTrue(any('SDG 2' in reason for reason in data['results'][0]['reasons']))

    def test_recommendations_skip_own_portfolios(self):
        self.login(self.admin)
        ids = [row['id'] for row in self.client.get('/api/recommendations/').data['results']]
        self.assertNotIn(self.public.id, ids)


class ServiceRequestTests(NetworkCase):
    def test_member_requests_and_admin_handles(self):
        self.login(self.priya)
        created = self.client.post('/api/service-requests/', {
            'service': 'due_diligence', 'project': self.public.id, 'community': 'due-diligence-advisory',
            'message': 'Please run technical due diligence.'}, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['status'], 'OPEN')
        self.assertIsNone(created.data['requester_email'])
        rid = created.data['id']
        self.assertEqual(self.client.patch(f'/api/service-requests/{rid}/', {'status': 'CLOSED'}).status_code, 403)
        self.login(self.sam)
        self.assertEqual(self.client.get(f'/api/service-requests/{rid}/').status_code, 404)
        self.login(self.admin)
        done = self.client.patch(f'/api/service-requests/{rid}/', {'status': 'IN_PROGRESS', 'admin_notes': 'On it'})
        self.assertEqual(done.data['status_display'], 'In progress')
        self.assertEqual(done.data['requester_email'], 'priya@example.com')
        self.assertEqual(self.client.get('/api/service-requests/counts/').data, {'open': 0, 'in_progress': 1, 'closed': 0})


class DashboardAndFeedTests(NetworkCase):
    def test_overview_and_dashboard(self):
        PortfolioLike.objects.create(user=self.priya, project=self.public)
        PortfolioComment.objects.create(user=self.priya, project=self.public, body='Nice')
        overview = self.client.get('/api/network/overview/').data
        self.assertEqual(overview['portfolios'], 2)
        self.assertEqual(overview['sdg_investment_billion'], 7.0)
        self.assertEqual(overview['communities'], 11)
        self.assertEqual(overview['most_engaged'][0]['id'], self.public.id)
        dash = self.client.get('/api/network/dashboard/').data
        self.assertEqual(dash['sdg_investment']['digital_pct'], 14)
        self.assertEqual(dash['nap']['total_billion'], 2.0)
        self.assertEqual(dash['engagement']['likes'], 1)
        self.assertEqual(len(dash['engagement']['last_30_days']), 30)
        self.assertEqual(len(dash['affinity']['rows']), 13)

    def test_feed_mixes_portfolios_comments_and_posts(self):
        PortfolioComment.objects.create(user=self.priya, project=self.public, body='Nice')
        CommunityPost.objects.create(community=Community.objects.first(), author=self.priya, body='Hello')
        kinds = {item['type'] for item in self.client.get('/api/network/feed/').data}
        self.assertEqual(kinds, {'portfolio', 'comment', 'post'})

    def test_health(self):
        self.assertEqual(self.client.get('/api/health/').data, {'status': 'ok'})


class ImportCommandTests(NetworkCase):
    def test_import_json_and_reimport_updates(self):
        records = [{
            'name': 'National Sovereign Cloud', 'collection': 'sovereign', 'reference': 'SOV_L05',
            'category': 'Layer 5', 'primary_sdg': 9, 'secondary_sdgs': [16], 'total_investment': '28',
            'digital_investment': 28, 'objectives': ['Host data in Nepal', 'Meet the AI policy'],
            'details': {'nepal_context': {'internet_users': '72%'}},
        }, {'collection': 'nap'}]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'portfolios.json'
            path.write_text(json.dumps(records))
            call_command('import_portfolios', str(path), '--unit', 'billion', verbosity=0,    stderr=io.StringIO(), stdout=io.StringIO())
            project = Project.objects.get(reference='SOV_L05')
            self.assertEqual(project.stage, Stage.REGISTERED)
            self.assertEqual(project.total_investment, Decimal('28000000000'))
            self.assertEqual(project.details['objectives'], '• Host data in Nepal\n• Meet the AI policy')
            self.assertEqual(project.details['nepal_context'], 'Internet users: 72%')
            self.assertEqual(sorted(project.sdgs.values_list('goal', flat=True)), [9, 16])
            records[0]['name'] = 'Sovereign Cloud (renamed)'
            path.write_text(json.dumps(records))
            call_command('import_portfolios', str(path), verbosity=0,    stderr=io.StringIO(), stdout=io.StringIO())
            self.assertEqual(Project.objects.filter(reference='SOV_L05').count(), 1)
            self.assertEqual(Project.objects.get(reference='SOV_L05').name, 'Sovereign Cloud (renamed)')


class SeedTests(APITestCase):
    def test_seed_demo_includes_network_data(self):
        call_command('seed_demo', verbosity=0)
        self.assertGreater(Project.objects.exclude(collection='member').count(), 10)
        self.assertTrue(ServiceRequest.objects.exists())
        self.assertTrue(CommunityPost.objects.exists())
        self.assertEqual(User.objects.get(email='priya.nair@example.com').actor_type, 'investor')
