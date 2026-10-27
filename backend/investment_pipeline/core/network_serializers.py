"""Serializers for the investment-network side: profiles, portfolios, engagement,
communities, members and service requests."""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .constants import (
    ACTOR_LABEL, COLLECTION_KEYS, COLLECTION_LABEL, PILLAR_LABEL, PORTFOLIO_SECTIONS, SECTION_KEYS,
    sdg_name,
)
from .models import (
    Community, CommunityPost, PortfolioComment, Project, ServiceRequest, Stage, User,
)

MAX_SECTION_LENGTH = 20000


def clean_goals(value, field='sdg_interests'):
    if not isinstance(value, list) or any(not isinstance(n, int) or not 1 <= n <= 17 for n in value):
        raise serializers.ValidationError('Choose SDG numbers between 1 and 17.')
    return sorted(set(value))


def clean_collections(value):
    if not isinstance(value, list) or any(key not in COLLECTION_KEYS for key in value):
        raise serializers.ValidationError('Unknown portfolio collection.')
    return [key for key in COLLECTION_KEYS if key in value]


def clean_details(value):
    """Portfolio sections: a dict of known section keys to text."""
    if not isinstance(value, dict):
        raise serializers.ValidationError('Sections must be an object of section name to text.')
    unknown = sorted(set(value) - set(SECTION_KEYS))
    if unknown:
        raise serializers.ValidationError(f'Unknown section: {", ".join(unknown)}.')
    cleaned = {}
    for key, text in value.items():
        if text is None:
            continue
        if not isinstance(text, str):
            raise serializers.ValidationError(f'Section "{key}" must be text.')
        if len(text) > MAX_SECTION_LENGTH:
            raise serializers.ValidationError(f'Section "{key}" is too long.')
        if text.strip():
            cleaned[key] = text.strip()
    return cleaned


def short_name(user):
    return user.full_name if user else 'Former member'


# ------------------------------------------------------------- profile --

class ProfileSerializer(serializers.ModelSerializer):
    """The signed-in user's own account and network profile."""
    name = serializers.CharField(source='full_name', read_only=True)
    actor_type_display = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'first_name', 'last_name', 'role', 'actor_type', 'actor_type_display',
            'organization', 'headline', 'location', 'sdg_interests', 'followed_collections',
        ]
        read_only_fields = ['id', 'email', 'role']

    def get_actor_type_display(self, obj):
        return ACTOR_LABEL.get(obj.actor_type, '')

    def validate_sdg_interests(self, value):
        return clean_goals(value)

    def validate_followed_collections(self, value):
        return clean_collections(value)


class RegisterSerializer(serializers.Serializer):
    """Public "Join" form."""
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    actor_type = serializers.ChoiceField(choices=list(ACTOR_LABEL.items()), error_messages={
        'invalid_choice': 'Choose what kind of member you are.', 'required': 'Choose what kind of member you are.'})
    organization = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    headline = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    location = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')
    sdg_interests = serializers.JSONField(required=False, default=list)
    followed_collections = serializers.JSONField(required=False, default=list)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists. Log in instead.')
        return value

    def validate_sdg_interests(self, value):
        return clean_goals(value)

    def validate_followed_collections(self, value):
        return clean_collections(value)

    def validate(self, attrs):
        probe = User(email=attrs['email'], first_name=attrs['first_name'], last_name=attrs.get('last_name', ''))
        try:
            validate_password(attrs['password'], probe)
        except Exception as error:  # django ValidationError -> DRF field error
            raise serializers.ValidationError({'password': list(getattr(error, 'messages', [str(error)]))})
        return attrs

    def create(self, data):
        password = data.pop('password')
        return User.objects.create_user(password=password, role=User.Role.USER, **data)


# ---------------------------------------------------------- portfolios --

class PortfolioCardSerializer(serializers.ModelSerializer):
    """A portfolio as it appears in lists, the feed and comparisons."""
    summary = serializers.SerializerMethodField()
    collection_display = serializers.SerializerMethodField()
    stage_display = serializers.CharField(source='get_stage_display', read_only=True)
    sdgs = serializers.SerializerMethodField()
    primary_sdg_name = serializers.SerializerMethodField()
    owner_name = serializers.CharField(source='owner.full_name', read_only=True)
    likes = serializers.IntegerField(source='like_count', read_only=True, default=0)
    comments = serializers.IntegerField(source='comment_count', read_only=True, default=0)
    shares = serializers.IntegerField(source='share_count', read_only=True, default=0)
    liked = serializers.BooleanField(read_only=True, default=False)
    score = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'summary', 'collection', 'collection_display', 'category', 'reference',
            'primary_sdg', 'primary_sdg_name', 'sdgs', 'stage', 'stage_display', 'total_investment',
            'digital_investment', 'ai_investment', 'currency', 'owner_name', 'registration_date',
            'likes', 'comments', 'shares', 'liked', 'score',
        ]

    def get_summary(self, obj):
        text = ' '.join(obj.description.split())
        return text if len(text) <= 220 else text[:217].rstrip() + '…'

    def get_collection_display(self, obj):
        return COLLECTION_LABEL.get(obj.collection, obj.collection)

    def get_sdgs(self, obj):
        goals = [tag.goal for tag in obj.sdgs.all()]
        if obj.primary_sdg and obj.primary_sdg not in goals:
            goals.insert(0, obj.primary_sdg)
        return goals

    def get_primary_sdg_name(self, obj):
        return sdg_name(obj.primary_sdg) if obj.primary_sdg else None

    def get_score(self, obj):
        latest = obj.latest_score
        return latest.score if latest else None


class PortfolioDetailSerializer(PortfolioCardSerializer):
    sections = serializers.SerializerMethodField()
    sdg_alignment = serializers.SerializerMethodField()
    registry_status = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta(PortfolioCardSerializer.Meta):
        fields = PortfolioCardSerializer.Meta.fields + [
            'description', 'sector', 'costing_period', 'conventional_investment', 'sections',
            'sdg_alignment', 'registry_status', 'can_manage', 'created_at',
        ]

    def get_sections(self, obj):
        details = obj.details or {}
        return [{'key': key, 'label': label, 'text': details[key]}
                for key, label in PORTFOLIO_SECTIONS if details.get(key)]

    def get_sdg_alignment(self, obj):
        return [{'goal': tag.goal, 'name': sdg_name(tag.goal), 'primary': tag.goal == obj.primary_sdg,
                 'indicators': [{'name': i.name, 'target_value': i.target_value,
                                 'current_value': i.current_value, 'progress': round(100 * i.progress)}
                                for i in tag.indicators.all()]}
                for tag in obj.sdgs.all()]

    def get_registry_status(self, obj):
        entry = getattr(obj, 'registry_entry', None)
        return entry.get_status_display() if entry else None

    def get_can_manage(self, obj):
        user = self.context['request'].user
        return bool(user.is_authenticated and (user.is_admin or obj.owner_id == user.id))


class CommentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_actor = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioComment
        fields = ['id', 'body', 'user_name', 'user_actor', 'created_at', 'can_delete']
        read_only_fields = ['created_at']
        extra_kwargs = {'body': {'error_messages': {'blank': 'Write a comment first.'}}}

    def get_user_name(self, obj):
        return short_name(obj.user)

    def get_user_actor(self, obj):
        return ACTOR_LABEL.get(obj.user.actor_type, '')

    def get_can_delete(self, obj):
        user = self.context['request'].user
        return bool(user.is_authenticated and (user.is_admin or obj.user_id == user.id))

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Write a comment first.')
        if len(value) > 4000:
            raise serializers.ValidationError('Comments are limited to 4,000 characters.')
        return value


# --------------------------------------------------------- communities --

class CommunitySerializer(serializers.ModelSerializer):
    pillar_display = serializers.SerializerMethodField()
    actor_types = serializers.SerializerMethodField()
    member_count = serializers.IntegerField(read_only=True, default=0)
    post_count = serializers.IntegerField(read_only=True, default=0)
    is_member = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Community
        fields = ['slug', 'name', 'pillar', 'pillar_display', 'description', 'actor_types',
                  'member_count', 'post_count', 'is_member']

    def get_pillar_display(self, obj):
        return PILLAR_LABEL.get(obj.pillar, obj.pillar)

    def get_actor_types(self, obj):
        return [{'key': key, 'label': ACTOR_LABEL.get(key, key)} for key in obj.actor_types]


class PostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_actor = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    can_delete = serializers.SerializerMethodField()
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.exclude(stage=Stage.DRAFT), required=False, allow_null=True)

    class Meta:
        model = CommunityPost
        fields = ['id', 'body', 'author_name', 'author_actor', 'project', 'project_name', 'created_at', 'can_delete']
        read_only_fields = ['created_at']

    def get_author_name(self, obj):
        return short_name(obj.author)

    def get_author_actor(self, obj):
        return ACTOR_LABEL.get(obj.author.actor_type, '')

    def get_can_delete(self, obj):
        user = self.context['request'].user
        return bool(user.is_authenticated and (user.is_admin or obj.author_id == user.id))

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Write something to post.')
        if len(value) > 8000:
            raise serializers.ValidationError('Posts are limited to 8,000 characters.')
        return value


# ------------------------------------------------------------- members --

class MemberSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='full_name', read_only=True)
    actor_type_display = serializers.SerializerMethodField()
    portfolio_count = serializers.IntegerField(read_only=True, default=0)
    community_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        # Email addresses are deliberately left out of the public directory.
        fields = ['id', 'name', 'actor_type', 'actor_type_display', 'organization', 'headline', 'location',
                  'sdg_interests', 'date_joined', 'portfolio_count', 'community_count']

    def get_actor_type_display(self, obj):
        return ACTOR_LABEL.get(obj.actor_type, '')


# ---------------------------------------------------- service requests --

class ServiceRequestSerializer(serializers.ModelSerializer):
    service_display = serializers.CharField(source='get_service_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requester_name = serializers.CharField(source='requester.full_name', read_only=True)
    requester_email = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    community_name = serializers.CharField(source='community.name', read_only=True, default=None)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.exclude(stage=Stage.DRAFT), required=False, allow_null=True)
    community = serializers.SlugRelatedField(
        slug_field='slug', queryset=Community.objects.all(), required=False, allow_null=True)

    class Meta:
        model = ServiceRequest
        fields = ['id', 'code', 'service', 'service_display', 'project', 'project_name', 'community',
                  'community_name', 'message', 'status', 'status_display', 'admin_notes', 'requester_name',
                  'requester_email', 'created_at', 'updated_at']
        read_only_fields = ['code', 'status', 'admin_notes', 'created_at', 'updated_at']
        extra_kwargs = {'message': {'error_messages': {'blank': 'Describe what you need.'}}}

    def get_requester_email(self, obj):
        # Admins handling the request need a way to reach the member.
        user = self.context['request'].user
        return obj.requester.email if user.is_admin else None

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError('Describe what you need.')
        return value.strip()


class ServiceRequestUpdateSerializer(serializers.ModelSerializer):
    """Administrators move a request along and leave notes."""

    class Meta:
        model = ServiceRequest
        fields = ['status', 'admin_notes']
