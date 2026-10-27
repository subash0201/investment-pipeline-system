"""Pipeline rules: which stage follows which, and what needs an administrator.

    Draft ──► Registered ──► Under Review ──► Pending Approval ──► Approved
                 (A)             (A)                │
                                  ▲                 └──► Rejected
                                  └───────(A)───────────────┘
    Approved ──► Investment Ready ──► Listed in Registry
        (score ≥ threshold)        (admin adds a registry entry)

(A) = the move is sent to the admin queue as a stage request.

Asking to leave Under Review puts the project in Pending Approval while the
administrator decides; approving lands it in Approved, rejecting in Rejected.
"""
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import RegistryActivity, RegistryEntry, Stage, StageRequest

NEXT_STAGE = {
    Stage.DRAFT: Stage.REGISTERED,
    Stage.REGISTERED: Stage.UNDER_REVIEW,
    Stage.UNDER_REVIEW: Stage.PENDING_APPROVAL,
    Stage.APPROVED: Stage.INVESTMENT_READY,
    Stage.REJECTED: Stage.UNDER_REVIEW,
}
APPROVAL_REQUIRED_FROM = {Stage.REGISTERED, Stage.UNDER_REVIEW, Stage.REJECTED}


def threshold():
    return settings.READINESS_THRESHOLD


def next_stage(project):
    return NEXT_STAGE.get(project.stage)


def requires_approval(project):
    return project.stage in APPROVAL_REQUIRED_FROM


def open_request(project):
    return project.requests.filter(status=StageRequest.Status.PENDING).first()


def checklist(project):
    """Conditions that must all hold before the next move can be requested."""
    stage = project.stage
    if stage not in NEXT_STAGE:
        return []
    items = []
    latest = project.latest_score
    if stage == Stage.DRAFT:
        items.append({'label': 'Description of at least 30 characters',
                      'ok': len(project.description.strip()) >= 30})
    if stage == Stage.UNDER_REVIEW:
        items.append({'label': 'SDGs tagged', 'ok': project.sdgs.exists()})
        items.append({'label': 'Readiness score entered', 'ok': latest is not None})
    if stage in (Stage.UNDER_REVIEW, Stage.APPROVED):
        shown = f' ({latest.score})' if latest else ''
        items.append({'label': f'Score ≥ {threshold()} threshold{shown}',
                      'ok': bool(latest and latest.score >= threshold())})
    items.append({'label': 'No open request for project', 'ok': open_request(project) is None})
    return items


@transaction.atomic
def request_transition(project, user, to_stage=None, justification=''):
    """Move the project on, or queue the move for an admin.

    Returns (stage_request_or_None, requires_approval).
    """
    target = next_stage(project)
    if target is None:
        raise ValidationError({'to_stage': 'This project cannot be moved from its current stage.'})
    if to_stage and to_stage != target:
        raise ValidationError({'to_stage': f'The next stage for this project is {Stage(target).label}.'})
    failed = [item['label'] for item in checklist(project) if not item['ok']]
    if failed:
        raise ValidationError({'checklist': ['Not met: ' + label for label in failed]})

    if not requires_approval(project):
        project.move_to(target)
        return None, False

    stage_request = StageRequest.objects.create(
        project=project, from_stage=project.stage, to_stage=target,
        justification=justification, requested_by=user,
    )
    if project.stage == Stage.UNDER_REVIEW:
        project.move_to(Stage.PENDING_APPROVAL)
    else:
        project.touch()
    return stage_request, True


def _decide(stage_request, admin, status, comments):
    if stage_request.status != StageRequest.Status.PENDING:
        raise ValidationError({'detail': 'This request has already been decided.'})
    stage_request.status = status
    stage_request.decided_by = admin
    stage_request.decided_at = timezone.now()
    stage_request.comments = comments


@transaction.atomic
def approve(stage_request, admin, comments=''):
    _decide(stage_request, admin, StageRequest.Status.APPROVED, comments)
    project = stage_request.project
    target = (Stage.APPROVED if stage_request.to_stage == Stage.PENDING_APPROVAL
              else stage_request.to_stage)
    project.move_to(target)
    stage_request.resulting_stage = target
    stage_request.save()
    return stage_request


@transaction.atomic
def reject(stage_request, admin, comments=''):
    if not comments.strip():
        raise ValidationError({'comments': 'A reason is required when rejecting.'})
    _decide(stage_request, admin, StageRequest.Status.REJECTED, comments.strip())
    project = stage_request.project
    if project.stage == Stage.PENDING_APPROVAL:
        project.move_to(Stage.REJECTED)
    else:
        project.touch()
    stage_request.resulting_stage = project.stage
    stage_request.save()
    return stage_request


# ------------------------------------------------------------ registry --

def log_registry(entry, action, detail=''):
    RegistryActivity.objects.create(entry_code=entry.code, action=action, detail=detail or entry.project.name)


def sync_project_with_entry(entry):
    """A listed or funded entry holds its project in Listed in Registry;
    a delisted one hands it back to Investment Ready."""
    project = entry.project
    wanted = Stage.INVESTMENT_READY if entry.status == RegistryEntry.Status.DELISTED else Stage.LISTED
    if project.stage in (Stage.INVESTMENT_READY, Stage.LISTED) and project.stage != wanted:
        project.move_to(wanted)


def release_project(entry):
    project = entry.project
    if project.stage == Stage.LISTED:
        project.move_to(Stage.INVESTMENT_READY)
