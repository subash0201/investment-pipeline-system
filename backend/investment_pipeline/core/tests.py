from datetime import date

from django.core.management import call_command
from rest_framework.test import APITestCase

from .models import Project, ReadinessScore, RegistryEntry, Stage, StageRequest, User

LONG = 'Community solar and storage micro-grid for twelve villages.'


class BaseCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.sam = User.objects.create_user('sam@example.com', 'pw', first_name='Sam', last_name='Rivera')
        cls.jo = User.objects.create_user('jo@example.com', 'pw', first_name='Jo', last_name='Patel')
        cls.admin = User.objects.create_superuser('alex@example.com', 'pw', first_name='Alex', last_name='Morgan')

    def as_user(self, user):
        self.client.force_authenticate(user)

    def register(self, name='Solar Micro-grid', description=LONG, submit=True):
        response = self.client.post('/api/projects/', {'name': name, 'description': description, 'submit': submit})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def tag(self, pk, goals=(7,)):
        return self.client.put(f'/api/projects/{pk}/sdgs/', {'goals': [
            {'goal': g, 'indicators': [{'name': 'Share (%)', 'target_value': 60, 'current_value': 30}]}
            for g in goals]}, format='json')

    def score(self, pk, value):
        return self.client.post(f'/api/projects/{pk}/scores/', {'evaluation_date': '2026-09-20', 'score': value})

    def ask(self, pk, **extra):
        return self.client.post('/api/stage-requests/', {'project': pk, **extra})

    def decide(self, request_id, verdict, comments=''):
        self.as_user(self.admin)
        response = self.client.post(f'/api/stage-requests/{request_id}/{verdict}/', {'comments': comments})
        self.as_user(self.sam)
        return response

    def stage_of(self, pk):
        return Project.objects.get(pk=pk).stage

    def advance_to_under_review(self):
        project = self.register()
        request = self.ask(project['id']).data['request']
        self.decide(request['id'], 'approve')
        return project['id']


class AuthTests(BaseCase):
    def test_login_returns_token_and_role(self):
        response = self.client.post('/api/auth/login/', {'email': 'ALEX@example.com', 'password': 'pw'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['role'], 'ADMIN')
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + response.data['token'])
        self.assertEqual(self.client.get('/api/auth/me/').data['name'], 'Alex Morgan')

    def test_bad_credentials(self):
        response = self.client.post('/api/auth/login/', {'email': 'sam@example.com', 'password': 'nope'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'Invalid email or password. Please try again.')

    def test_anonymous_is_refused(self):
        self.assertEqual(self.client.get('/api/projects/').status_code, 401)

    def test_logout_revokes_token(self):
        token = self.client.post('/api/auth/login/', {'email': 'sam@example.com', 'password': 'pw'}).data['token']
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token)
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)


class RegistrationTests(BaseCase):
    def setUp(self):
        self.as_user(self.sam)

    def test_submit_registers_and_records_history(self):
        project = self.register()
        self.assertEqual(project['code'], 'PRJ-0001')
        self.assertEqual(project['stage'], Stage.REGISTERED)
        self.assertEqual(project['status'], 'Active')
        self.assertEqual([h['stage'] for h in project['history']],
                         [Stage.DRAFT, Stage.REGISTERED, Stage.UNDER_REVIEW])
        self.assertEqual(project['history'][-1]['status'], 'Not started')

    def test_validation_errors(self):
        response = self.client.post('/api/projects/', {'name': '', 'description': 'Solar project.', 'submit': True})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['name'][0], 'Project name is required.')
        response = self.client.post('/api/projects/', {'name': 'X', 'description': 'Solar project.', 'submit': True})
        self.assertEqual(response.data['description'][0], 'Description must be at least 30 characters.')

    def test_draft_can_be_short_then_edited_and_submitted(self):
        draft = self.register(description='Short.', submit=False)
        self.assertEqual(draft['stage'], Stage.DRAFT)
        self.assertEqual(draft['status'], 'Draft')
        url = f"/api/projects/{draft['id']}/"
        self.assertEqual(self.client.patch(url, {'submit': True}).status_code, 400)
        response = self.client.patch(url, {'description': LONG, 'submit': True})
        self.assertEqual(response.data['stage'], Stage.REGISTERED)
        self.assertEqual(self.client.patch(url, {'name': 'Renamed'}).status_code, 400)

    def test_codes_keep_counting_up(self):
        self.register()
        Project.objects.create(code='PRJ-0042', name='Seeded', owner=self.sam)
        self.assertEqual(self.register(name='Next')['code'], 'PRJ-0043')

    def test_users_only_see_their_own(self):
        mine = self.register()
        self.as_user(self.jo)
        self.assertEqual(self.client.get('/api/projects/').data['count'], 0)
        self.assertEqual(self.client.get(f"/api/projects/{mine['id']}/").status_code, 404)
        self.assertEqual(self.tag(mine['id']).status_code, 404)
        self.as_user(self.admin)
        self.assertEqual(self.client.get('/api/projects/').data['count'], 1)

    def test_filters(self):
        self.register(name='Solar')
        self.register(name='Water', submit=False)
        get = lambda query: self.client.get('/api/projects/?' + query).data['count']  # noqa: E731
        self.assertEqual(get('search=sol'), 1)
        self.assertEqual(get('stage=DRAFT'), 1)
        self.assertEqual(get('status=Active'), 1)
        self.assertEqual(get('status=Listed'), 0)


class SDGAndScoreTests(BaseCase):
    def setUp(self):
        self.as_user(self.sam)
        self.pk = self.register()['id']

    def test_tags_are_replaced_and_progress_reported(self):
        self.assertEqual(self.tag(self.pk, goals=(7, 13)).status_code, 200)
        response = self.tag(self.pk, goals=(9,))
        self.assertEqual([g['goal'] for g in response.data['goals']], [9])
        row = self.client.get('/api/sdg-dashboard/').data[0]
        self.assertEqual((row['sdgs'], row['indicator_count'], row['progress']), ([9], 1, 50))

    def test_tag_validation(self):
        bad = {'goals': [{'goal': 18}]}
        self.assertEqual(self.client.put(f'/api/projects/{self.pk}/sdgs/', bad, format='json').status_code, 400)
        twice = {'goals': [{'goal': 7}, {'goal': 7}]}
        self.assertEqual(self.client.put(f'/api/projects/{self.pk}/sdgs/', twice, format='json').status_code, 400)
        zero = {'goals': [{'goal': 7, 'indicators': [{'name': 'x', 'target_value': 0, 'current_value': 1}]}]}
        self.assertEqual(self.client.put(f'/api/projects/{self.pk}/sdgs/', zero, format='json').status_code, 400)

    def test_scores(self):
        self.assertEqual(self.score(self.pk, 101).status_code, 400)
        self.assertEqual(self.score(self.pk, 64).data['above_threshold'], False)
        saved = self.score(self.pk, 78).data
        self.assertEqual((saved['above_threshold'], saved['evaluated_by']), (True, 'Sam Rivera'))
        self.assertEqual(len(self.client.get(f'/api/projects/{self.pk}/scores/').data), 2)
        self.assertEqual(self.client.get(f'/api/projects/{self.pk}/').data['score'], 78)

    def test_latest_score_is_by_evaluation_date(self):
        project = Project.objects.get(pk=self.pk)
        ReadinessScore.objects.create(project=project, evaluation_date=date(2026, 9, 1), score=80, evaluated_by=self.sam)
        ReadinessScore.objects.create(project=project, evaluation_date=date(2026, 8, 1), score=40, evaluated_by=self.sam)
        self.assertEqual(self.client.get(f'/api/projects/{self.pk}/').data['score'], 80)


class WorkflowTests(BaseCase):
    def setUp(self):
        self.as_user(self.sam)

    def test_registered_to_under_review_needs_admin(self):
        pk = self.register()['id']
        response = self.ask(pk)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['requires_approval'])
        self.assertEqual(response.data['request']['code'], 'REQ-0001')
        self.assertEqual(self.stage_of(pk), Stage.REGISTERED)
        self.assertEqual(self.ask(pk).status_code, 400)  # one open request at a time
        self.assertEqual(self.decide(response.data['request']['id'], 'approve').data['resulting_stage'],
                         Stage.UNDER_REVIEW)
        self.assertEqual(self.stage_of(pk), Stage.UNDER_REVIEW)

    def test_checklist_blocks_until_tagged_and_scored(self):
        pk = self.advance_to_under_review()
        self.assertEqual(self.ask(pk).status_code, 400)
        self.tag(pk)
        self.score(pk, 69)
        blocked = self.ask(pk)
        self.assertEqual(blocked.status_code, 400)
        self.assertIn('Score ≥ 70 threshold (69)', blocked.data['checklist'][0])
        self.score(pk, 78)
        checklist = self.client.get(f'/api/projects/{pk}/').data['pipeline']['checklist']
        self.assertTrue(all(item['ok'] for item in checklist))
        self.assertEqual(len(checklist), 4)

    def test_full_path_to_investment_ready(self):
        pk = self.advance_to_under_review()
        self.tag(pk)
        self.score(pk, 78)
        request = self.ask(pk, to_stage=Stage.PENDING_APPROVAL, justification='Ready.').data['request']
        self.assertEqual(self.stage_of(pk), Stage.PENDING_APPROVAL)
        detail = self.client.get(f'/api/projects/{pk}/').data['pipeline']
        self.assertEqual(detail['open_request']['code'], request['code'])
        self.assertIsNone(detail['next_stage'])

        self.assertEqual(self.decide(request['id'], 'approve').data['resulting_stage'], Stage.APPROVED)
        self.assertEqual(self.decide(request['id'], 'approve').status_code, 400)  # already decided

        direct = self.ask(pk)  # Approved → Investment Ready needs no admin
        self.assertFalse(direct.data['requires_approval'])
        self.assertIsNone(direct.data['request'])
        self.assertEqual(self.stage_of(pk), Stage.INVESTMENT_READY)
        self.assertEqual(self.ask(pk).status_code, 400)  # listing is the admin's move

    def test_reject_needs_reason_then_project_can_resubmit(self):
        pk = self.advance_to_under_review()
        self.tag(pk)
        self.score(pk, 78)
        request = self.ask(pk).data['request']
        self.assertEqual(self.decide(request['id'], 'reject').status_code, 400)
        rejected = self.decide(request['id'], 'reject', 'Permit timeline missing').data
        self.assertEqual((rejected['status'], rejected['comments']), ('REJECTED', 'Permit timeline missing'))
        project = self.client.get(f'/api/projects/{pk}/').data
        self.assertEqual((project['stage'], project['status']), (Stage.REJECTED, 'On hold'))
        self.assertEqual(project['pipeline']['last_decision']['comments'], 'Permit timeline missing')
        again = self.ask(pk).data['request']
        self.assertEqual((again['from_stage'], again['to_stage']), (Stage.REJECTED, Stage.UNDER_REVIEW))

    def test_wrong_target_stage_is_refused(self):
        pk = self.register()['id']
        self.assertEqual(self.ask(pk, to_stage=Stage.APPROVED).status_code, 400)

    def test_only_admins_decide_and_users_see_own_requests(self):
        pk = self.register()['id']
        request = self.ask(pk).data['request']
        self.assertEqual(self.client.post(f"/api/stage-requests/{request['id']}/approve/").status_code, 403)
        self.as_user(self.jo)
        self.assertEqual(self.client.get('/api/stage-requests/').data['count'], 0)
        self.assertEqual(self.ask(pk).status_code, 404)
        self.as_user(self.admin)
        self.assertEqual(self.client.get('/api/stage-requests/?status=pending').data['count'], 1)
        self.assertEqual(self.client.get('/api/stage-requests/counts/').data,
                         {'pending': 1, 'approved': 0, 'rejected': 0})


class RegistryTests(BaseCase):
    def setUp(self):
        self.as_user(self.sam)
        self.pk = self.advance_to_under_review()
        self.tag(self.pk)
        self.score(self.pk, 91)
        self.decide(self.ask(self.pk).data['request']['id'], 'approve')
        self.ask(self.pk)
        self.as_user(self.admin)

    def add(self, **overrides):
        payload = {'project': self.pk, 'listed_date': '2026-09-05', 'investment_amount': '2500000', **overrides}
        return self.client.post('/api/registry/', payload)

    def test_registry_is_admin_only(self):
        self.as_user(self.sam)
        self.assertEqual(self.client.get('/api/registry/').status_code, 403)
        self.assertEqual(self.client.get('/api/dashboard/summary/').status_code, 403)

    def test_add_edit_delete(self):
        self.assertEqual([p['id'] for p in self.client.get('/api/registry/eligible/').data], [self.pk])
        entry = self.add().data
        self.assertEqual((entry['code'], entry['status']), ('REG-0001', 'LISTED'))
        self.assertEqual(self.stage_of(self.pk), Stage.LISTED)
        self.assertEqual(self.client.get('/api/registry/eligible/').data, [])
        self.assertEqual(self.add().status_code, 400)  # already listed

        self.as_user(self.jo)  # listed projects are visible to every signed-in user
        self.assertEqual(len(self.client.get('/api/browse/?min_score=70').data), 1)
        self.assertEqual(len(self.client.get('/api/browse/?min_score=95').data), 0)
        self.assertEqual(len(self.client.get('/api/browse/?sdg=3').data), 0)
        shown = self.client.get(f'/api/projects/{self.pk}/').data
        self.assertEqual(shown['registry']['code'], 'REG-0001')
        self.assertIsNone(shown['pipeline'])
        self.assertFalse(shown['can_manage'])

        self.as_user(self.admin)
        url = f"/api/registry/{entry['id']}/"
        self.assertEqual(self.client.patch(url, {'status': 'DELISTED'}).data['status'], 'DELISTED')
        self.assertEqual(self.stage_of(self.pk), Stage.INVESTMENT_READY)
        self.assertEqual(self.client.get('/api/browse/').data, [])
        self.client.patch(url, {'status': 'LISTED'})
        self.assertEqual(self.stage_of(self.pk), Stage.LISTED)

        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.stage_of(self.pk), Stage.INVESTMENT_READY)
        self.assertFalse(RegistryEntry.objects.exists())
        actions = [row['action'] for row in self.client.get('/api/dashboard/admin/').data['registry_activity']]
        self.assertEqual(actions, ['removed', 'listed', 'delisted', 'listed'])

    def test_validation(self):
        self.assertEqual(self.add(investment_amount='0').status_code, 400)
        self.assertEqual(self.add(project='').data['project'][0], 'Select a project.')
        other = Project.objects.create(name='Not ready', owner=self.sam, stage=Stage.REGISTERED)
        self.assertEqual(self.add(project=other.pk).data['project'][0],
                         'Only Investment Ready projects can be listed.')


class DashboardTests(BaseCase):
    def test_seed_and_dashboards(self):
        call_command('seed_demo', '--reset', verbosity=0)
        sam = User.objects.get(email='sam.rivera@example.com')
        self.as_user(sam)
        home = self.client.get('/api/dashboard/user/').data
        self.assertEqual(home['kpis']['my_projects'], 8)
        self.assertEqual(sum(row['count'] for row in home['pipeline']), 7)  # the rejected one is off-pipeline
        self.assertEqual(len(home['recent']), 3)
        self.assertEqual(len(self.client.get('/api/sdg-goals/').data), 17)

        self.as_user(User.objects.get(email='alex.morgan@example.com'))
        summary = self.client.get('/api/dashboard/summary/').data
        # 17 member projects plus the 13 seeded catalogue portfolios (all in the pipeline).
        self.assertEqual(summary['total_projects'], 30)
        self.assertEqual(summary['pending_approvals'], 3)
        self.assertEqual(summary['registry']['listed'], 3)
        self.assertEqual(summary['registry']['total_committed'], 10_450_000)
        self.assertEqual(sum(row['count'] for row in summary['score_distribution']), 13)
        export = self.client.get('/api/dashboard/summary/export/')
        self.assertEqual(export['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('PRJ-0042,Solar Micro-grid Expansion', export.content.decode())
        self.assertEqual(StageRequest.objects.filter(status='PENDING').count(), 3)
