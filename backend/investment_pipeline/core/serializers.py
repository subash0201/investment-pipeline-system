from rest_framework import serializers

from . import workflow
from .constants import ACTOR_LABEL, COLLECTION_LABEL, sdg_name
from .network_serializers import clean_details
from .models import (
    PIPELINE, Project, ReadinessScore, RegistryEntry, SDGIndicator, Stage, StageRequest, User,
)

MIN_DESCRIPTION = 30


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='full_name', read_only=True)
    actor_type_display = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'first_name', 'last_name', 'role', 'actor_type', 'actor_type_display',
                  'organization', 'headline', 'location', 'sdg_interests', 'followed_collections']

    def get_actor_type_display(self, obj):
        return ACTOR_LABEL.get(obj.actor_type, '')


# ------------------------------------------------------------ projects --

# Portfolio profile fields: the owner (or an admin) may edit these at any stage.
PROFILE_FIELDS = [
    'collection', 'category', 'sector', 'reference', 'primary_sdg', 'costing_period', 'currency',
    'total_investment', 'conventional_investment', 'digital_investment', 'ai_investment', 'details',
]


class ProjectSerializer(serializers.ModelSerializer):
    stage_display = serializers.CharField(source='get_stage_display', read_only=True)
    status = serializers.CharField(read_only=True)
    score = serializers.SerializerMethodField()
    sdgs = serializers.SerializerMethodField()
    owner_name = serializers.CharField(source='owner.full_name', read_only=True)
    submit = serializers.BooleanField(write_only=True, required=False, default=False)
    collection_display = serializers.SerializerMethodField()
    details = serializers.JSONField(required=False)

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'description', 'registration_date', 'stage', 'stage_display',
            'status', 'score', 'sdgs', 'owner_name', 'updated_at', 'submit', 'collection_display',
        ] + PROFILE_FIELDS
        read_only_fields = ['code', 'stage', 'updated_at']
        extra_kwargs = {
            'name': {'error_messages': {
                'blank': 'Project name is required.', 'required': 'Project name is required.'}},
            'registration_date': {'required': False},
        }

    def get_collection_display(self, obj):
        return COLLECTION_LABEL.get(obj.collection, obj.collection)

    def validate_details(self, value):
        return clean_details(value)

    def validate_collection(self, value):
        user = self.context['request'].user
        current = getattr(self.instance, 'collection', 'member')
        if value != current and not user.is_admin:
            raise serializers.ValidationError('Only administrators can place a portfolio in a catalogue collection.')
        return value

    def validate_currency(self, value):
        value = (value or 'NPR').strip().upper()
        if not value.isalpha() or len(value) > 8:
            raise serializers.ValidationError('Use a currency code such as NPR or USD.')
        return value

    def get_score(self, obj):
        latest = obj.latest_score
        return latest.score if latest else None

    def get_sdgs(self, obj):
        return [tag.goal for tag in obj.sdgs.all()]

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Project name is required.')
        return value.strip()

    def validate(self, attrs):
        # A draft may be saved half-finished; a registration may not.
        if attrs.get('submit'):
            description = attrs.get('description', getattr(self.instance, 'description', ''))
            if not description.strip():
                raise serializers.ValidationError({'description': 'Description is required.'})
            if len(description.strip()) < MIN_DESCRIPTION:
                raise serializers.ValidationError(
                    {'description': f'Description must be at least {MIN_DESCRIPTION} characters.'})
        return attrs


class ScoreSerializer(serializers.ModelSerializer):
    evaluated_by = serializers.CharField(source='evaluated_by.full_name', read_only=True)
    above_threshold = serializers.SerializerMethodField()

    class Meta:
        model = ReadinessScore
        fields = ['id', 'evaluation_date', 'score', 'remarks', 'evaluated_by', 'above_threshold']
        extra_kwargs = {
            'score': {'error_messages': {
                'max_value': 'Score must be between 0 and 100.',
                'min_value': 'Score must be between 0 and 100.'}},
        }

    def get_above_threshold(self, obj):
        return obj.score >= workflow.threshold()


class RegistryBriefSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = RegistryEntry
        fields = ['id', 'code', 'listed_date', 'investment_amount', 'status', 'status_display']


class StageRequestSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source='project.id', read_only=True)
    project_code = serializers.CharField(source='project.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    from_stage_display = serializers.CharField(source='get_from_stage_display', read_only=True)
    to_stage_display = serializers.CharField(source='get_to_stage_display', read_only=True)
    resulting_stage_display = serializers.CharField(source='get_resulting_stage_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requested_by = serializers.CharField(source='requested_by.full_name', read_only=True)
    decided_by = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    sdgs = serializers.SerializerMethodField()

    class Meta:
        model = StageRequest
        fields = [
            'id', 'code', 'project_id', 'project_code', 'project_name', 'from_stage',
            'from_stage_display', 'to_stage', 'to_stage_display', 'resulting_stage',
            'resulting_stage_display', 'justification', 'status', 'status_display',
            'requested_by', 'created_at', 'decided_by', 'decided_at', 'comments', 'score', 'sdgs',
        ]

    def get_decided_by(self, obj):
        return obj.decided_by.full_name if obj.decided_by else None

    def get_score(self, obj):
        latest = obj.project.latest_score
        return latest.score if latest else None

    def get_sdgs(self, obj):
        return [tag.goal for tag in obj.project.sdgs.all()]


class ProjectDetailSerializer(ProjectSerializer):
    latest_score = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    sdg_alignment = serializers.SerializerMethodField()
    registry = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    pipeline = serializers.SerializerMethodField()

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + [
            'latest_score', 'history', 'sdg_alignment', 'registry', 'can_manage', 'pipeline',
        ]

    def _can_manage(self, obj):
        user = self.context['request'].user
        return user.is_admin or obj.owner_id == user.id

    def get_can_manage(self, obj):
        return self._can_manage(obj)

    def get_latest_score(self, obj):
        latest = obj.latest_score
        return ScoreSerializer(latest).data if latest else None

    def get_history(self, obj):
        rows = [{
            'stage': h.stage, 'stage_display': h.get_stage_display(),
            'start_date': h.start_date, 'end_date': h.end_date,
            'status': 'Completed' if h.end_date else 'In progress',
        } for h in obj.history.all()]
        upcoming = workflow.next_stage(obj)
        if upcoming and obj.stage in PIPELINE:
            rows.append({'stage': upcoming, 'stage_display': Stage(upcoming).label,
                         'start_date': None, 'end_date': None, 'status': 'Not started'})
        return rows

    def get_sdg_alignment(self, obj):
        return [{'goal': tag.goal, 'name': sdg_name(tag.goal),
                 'indicator_count': len(tag.indicators.all())} for tag in obj.sdgs.all()]

    def get_registry(self, obj):
        entry = getattr(obj, 'registry_entry', None)
        return RegistryBriefSerializer(entry).data if entry else None

    def get_pipeline(self, obj):
        """What the owner can do next. Withheld from people only browsing."""
        if not self._can_manage(obj):
            return None
        upcoming = workflow.next_stage(obj)
        pending = workflow.open_request(obj)
        last = obj.requests.exclude(status=StageRequest.Status.PENDING).order_by('-decided_at').first()
        return {
            'next_stage': upcoming,
            'next_stage_display': Stage(upcoming).label if upcoming else None,
            'requires_approval': workflow.requires_approval(obj),
            'checklist': workflow.checklist(obj),
            'open_request': StageRequestSerializer(pending).data if pending else None,
            'last_decision': StageRequestSerializer(last).data if last else None,
        }


# ----------------------------------------------------------------- SDG --

class IndicatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = SDGIndicator
        fields = ['id', 'name', 'target_value', 'current_value', 'notes']
        extra_kwargs = {
            'name': {'error_messages': {'blank': 'Choose or type an indicator.'}},
            'target_value': {'min_value': 0},
            'current_value': {'min_value': 0},
        }

    def validate_target_value(self, value):
        if value <= 0:
            raise serializers.ValidationError('Target value must be greater than 0.')
        return value


class SDGTagSerializer(serializers.Serializer):
    goal = serializers.IntegerField(min_value=1, max_value=17)
    name = serializers.SerializerMethodField()
    indicators = IndicatorSerializer(many=True, required=False)

    def get_name(self, obj):
        goal = obj['goal'] if isinstance(obj, dict) else obj.goal
        return sdg_name(goal)


class SDGTagsSerializer(serializers.Serializer):
    goals = SDGTagSerializer(many=True)

    def validate_goals(self, value):
        numbers = [item['goal'] for item in value]
        if len(numbers) != len(set(numbers)):
            raise serializers.ValidationError('Each SDG can only be tagged once.')
        return value


# ------------------------------------------------------------ registry --

class RegistryEntrySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    project_code = serializers.CharField(source='project.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    project_preview = serializers.SerializerMethodField()

    class Meta:
        model = RegistryEntry
        fields = [
            'id', 'code', 'project', 'project_code', 'project_name', 'project_preview',
            'listed_date', 'investment_amount', 'status', 'status_display',
        ]
        extra_kwargs = {
            'project': {'error_messages': {
                'required': 'Select a project.', 'null': 'Select a project.',
                'does_not_exist': 'Select a project.', 'incorrect_type': 'Select a project.'}},
            'investment_amount': {'error_messages': {'invalid': 'Enter a valid amount.'}},
        }

    def get_fields(self):
        fields = super().get_fields()
        fields['project'].validators = []  # uniqueness is reported by validate_project
        return fields

    def get_project_preview(self, obj):
        return ProjectSerializer(obj.project).data

    def validate_project(self, project):
        if self.instance:
            if project != self.instance.project:
                raise serializers.ValidationError('The project of an entry cannot be changed.')
            return project
        if RegistryEntry.objects.filter(project=project).exists():
            raise serializers.ValidationError('This project already has a registry entry.')
        if project.stage != Stage.INVESTMENT_READY:
            raise serializers.ValidationError('Only Investment Ready projects can be listed.')
        return project

    def validate_investment_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Investment amount must be greater than 0.')
        return value
