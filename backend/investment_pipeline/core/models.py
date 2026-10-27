import re

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from .constants import ACTOR_TYPES, COLLECTIONS, PILLARS, SERVICES, SHARE_CHANNELS


# ---------------------------------------------------------------- users --

class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError('An email address is required.')
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('role', User.Role.USER)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=User.Role.ADMIN, is_staff=True, is_superuser=True)
        return self._create(email, password, **extra)


class User(AbstractUser):
    """Signs in with an email address; the role decides which workspace opens."""

    class Role(models.TextChoices):
        USER = 'USER', 'User'
        ADMIN = 'ADMIN', 'Admin'

    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USER)

    # Network profile (jtech Invest "Join" form).
    actor_type = models.CharField(max_length=30, choices=ACTOR_TYPES, blank=True)
    organization = models.CharField(max_length=200, blank=True)
    headline = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=120, blank=True)
    sdg_interests = models.JSONField(default=list, blank=True)          # e.g. [2, 7, 13]
    followed_collections = models.JSONField(default=list, blank=True)  # e.g. ['draft', 'member']

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def full_name(self):
        return self.get_full_name() or self.email

    def __str__(self):
        return self.full_name


# ------------------------------------------------------------- helpers --

def next_code(model, prefix):
    """Next human-readable ID such as PRJ-0043, one above the highest in use."""
    highest = 0
    for code in model.objects.values_list('code', flat=True):
        match = re.search(r'(\d+)$', code or '')
        if match:
            highest = max(highest, int(match.group(1)))
    return f'{prefix}-{highest + 1:04d}'


class CodedModel(models.Model):
    CODE_PREFIX = ''
    code = models.CharField(max_length=12, unique=True, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = next_code(type(self), self.CODE_PREFIX)
        super().save(*args, **kwargs)


# ------------------------------------------------------------ projects --

class Stage(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    REGISTERED = 'REGISTERED', 'Registered'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    INVESTMENT_READY = 'INVESTMENT_READY', 'Investment Ready'
    LISTED = 'LISTED', 'Listed in Registry'
    REJECTED = 'REJECTED', 'Rejected'


# The seven stages of the pipeline stepper, in order. REJECTED sits outside it.
PIPELINE = [
    Stage.DRAFT, Stage.REGISTERED, Stage.UNDER_REVIEW, Stage.PENDING_APPROVAL,
    Stage.APPROVED, Stage.INVESTMENT_READY, Stage.LISTED,
]


class Project(CodedModel):
    CODE_PREFIX = 'PRJ'

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    registration_date = models.DateField(default=timezone.localdate)
    stage = models.CharField(max_length=20, choices=Stage.choices, default=Stage.DRAFT)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    sdg_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    # Portfolio profile (jtech Invest portfolio record).
    collection = models.CharField(max_length=20, choices=COLLECTIONS, default='member', db_index=True)
    category = models.CharField(max_length=120, blank=True, db_index=True)
    sector = models.CharField(max_length=200, blank=True)
    reference = models.CharField(max_length=60, blank=True, db_index=True)  # catalogue ID, e.g. 2_SDG2_INT_005
    primary_sdg = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(17)])
    costing_period = models.CharField(max_length=20, blank=True)  # e.g. 2026-2030
    currency = models.CharField(max_length=8, default='NPR')
    total_investment = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    conventional_investment = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    digital_investment = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    ai_investment = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    details = models.JSONField(default=dict, blank=True)  # section key -> text, see PORTFOLIO_SECTIONS

    class Meta:
        ordering = ['-registration_date', '-id']

    def __str__(self):
        return f'{self.code} · {self.name}'

    @property
    def status(self):
        return {
            Stage.DRAFT: 'Draft',
            Stage.LISTED: 'Listed',
            Stage.REJECTED: 'On hold',
        }.get(self.stage, 'Active')

    @property
    def latest_score(self):
        scores = list(self.scores.all())  # uses the prefetch cache when present
        if not scores:
            return None
        return max(scores, key=lambda s: (s.evaluation_date, s.id))

    def touch(self):
        self.updated_at = timezone.now()
        self.save(update_fields=['updated_at'])

    def move_to(self, stage, on=None):
        """Change stage and keep the stage history in step."""
        on = on or timezone.localdate()
        self.history.filter(end_date__isnull=True).update(end_date=on)
        StageHistory.objects.create(project=self, stage=stage, start_date=on)
        self.stage = stage
        self.updated_at = timezone.now()
        self.save(update_fields=['stage', 'updated_at'])


class StageHistory(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='history')
    stage = models.CharField(max_length=20, choices=Stage.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['id']
        verbose_name_plural = 'stage history'


# ----------------------------------------------------------------- SDG --

class ProjectSDG(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='sdgs')
    goal = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(17)])

    class Meta:
        ordering = ['goal']
        constraints = [models.UniqueConstraint(fields=['project', 'goal'], name='unique_project_goal')]
        verbose_name = 'project SDG tag'


class SDGIndicator(models.Model):
    project_sdg = models.ForeignKey(ProjectSDG, on_delete=models.CASCADE, related_name='indicators')
    name = models.CharField(max_length=200)
    target_value = models.DecimalField(max_digits=14, decimal_places=2)
    current_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']
        verbose_name = 'SDG indicator'

    @property
    def progress(self):
        if not self.target_value or self.target_value <= 0:
            return 0.0
        return float(max(0, min(self.current_value / self.target_value, 1)))


# -------------------------------------------------------------- scores --

class ReadinessScore(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='scores')
    evaluation_date = models.DateField()
    score = models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    remarks = models.TextField(blank=True)
    evaluated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-evaluation_date', '-id']


# ------------------------------------------------------ stage requests --

class StageRequest(CodedModel):
    CODE_PREFIX = 'REQ'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='requests')
    from_stage = models.CharField(max_length=20, choices=Stage.choices)
    to_stage = models.CharField(max_length=20, choices=Stage.choices)
    justification = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(default=timezone.now)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+', null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(blank=True)
    # Stage the project ended up in once the request was decided.
    resulting_stage = models.CharField(max_length=20, choices=Stage.choices, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return self.code


# ------------------------------------------------------------ registry --

class RegistryEntry(CodedModel):
    CODE_PREFIX = 'REG'

    class Status(models.TextChoices):
        LISTED = 'LISTED', 'Listed'
        FUNDED = 'FUNDED', 'Funded'
        DELISTED = 'DELISTED', 'Delisted'

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='registry_entry')
    listed_date = models.DateField()
    investment_amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.LISTED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-listed_date', '-id']
        verbose_name_plural = 'registry entries'

    def __str__(self):
        return self.code


class RegistryActivity(models.Model):
    """Audit trail behind "Recent registry activity" on the admin home."""

    entry_code = models.CharField(max_length=12)
    action = models.CharField(max_length=20)  # listed / edited / delisted / funded / removed
    detail = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at', '-id']
        verbose_name_plural = 'registry activity'


# ---------------------------------------------------------- engagement --

class PortfolioLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='likes')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'project'], name='unique_like')]


class PortfolioComment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='comments')
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at', '-id']


class PortfolioShare(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='+', null=True, blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='shares')
    channel = models.CharField(max_length=12, choices=SHARE_CHANNELS, default='copy')
    created_at = models.DateTimeField(default=timezone.now)


# --------------------------------------------------------- communities --

class Community(models.Model):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    pillar = models.CharField(max_length=20, choices=[(k, label) for k, label, _ in PILLARS])
    description = models.TextField(blank=True)
    actor_types = models.JSONField(default=list, blank=True)  # who the community is for
    order = models.PositiveSmallIntegerField(default=0)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through='CommunityMembership', related_name='communities')

    class Meta:
        ordering = ['order', 'name']
        verbose_name_plural = 'communities'

    def __str__(self):
        return self.name


class CommunityMembership(models.Model):
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['community', 'user'], name='unique_membership')]


class CommunityPost(models.Model):
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    body = models.TextField()
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at', '-id']


# ---------------------------------------------------- service requests --

class ServiceRequest(CodedModel):
    """A member asking for an investment service: deal room, due diligence, advisory..."""
    CODE_PREFIX = 'SRV'

    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        IN_PROGRESS = 'IN_PROGRESS', 'In progress'
        CLOSED = 'CLOSED', 'Closed'

    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='service_requests')
    service = models.CharField(max_length=30, choices=SERVICES)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    community = models.ForeignKey(Community, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    message = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return self.code
