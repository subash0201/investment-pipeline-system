"""The investment-network API: public portfolios, engagement, communities, members,
recommendations, service requests and the network dashboard.

Anything a visitor can see on the public site is AllowAny; acting (liking, commenting,
posting, joining, requesting a service) needs a signed-in account.
"""
import math
from collections import Counter, defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import BooleanField, Count, Exists, F, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .constants import (
    ACTOR_LABEL, ACTOR_TYPES, AFFINITY, COLLECTION_KEYS, COLLECTION_LABEL, COLLECTIONS, PILLARS,
    PORTFOLIO_SECTIONS, RESOURCES, SDG_GOALS, SERVICES, SHARE_CHANNELS, sdg_name,
)
from .models import (
    Community, CommunityMembership, CommunityPost, PortfolioComment, PortfolioLike, PortfolioShare,
    Project, ProjectSDG, ServiceRequest, Stage, User,
)
from .network_serializers import (
    CommentSerializer, CommunitySerializer, MemberSerializer, PortfolioCardSerializer,
    PortfolioDetailSerializer, PostSerializer, ProfileSerializer, RegisterSerializer,
    ServiceRequestSerializer, ServiceRequestUpdateSerializer,
)
from .pagination import StandardPagination
from .permissions import IsAdmin
from .serializers import UserSerializer

BILLION = Decimal(1_000_000_000)
SORTS = {
    'newest': ['-registration_date', '-id'],
    'oldest': ['registration_date', 'id'],
    'largest': ['-total_investment', '-id'],
    'liked': ['-like_count', '-id'],
    'discussed': ['-comment_count', '-id'],
    'name': ['name', 'id'],
}


def require_login(request):
    if not request.user.is_authenticated:
        raise NotAuthenticated('Log in to do that.')


def count_of(model):
    """Correlated COUNT subquery — much cheaper than COUNT joins with GROUP BY."""
    rows = model.objects.filter(project=OuterRef('pk')).order_by().values('project').annotate(n=Count('id')).values('n')
    return Coalesce(Subquery(rows[:1], output_field=IntegerField()), 0)


def with_counts(queryset):
    return queryset.annotate(like_count=count_of(PortfolioLike), comment_count=count_of(PortfolioComment),
                             share_count=count_of(PortfolioShare))


def public_portfolios(request=None):
    """Every portfolio past Draft is public. Counts and "liked by me" are annotated."""
    queryset = with_counts(Project.objects.exclude(stage=Stage.DRAFT)
                           .select_related('owner', 'registry_entry')
                           .prefetch_related('scores', 'sdgs__indicators'))
    user = getattr(request, 'user', None)
    if user is not None and user.is_authenticated:
        mine = PortfolioLike.objects.filter(project=OuterRef('pk'), user=user)
        return queryset.annotate(liked=Exists(mine))
    return queryset.annotate(liked=Value(False, output_field=BooleanField()))


def billions(amount):
    return float(round((amount or Decimal(0)) / BILLION, 1))


def engagement(card):
    return card['likes'] + card['comments'] + card['shares']


def most_engaged(request, limit=6):
    top = public_portfolios(request).annotate(
        engagement=F('like_count') + F('comment_count') + F('share_count')).order_by('-engagement', '-id')[:limit]
    return PortfolioCardSerializer(top, many=True, context={'request': request}).data


# ----------------------------------------------------------- reference --

class ReferenceView(APIView):
    """Everything the forms and filters need: actor types, collections, pillars, sections..."""
    permission_classes = [AllowAny]

    def get(self, request):
        pair = lambda rows: [{'key': key, 'label': label} for key, label in rows]  # noqa: E731
        return Response({
            'actor_types': pair(ACTOR_TYPES),
            'collections': pair(COLLECTIONS),
            'pillars': [{'key': k, 'label': label, 'description': d} for k, label, d in PILLARS],
            'services': pair(SERVICES),
            'sections': pair(PORTFOLIO_SECTIONS),
            'share_channels': pair(SHARE_CHANNELS),
            'sdg_goals': [{'number': g['number'], 'name': g['name']} for g in SDG_GOALS],
            'resources': [{'title': t, 'kind': k, 'url': u} for t, k, u in RESOURCES],
            'sorts': [{'key': 'newest', 'label': 'Newest'}, {'key': 'largest', 'label': 'Largest investment'},
                      {'key': 'liked', 'label': 'Most liked'}, {'key': 'discussed', 'label': 'Most discussed'},
                      {'key': 'name', 'label': 'A–Z'}, {'key': 'oldest', 'label': 'Oldest'}],
        })


# ---------------------------------------------------------------- join --

class RegisterView(APIView):
    """Public sign-up ("Join"). New accounts get the ordinary User role."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def post(self, request):
        from rest_framework.authtoken.models import Token
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------- portfolios --

class PortfolioViewSet(viewsets.ReadOnlyModelViewSet):
    """Public portfolio browsing, plus like / comment / share / compare."""
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        return PortfolioDetailSerializer if self.action == 'retrieve' else PortfolioCardSerializer

    def get_queryset(self):
        queryset = public_portfolios(self.request)
        if self.action != 'list':
            return queryset
        params = self.request.query_params
        if q := params.get('q', '').strip():
            queryset = queryset.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(code__icontains=q)
                                       | Q(reference__icontains=q) | Q(category__icontains=q))
        if (collection := params.get('collection')) in COLLECTION_KEYS:
            queryset = queryset.filter(collection=collection)
        if (sdg := params.get('sdg', '')).isdigit():
            tagged = ProjectSDG.objects.filter(goal=int(sdg)).values('project_id')
            queryset = queryset.filter(Q(primary_sdg=int(sdg)) | Q(id__in=tagged))
        if category := params.get('category', '').strip():
            queryset = queryset.filter(category__iexact=category)
        if (owner := params.get('owner')) == 'me' and self.request.user.is_authenticated:
            queryset = queryset.filter(owner=self.request.user)
        ordering = SORTS.get(params.get('sort'), SORTS['newest'])
        if ordering[0] == '-total_investment':
            return queryset.order_by(F('total_investment').desc(nulls_last=True), '-id')
        return queryset.order_by(*ordering)

    def get_object(self):
        """Owners and admins may also open their own drafts here."""
        pk = self.kwargs['pk']
        user = self.request.user
        found = public_portfolios(self.request).filter(pk=pk).first()
        if found is None and user.is_authenticated:
            draft = Project.objects.filter(pk=pk, stage=Stage.DRAFT).first()
            if draft and (user.is_admin or draft.owner_id == user.id):
                found = (with_counts(Project.objects.filter(pk=pk).select_related('owner')
                                     .prefetch_related('scores', 'sdgs__indicators'))
                         .annotate(liked=Value(False, output_field=BooleanField())).first())
        if found is None:
            from django.http import Http404
            raise Http404
        return found

    def _counts(self, project):
        return {
            'likes': project.likes.count(), 'comments': project.comments.count(),
            'shares': project.shares.count(),
        }

    @action(detail=True, methods=['post', 'delete'])
    def like(self, request, pk=None):
        require_login(request)
        project = self.get_object()
        if request.method == 'POST':
            try:
                with transaction.atomic():
                    PortfolioLike.objects.create(user=request.user, project=project)
            except IntegrityError:
                pass  # already liked
        else:
            PortfolioLike.objects.filter(user=request.user, project=project).delete()
        liked = PortfolioLike.objects.filter(user=request.user, project=project).exists()
        return Response({'liked': liked, **self._counts(project)})

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        project = self.get_object()
        if request.method == 'POST':
            require_login(request)
            serializer = CommentSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save(user=request.user, project=project)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        comments = project.comments.select_related('user')
        return Response(CommentSerializer(comments, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        project = self.get_object()
        channel = str(request.data.get('channel', 'copy'))
        if channel not in dict(SHARE_CHANNELS):
            raise ValidationError({'channel': 'Unknown share channel.'})
        user = request.user if request.user.is_authenticated else None
        PortfolioShare.objects.create(project=project, user=user, channel=channel)
        return Response(self._counts(project), status=status.HTTP_201_CREATED)

    @action(detail=False)
    def compare(self, request):
        """Side-by-side comparison of up to four portfolios: ?ids=3,8,12"""
        ids = [int(part) for part in request.query_params.get('ids', '').split(',') if part.strip().isdigit()][:4]
        found = {p.id: p for p in public_portfolios(request).filter(id__in=ids)}
        ordered = [found[i] for i in ids if i in found]
        return Response(PortfolioDetailSerializer(ordered, many=True, context={'request': request}).data)


class CommentDeleteView(APIView):
    def delete(self, request, pk):
        comment = get_object_or_404(PortfolioComment, pk=pk)
        if not (request.user.is_admin or comment.user_id == request.user.id):
            raise PermissionDenied('You can only delete your own comments.')
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------- communities --

def community_queryset(request):
    def tally(model):
        rows = model.objects.filter(community=OuterRef('pk')).order_by().values('community').annotate(
            n=Count('id')).values('n')
        return Coalesce(Subquery(rows[:1], output_field=IntegerField()), 0)

    queryset = Community.objects.annotate(member_count=tally(CommunityMembership), post_count=tally(CommunityPost))
    if request.user.is_authenticated:
        mine = CommunityMembership.objects.filter(community=OuterRef('pk'), user=request.user)
        return queryset.annotate(is_member=Exists(mine))
    return queryset.annotate(is_member=Value(False, output_field=BooleanField()))


class CommunityViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = CommunitySerializer
    lookup_field = 'slug'
    pagination_class = None

    def get_queryset(self):
        queryset = community_queryset(self.request)
        if pillar := self.request.query_params.get('pillar'):
            queryset = queryset.filter(pillar=pillar)
        return queryset

    def _fresh(self, slug):
        return CommunitySerializer(community_queryset(self.request).get(slug=slug),
                                   context={'request': self.request}).data

    @action(detail=True, methods=['post'])
    def join(self, request, slug=None):
        require_login(request)
        community = self.get_object()
        CommunityMembership.objects.get_or_create(community=community, user=request.user)
        return Response(self._fresh(slug))

    @action(detail=True, methods=['post'])
    def leave(self, request, slug=None):
        require_login(request)
        community = self.get_object()
        CommunityMembership.objects.filter(community=community, user=request.user).delete()
        return Response(self._fresh(slug))

    @action(detail=True, methods=['get', 'post'])
    def posts(self, request, slug=None):
        community = self.get_object()
        if request.method == 'POST':
            require_login(request)
            if not community.memberships.filter(user=request.user).exists():
                raise PermissionDenied('Join the community to post.')
            serializer = PostSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save(author=request.user, community=community)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        posts = community.posts.select_related('author', 'project')[:100]
        return Response(PostSerializer(posts, many=True, context={'request': request}).data)

    @action(detail=True)
    def members(self, request, slug=None):
        require_login(request)
        community = self.get_object()
        people = User.objects.filter(memberships__community=community, is_active=True).order_by('first_name')
        return Response(MemberSerializer(people, many=True).data)


class PostDeleteView(APIView):
    def delete(self, request, pk):
        post = get_object_or_404(CommunityPost, pk=pk)
        if not (request.user.is_admin or post.author_id == request.user.id):
            raise PermissionDenied('You can only delete your own posts.')
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------- members --

class MembersView(ListAPIView):
    """Members & actors directory (signed-in users only; no email addresses)."""
    serializer_class = MemberSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = User.objects.filter(is_active=True).annotate(
            portfolio_count=Count('projects', filter=~Q(projects__stage=Stage.DRAFT), distinct=True),
            community_count=Count('memberships', distinct=True),
        ).order_by('first_name', 'last_name', 'id')
        params = self.request.query_params
        if actor := params.get('actor_type'):
            queryset = queryset.filter(actor_type=actor)
        if search := params.get('search', '').strip():
            queryset = queryset.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search)
                                       | Q(organization__icontains=search) | Q(headline__icontains=search)
                                       | Q(location__icontains=search))
        return queryset


# ----------------------------------------------------- recommendations --

def blended_affinity():
    """Built-in actor × collection affinity blended (70/30) with what members of each
    actor type actually like and comment on."""
    observed = defaultdict(Counter)
    for actor, collection in PortfolioLike.objects.exclude(user__actor_type='').values_list(
            'user__actor_type', 'project__collection'):
        observed[actor][collection] += 1
    for actor, collection in PortfolioComment.objects.exclude(user__actor_type='').values_list(
            'user__actor_type', 'project__collection'):
        observed[actor][collection] += 1
    matrix = {}
    for actor, base in AFFINITY.items():
        seen = observed.get(actor)
        total = sum(seen.values()) if seen else 0
        if not total:
            matrix[actor] = list(base)
            continue
        peak = max(seen.values())
        matrix[actor] = [round(0.7 * b + 0.3 * (seen.get(key, 0) / peak), 2)
                         for b, key in zip(base, COLLECTION_KEYS)]
    return matrix


class RecommendationsView(APIView):
    """"Recommended for you": actor-type affinity + SDG interests + followed collections + popularity."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        matrix = blended_affinity()
        row_affinity = matrix.get(user.actor_type)
        interests = set(user.sdg_interests or [])
        follows = set(user.followed_collections or [])
        candidates = with_counts(Project.objects.exclude(stage=Stage.DRAFT).exclude(owner=user))
        rows = list(candidates.values('id', 'collection', 'primary_sdg', 'like_count', 'comment_count', 'share_count'))
        tags = defaultdict(set)
        for project_id, goal in ProjectSDG.objects.filter(project_id__in=[r['id'] for r in rows]).values_list(
                'project_id', 'goal'):
            tags[project_id].add(goal)
        scored = []
        for row in rows:
            collection = row['collection']
            label = COLLECTION_LABEL.get(collection, collection)
            index = COLLECTION_KEYS.index(collection) if collection in COLLECTION_KEYS else 5
            affinity = row_affinity[index] if row_affinity else 0.5
            goals = tags[row['id']] | ({row['primary_sdg']} if row['primary_sdg'] else set())
            sdg_fit = 1.0 if row['primary_sdg'] in interests else 0.6 if goals & interests else 0.0
            follow = 1.0 if collection in follows else 0.0
            popularity = min(1.0, math.log1p(row['like_count'] + row['comment_count'] + row['share_count']) / math.log(21))
            score = 0.45 * affinity + 0.35 * sdg_fit + 0.10 * follow + 0.10 * popularity
            reasons = []
            if row_affinity and affinity >= 0.6:
                reasons.append(f'{label} suits {ACTOR_LABEL[user.actor_type]}s')
            if sdg_fit:
                shared = sorted(goals & interests)
                reasons.append('Matches your SDG interest: ' + ', '.join(f'SDG {g}' for g in shared[:3]))
            if follow:
                reasons.append(f'You follow {label}')
            if popularity >= 0.5:
                reasons.append('Popular with members')
            scored.append((round(100 * score), row['id'], reasons))
        scored.sort(key=lambda item: (-item[0], -item[1]))
        limit = max(1, min(int(request.query_params.get('limit', 12) or 12), 50))
        top = scored[:limit]
        found = {p.id: p for p in public_portfolios(request).filter(id__in=[pid for _, pid, _ in top])}
        cards = {c['id']: c for c in PortfolioCardSerializer(list(found.values()), many=True,
                                                             context={'request': request}).data}
        results = [{**cards[pid], 'match': match, 'reasons': reasons} for match, pid, reasons in top if pid in cards]
        return Response({
            'profile_complete': bool(user.actor_type and (interests or follows)),
            'results': results,
        })


# ---------------------------------------------------- service requests --

class ServiceRequestViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                            mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Members request investment services; administrators work the queue."""
    pagination_class = StandardPagination
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_serializer_class(self):
        return ServiceRequestUpdateSerializer if self.action == 'partial_update' else ServiceRequestSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = ServiceRequest.objects.select_related('requester', 'project', 'community')
        if not user.is_admin:
            queryset = queryset.filter(requester=user)
        if self.action == 'list':
            if wanted := self.request.query_params.get('status'):
                queryset = queryset.filter(status=wanted.upper())
            if service := self.request.query_params.get('service'):
                queryset = queryset.filter(service=service)
        return queryset

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        if not request.user.is_admin:
            raise PermissionDenied(IsAdmin.message)
        instance = self.get_object()
        serializer = ServiceRequestUpdateSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ServiceRequestSerializer(instance, context={'request': request}).data)

    @action(detail=False)
    def counts(self, request):
        tally = Counter(self.get_queryset().values_list('status', flat=True))
        return Response({key.lower(): tally.get(key, 0) for key in ServiceRequest.Status.values})


# ------------------------------------------------------ overview, feed --

class NetworkOverviewView(APIView):
    """The public landing page: headline figures, collections, pillars, most engaged."""
    permission_classes = [AllowAny]

    def get(self, request):
        portfolios = Project.objects.exclude(stage=Stage.DRAFT)
        by_collection = Counter(portfolios.values_list('collection', flat=True))
        sdg_money = portfolios.filter(primary_sdg__isnull=False, total_investment__isnull=False)
        return Response({
            'portfolios': portfolios.count(),
            'sdg_investment_billion': billions(sdg_money.aggregate(total=Sum('total_investment'))['total']),
            'sdg_count': sdg_money.values('primary_sdg').distinct().count(),
            'members': User.objects.filter(is_active=True).count(),
            'communities': Community.objects.count(),
            'collections': [{'key': key, 'label': label, 'count': by_collection.get(key, 0)}
                            for key, label in COLLECTIONS],
            'pillars': [{'key': k, 'label': label, 'description': d} for k, label, d in PILLARS],
            'most_engaged': most_engaged(request, 6),
        })


class FeedView(APIView):
    """Recent activity across the network. ?scope=following narrows it to what you follow."""
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user
        following = request.query_params.get('scope') == 'following' and user.is_authenticated
        portfolios = public_portfolios(request)
        comments = PortfolioComment.objects.select_related('user', 'project').exclude(project__stage=Stage.DRAFT)
        posts = CommunityPost.objects.select_related('author', 'community')
        if following:
            wanted = Q(collection__in=user.followed_collections or [])
            if user.sdg_interests:
                tagged = ProjectSDG.objects.filter(goal__in=user.sdg_interests).values('project_id')
                wanted |= Q(primary_sdg__in=user.sdg_interests) | Q(id__in=tagged)
            matching = Project.objects.exclude(stage=Stage.DRAFT).filter(wanted).values('id')
            portfolios = portfolios.filter(id__in=matching)
            comments = comments.filter(project_id__in=matching)
            posts = posts.filter(community__memberships__user=user)

        items = []
        recent = list(portfolios.order_by('-created_at', '-id')[:20])
        cards = PortfolioCardSerializer(recent, many=True, context={'request': request}).data
        for project, card in zip(recent, cards):
            items.append({'type': 'portfolio', 'at': project.created_at, 'portfolio': card})
        for comment in comments[:20]:
            items.append({'type': 'comment', 'at': comment.created_at, 'user_name': comment.user.full_name,
                          'user_actor': ACTOR_LABEL.get(comment.user.actor_type, ''), 'body': comment.body[:280],
                          'portfolio': {'id': comment.project_id, 'name': comment.project.name}})
        for post in posts[:20]:
            items.append({'type': 'post', 'at': post.created_at, 'user_name': post.author.full_name,
                          'user_actor': ACTOR_LABEL.get(post.author.actor_type, ''), 'body': post.body[:280],
                          'community': {'slug': post.community.slug, 'name': post.community.name}})

        items.sort(key=lambda item: item['at'], reverse=True)
        return Response(items[:30])


# ------------------------------------------------------------ dashboard --

class NetworkDashboardView(APIView):
    """Investment portfolio dashboard (public)."""
    permission_classes = [AllowAny]

    def get(self, request):
        portfolios = Project.objects.exclude(stage=Stage.DRAFT)
        by_collection = Counter(portfolios.values_list('collection', flat=True))

        costed = portfolios.filter(primary_sdg__isnull=False, total_investment__isnull=False)
        sums = costed.aggregate(total=Sum('total_investment'), digital=Sum('digital_investment'),
                                ai=Sum('ai_investment'))
        total = sums['total'] or Decimal(0)
        share = lambda part: round(100 * float((part or 0) / total)) if total else 0  # noqa: E731
        by_goal = costed.values('primary_sdg').annotate(amount=Sum('total_investment')).order_by('primary_sdg')

        def by_category(collection, money=False):
            rows = portfolios.filter(collection=collection).values('category').annotate(
                count=Count('id'), amount=Sum('total_investment')).order_by('-count', 'category')
            return [{'label': r['category'] or 'Uncategorised', 'count': r['count'],
                     **({'amount_billion': billions(r['amount'])} if money else {})} for r in rows]

        nap_total = portfolios.filter(collection='nap').aggregate(total=Sum('total_investment'))['total']
        members = User.objects.filter(is_active=True)
        actors = Counter(members.values_list('actor_type', flat=True))

        since = timezone.now() - timedelta(days=29)
        days = [(since + timedelta(days=i)).date() for i in range(30)]
        daily = {kind: Counter() for kind in ('likes', 'comments', 'shares', 'posts')}
        for kind, model in (('likes', PortfolioLike), ('comments', PortfolioComment),
                            ('shares', PortfolioShare), ('posts', CommunityPost)):
            for moment in model.objects.filter(created_at__gte=since).values_list('created_at', flat=True):
                daily[kind][timezone.localtime(moment).date()] += 1

        matrix = blended_affinity()
        return Response({
            'generated_at': timezone.now(),
            'portfolios': {'total': portfolios.count(),
                           'by_collection': [{'key': k, 'label': label, 'count': by_collection.get(k, 0)}
                                             for k, label in COLLECTIONS]},
            'sdg_investment': {
                'total_billion': billions(total), 'goal_count': len(by_goal),
                'digital_billion': billions(sums['digital']), 'ai_billion': billions(sums['ai']),
                'digital_pct': share(sums['digital']), 'ai_pct': share(sums['ai']),
                'by_goal': [{'goal': r['primary_sdg'], 'name': sdg_name(r['primary_sdg']),
                             'amount_billion': billions(r['amount'])} for r in by_goal],
            },
            'nap': {'count': by_collection.get('nap', 0), 'total_billion': billions(nap_total),
                    'sectors': by_category('nap', money=True)},
            'sovereign_layers': by_category('sovereign'),
            'draft_categories': by_category('draft'),
            'members': {'total': members.count(),
                        'by_actor': [{'key': k, 'label': label, 'count': actors.get(k, 0)} for k, label in ACTOR_TYPES]
                        + ([{'key': '', 'label': 'Not set', 'count': actors['']}] if actors.get('') else [])},
            'engagement': {
                'posts': CommunityPost.objects.count(), 'likes': PortfolioLike.objects.count(),
                'comments': PortfolioComment.objects.count(), 'shares': PortfolioShare.objects.count(),
                'service_requests': ServiceRequest.objects.count(),
                'last_30_days': [{'date': d, **{k: daily[k].get(d, 0) for k in daily}} for d in days],
            },
            'most_engaged': most_engaged(request, 8),
            'affinity': {
                'collections': [{'key': k, 'label': label} for k, label in COLLECTIONS],
                'rows': [{'actor': k, 'label': label, 'values': matrix[k]} for k, label in ACTOR_TYPES],
            },
        })
