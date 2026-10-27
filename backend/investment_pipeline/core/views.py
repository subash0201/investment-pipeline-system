import csv
from collections import Counter
from datetime import timedelta

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import workflow
from .constants import SDG_GOALS, sdg_name
from .models import (
    PIPELINE, Project, ProjectSDG, RegistryActivity, RegistryEntry, SDGIndicator, Stage,
    StageRequest,
)
from .permissions import IsAdmin
from .network_serializers import ProfileSerializer
from .serializers import (
    PROFILE_FIELDS, ProjectDetailSerializer, ProjectSerializer, RegistryEntrySerializer, ScoreSerializer,
    SDGTagsSerializer, StageRequestSerializer, UserSerializer,
)

STATUS_TO_STAGES = {
    'Draft': [Stage.DRAFT],
    'Listed': [Stage.LISTED],
    'On hold': [Stage.REJECTED],
    'Active': [Stage.REGISTERED, Stage.UNDER_REVIEW, Stage.PENDING_APPROVAL,
               Stage.APPROVED, Stage.INVESTMENT_READY],
}


def project_queryset():
    return Project.objects.select_related('owner').prefetch_related('scores', 'sdgs__indicators')


def visible_projects(user):
    """Admins see every project, users their own."""
    queryset = project_queryset()
    return queryset if user.is_admin else queryset.filter(owner=user)


def month_start():
    return timezone.localdate().replace(day=1)


class HealthView(APIView):
    """Liveness check for the load balancer / uptime monitor: GET /api/health/"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return Response({'status': 'ok'})


# ---- auth ----#

class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        password = str(request.data.get('password', ''))
        user = authenticate(request, username=email, password=password) if email and password else None
        if user is None:
            return Response({'detail': 'Invalid email or password. Please try again.'},
                            status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data})


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        """Edit your own network profile (name, actor type, organization, interests...)."""
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class SDGGoalsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(SDG_GOALS)


# -- projects --#

class ProjectViewSet(viewsets.ModelViewSet):
    """Registration (211–214), My Projects (210) and everything hung off a project."""

    def get_serializer_class(self):
        return ProjectSerializer if self.action == 'list' else ProjectDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if self.action == 'retrieve' and not user.is_admin:
            # Anyone signed in may read a project that is listed for investors.
            return project_queryset().filter(
                Q(owner=user) | Q(registry_entry__status=RegistryEntry.Status.LISTED))
        queryset = visible_projects(user)
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if search := params.get('search', '').strip():
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        if stage := params.get('stage'):
            queryset = queryset.filter(stage=stage)
        if status_label := params.get('status'):
            queryset = queryset.filter(stage__in=STATUS_TO_STAGES.get(status_label, []))
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        submit = serializer.validated_data.pop('submit', False)
        project = serializer.save(owner=self.request.user)
        project.move_to(Stage.DRAFT, on=project.registration_date)
        if submit:
            project.move_to(Stage.REGISTERED, on=project.registration_date)

    def _require_draft(self, project):
        if project.stage != Stage.DRAFT:
            raise ValidationError({'detail': 'Only draft projects can be changed.'})

    @transaction.atomic
    def perform_update(self, serializer):
        # The portfolio profile (costing, sections, category...) stays editable after
        # registration; the name, description and submission are draft-only.
        changed = set(serializer.validated_data) - {'submit'} - set(PROFILE_FIELDS)
        if changed or serializer.validated_data.get('submit'):
            self._require_draft(serializer.instance)
        submit = serializer.validated_data.pop('submit', False)
        project = serializer.save(updated_at=timezone.now())
        if submit:
            project.move_to(Stage.REGISTERED)

    def perform_destroy(self, instance):
        self._require_draft(instance)
        instance.delete()

    @action(detail=True, methods=['get', 'put'])
    def sdgs(self, request, pk=None):
        """Screen 220: read or replace the project's SDG tags and indicators."""
        project = self.get_object()
        if request.method == 'PUT':
            serializer = SDGTagsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                project.sdgs.all().delete()
                for item in serializer.validated_data['goals']:
                    tag = ProjectSDG.objects.create(project=project, goal=item['goal'])
                    SDGIndicator.objects.bulk_create(
                        SDGIndicator(project_sdg=tag, **indicator)
                        for indicator in item.get('indicators', []))
                project.sdg_updated_at = project.updated_at = timezone.now()
                project.save(update_fields=['sdg_updated_at', 'updated_at'])
        tags = project.sdgs.prefetch_related('indicators')
        return Response({'goals': [{
            'goal': tag.goal, 'name': sdg_name(tag.goal),
            'indicators': [{
                'id': i.id, 'name': i.name, 'target_value': i.target_value,
                'current_value': i.current_value, 'notes': i.notes,
            } for i in tag.indicators.all()],
        } for tag in tags]})

    @action(detail=True, methods=['get', 'post'])
    def scores(self, request, pk=None):
        """Screens 230/231: score history, and recording a new evaluation."""
        project = self.get_object()
        if request.method == 'POST':
            if project.stage == Stage.DRAFT:
                raise ValidationError({'detail': 'Register the project before scoring it.'})
            serializer = ScoreSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(project=project, evaluated_by=request.user)
            project.touch()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(ScoreSerializer(project.scores.select_related('evaluated_by'), many=True).data)


class SDGDashboardView(APIView):
    """Screen 221: tagged goals and indicator progress per project."""

    def get(self, request):
        rows = []
        for project in visible_projects(request.user):
            tags = list(project.sdgs.all())
            indicators = [i for tag in tags for i in tag.indicators.all()]
            progress = round(100 * sum(i.progress for i in indicators) / len(indicators)) if indicators else 0
            rows.append({
                'id': project.id, 'code': project.code, 'name': project.name,
                'sdgs': [tag.goal for tag in tags], 'indicator_count': len(indicators),
                'progress': progress, 'updated_at': project.sdg_updated_at,
            })
        rows.sort(key=lambda r: (r['updated_at'] is None, -(r['updated_at'].timestamp() if r['updated_at'] else 0)))
        return Response(rows)


# -- stage requests --#

class StageRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Screens 241/242 (create) and 330–333 (admin queue and decisions)."""
    serializer_class = StageRequestSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = StageRequest.objects.select_related(
            'project', 'requested_by', 'decided_by').prefetch_related('project__scores', 'project__sdgs')
        if not user.is_admin:
            queryset = queryset.filter(project__owner=user)
        if self.action == 'list' and (wanted := self.request.query_params.get('status')):
            queryset = queryset.filter(status=wanted.upper())
        return queryset

    def create(self, request):
        project = get_object_or_404(visible_projects(request.user), pk=request.data.get('project'))
        stage_request, needs_approval = workflow.request_transition(
            project, request.user,
            to_stage=request.data.get('to_stage') or None,
            justification=str(request.data.get('justification', '')).strip(),
        )
        return Response({
            'requires_approval': needs_approval,
            'request': StageRequestSerializer(stage_request).data if stage_request else None,
            'stage': project.stage,
            'stage_display': project.get_stage_display(),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False)
    def counts(self, request):
        tally = Counter(self.get_queryset().values_list('status', flat=True))
        return Response({key.lower(): tally.get(key, 0) for key in StageRequest.Status.values})

    def _decide(self, request, decide):
        if not request.user.is_admin:
            raise PermissionDenied(IsAdmin.message)
        stage_request = decide(self.get_object(), request.user, str(request.data.get('comments', '')))
        return Response(StageRequestSerializer(stage_request).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._decide(request, workflow.approve)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._decide(request, workflow.reject)


# -- registry --#

class RegistryViewSet(viewsets.ModelViewSet):
    """Screens 320–323: the investment registry, administrators only."""
    serializer_class = RegistryEntrySerializer
    permission_classes = [IsAdmin]
    ORDERINGS = {'listed_date', '-listed_date', 'investment_amount', '-investment_amount'}

    def get_queryset(self):
        queryset = RegistryEntry.objects.select_related('project__owner').prefetch_related(
            'project__scores', 'project__sdgs')
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if search := params.get('search', '').strip():
            queryset = queryset.filter(Q(code__icontains=search) | Q(project__name__icontains=search))
        if wanted := params.get('status'):
            queryset = queryset.filter(status=wanted.upper())
        ordering = params.get('ordering')
        return queryset.order_by(ordering if ordering in self.ORDERINGS else '-listed_date', '-id')

    @transaction.atomic
    def perform_create(self, serializer):
        entry = serializer.save()
        workflow.sync_project_with_entry(entry)
        workflow.log_registry(entry, entry.get_status_display().lower())

    @transaction.atomic
    def perform_update(self, serializer):
        before = serializer.instance
        old_status, old_amount = before.status, before.investment_amount
        entry = serializer.save()
        workflow.sync_project_with_entry(entry)
        if entry.status != old_status:
            workflow.log_registry(entry, entry.get_status_display().lower())
        elif entry.investment_amount != old_amount:
            workflow.log_registry(entry, 'edited', 'Investment amount updated')
        else:
            workflow.log_registry(entry, 'edited', 'Listing details updated')

    @transaction.atomic
    def perform_destroy(self, instance):
        workflow.log_registry(instance, 'removed')
        workflow.release_project(instance)
        instance.delete()

    @action(detail=False)
    def eligible(self, request):
        """Projects that can be listed: Investment Ready and not yet in the registry."""
        queryset = project_queryset().filter(stage=Stage.INVESTMENT_READY, registry_entry__isnull=True)
        return Response(ProjectSerializer(queryset, many=True).data)


class BrowseView(ListAPIView):
    """Screen 250: projects currently listed for investors."""
    serializer_class = ProjectSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = project_queryset().filter(registry_entry__status=RegistryEntry.Status.LISTED)
        params = self.request.query_params
        if search := params.get('search', '').strip():
            queryset = queryset.filter(name__icontains=search)
        if (sdg := params.get('sdg', '')).isdigit():
            queryset = queryset.filter(sdgs__goal=int(sdg))
        return queryset.distinct()

    def list(self, request, *args, **kwargs):
        params = request.query_params
        minimum = int(params['min_score']) if params.get('min_score', '').isdigit() else 0
        rows = [row for row in self.get_serializer(self.get_queryset(), many=True).data
                if (row['score'] or 0) >= minimum]
        ordering = params.get('ordering', '-score')
        if ordering == 'name':
            rows.sort(key=lambda r: r['name'].lower())
        else:
            rows.sort(key=lambda r: r['score'] or 0, reverse=ordering != 'score')
        return Response(rows)


# -- dashboards --#

def stage_breakdown(projects):
    tally = Counter(p.stage for p in projects)
    return [{'stage': stage, 'label': Stage(stage).label, 'count': tally.get(stage, 0)} for stage in PIPELINE]


def average(values):
    values = list(values)
    return round(sum(values) / len(values), 1) if values else None


class UserDashboardView(APIView):
    """Screen 200."""

    def get(self, request):
        projects = list(project_queryset().filter(owner=request.user))
        tally = Counter(p.stage for p in projects)
        recent = sorted(projects, key=lambda p: p.updated_at, reverse=True)[:3]
        return Response({
            'kpis': {
                'my_projects': len(projects),
                'new_this_month': sum(p.registration_date >= month_start() for p in projects),
                'under_review': tally.get(Stage.UNDER_REVIEW, 0),
                'pending_approval': tally.get(Stage.PENDING_APPROVAL, 0),
                'investment_ready': tally.get(Stage.INVESTMENT_READY, 0),
            },
            'pipeline': stage_breakdown(projects),
            'recent': ProjectSerializer(recent, many=True).data,
        })


def summary_data():
    projects = list(project_queryset())
    first = month_start()
    latest_now, latest_before = [], []
    for project in projects:
        scores = sorted(project.scores.all(), key=lambda s: (s.evaluation_date, s.id))
        if scores:
            latest_now.append(scores[-1].score)
        earlier = [s for s in scores if s.evaluation_date < first]
        if earlier:
            latest_before.append(earlier[-1].score)
    avg_now, avg_before = average(latest_now), average(latest_before)

    buckets = [0] * 5
    for score in latest_now:
        buckets[min(score // 20, 4)] += 1
    labels = ['0–20', '20–40', '40–60', '60–80', '80–100']

    goals = Counter(tag.goal for project in projects for tag in project.sdgs.all())
    entries = Counter(RegistryEntry.objects.values_list('status', flat=True))
    committed = RegistryEntry.objects.exclude(status=RegistryEntry.Status.DELISTED).aggregate(
        total=Sum('investment_amount'))['total'] or 0
    pending = StageRequest.objects.filter(status=StageRequest.Status.PENDING)
    ready = sum(p.stage == Stage.INVESTMENT_READY for p in projects)

    return {
        'generated_at': timezone.now(),
        'threshold': workflow.threshold(),
        'total_projects': len(projects),
        'new_this_month': sum(p.registration_date >= first for p in projects),
        'under_review': sum(p.stage == Stage.UNDER_REVIEW for p in projects),
        'rejected': sum(p.stage == Stage.REJECTED for p in projects),
        'investment_ready': ready,
        'investment_ready_pct': round(100 * ready / len(projects)) if projects else 0,
        'avg_score': avg_now,
        'avg_score_delta': (round(avg_now - avg_before, 1)
                            if avg_now is not None and avg_before is not None else None),
        'pending_approvals': pending.count(),
        'pending_older_than_3_days': pending.filter(
            created_at__lt=timezone.now() - timedelta(days=3)).count(),
        'by_stage': stage_breakdown(projects),
        'top_sdgs': [{'goal': goal, 'name': sdg_name(goal), 'count': count}
                     for goal, count in sorted(goals.items(), key=lambda kv: (-kv[1], kv[0]))[:6]],
        'score_distribution': [{'range': label, 'count': count} for label, count in zip(labels, buckets)],
        'registry': {
            'listed': entries.get(RegistryEntry.Status.LISTED, 0),
            'delisted': entries.get(RegistryEntry.Status.DELISTED, 0),
            'funded': entries.get(RegistryEntry.Status.FUNDED, 0),
            'listed_this_month': RegistryEntry.objects.filter(listed_date__gte=first).count(),
            'total_committed': committed,
        },
    }


class AdminDashboardView(APIView):
    """Screen 300."""
    permission_classes = [IsAdmin]

    def get(self, request):
        pending = StageRequest.objects.filter(status=StageRequest.Status.PENDING).select_related(
            'project', 'requested_by').prefetch_related('project__scores', 'project__sdgs')[:4]
        return Response({
            'summary': summary_data(),
            'pending_requests': StageRequestSerializer(pending, many=True).data,
            'registry_activity': list(RegistryActivity.objects.values(
                'id', 'entry_code', 'action', 'detail', 'created_at')[:4]),
        })


class SummaryView(APIView):
    """Screen 310."""
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(summary_data())


class SummaryExportView(APIView):
    """The Export button on 310: the dashboard figures plus every project, as CSV."""
    permission_classes = [IsAdmin]

    def get(self, request):
        data = summary_data()
        stamp = timezone.localtime(data['generated_at'])
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="pipeline-summary-{stamp:%Y%m%d-%H%M}.csv"'
        out = csv.writer(response)
        out.writerow(['Investment Pipeline Tracker — Summary Dashboard'])
        out.writerow(['Generated', f'{stamp:%d %b %Y, %I:%M %p}'])
        out.writerow([])
        out.writerow(['Total projects', data['total_projects']])
        out.writerow(['Investment ready', data['investment_ready']])
        out.writerow(['Avg. readiness score', data['avg_score'] if data['avg_score'] is not None else ''])
        out.writerow(['Pending approvals', data['pending_approvals']])
        out.writerow([])
        out.writerow(['Projects by pipeline stage'])
        for row in data['by_stage']:
            out.writerow([row['label'], row['count']])
        out.writerow(['Rejected', data['rejected']])
        out.writerow([])
        out.writerow(['Top SDGs tagged'])
        for row in data['top_sdgs']:
            out.writerow([f"SDG {row['goal']} · {row['name']}", row['count']])
        out.writerow([])
        out.writerow(['Readiness score distribution'])
        for row in data['score_distribution']:
            out.writerow([row['range'], row['count']])
        out.writerow([])
        out.writerow(['Registry summary'])
        out.writerow(['Currently listed', data['registry']['listed']])
        out.writerow(['Delisted', data['registry']['delisted']])
        out.writerow(['Funded', data['registry']['funded']])
        out.writerow(['Total committed (NRs)', data['registry']['total_committed']])
        out.writerow([])
        out.writerow(['Project ID', 'Name', 'Owner', 'Stage', 'Status', 'Registered', 'Readiness score', 'SDGs'])
        for project in project_queryset():
            latest = project.latest_score
            out.writerow([
                project.code, project.name, project.owner.full_name, project.get_stage_display(),
                project.status, project.registration_date, latest.score if latest else '',
                ' '.join(str(tag.goal) for tag in project.sdgs.all()),
            ])
        return response
