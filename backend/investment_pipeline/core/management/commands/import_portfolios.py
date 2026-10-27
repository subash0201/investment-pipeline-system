"""Import catalogue portfolios (SDG Intervention, Climate NAP, Digital/AI Sovereign...)
from a JSON or CSV file.

    python manage.py import_portfolios portfolios.json --owner admin@example.org
    python manage.py import_portfolios nap.csv --collection nap --unit billion --dry-run

Each record (JSON object or CSV row) may contain:

    name*                 portfolio title
    description           one-paragraph summary
    collection            sdg_intervention | sdg_indicator | nap | sovereign | draft | member
                          (or pass --collection for the whole file)
    category, sector      e.g. "Agriculture and Food"
    reference             catalogue ID, e.g. 2_SDG2_INT_005 — re-importing updates the same portfolio
    primary_sdg           1–17
    secondary_sdgs        list (JSON) or "1 8 13" / "1,8,13" (CSV)
    costing_period        e.g. 2026-2030
    currency              default NPR
    total_investment, conventional_investment, digital_investment, ai_investment
                          numbers, scaled by --unit (unit | thousand | million | billion)
    any portfolio section: purpose, rationale, objectives, target_groups, geographic_scope,
        strategic_alignment, nepal_context, investment_opportunity, demand_assessment,
        implementation, financing_strategy, stakeholder_coordination, performance_indicators,
        risk_register, monitoring_evaluation, investment_readiness, data_sources, validation_notes
        (top level or inside a "details" object; lists and objects are turned into readable text)

Imported portfolios start in the Registered stage, so they are public straight away.
"""
import csv
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.constants import COLLECTION_KEYS, SECTION_KEYS
from core.models import Project, ProjectSDG, Stage, User

UNITS = {'unit': 1, 'thousand': 1_000, 'million': 1_000_000, 'billion': 1_000_000_000}
MONEY = ['total_investment', 'conventional_investment', 'digital_investment', 'ai_investment']


def as_text(value, depth=0):
    """Lists and nested objects from catalogue JSON become readable plain text."""
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    if isinstance(value, list):
        lines = [as_text(item, depth + 1) for item in value]
        return '\n'.join(f'• {line}' if '\n' not in line else line for line in lines if line)
    if isinstance(value, dict):
        lines = []
        for key, item in value.items():
            text = as_text(item, depth + 1)
            if not text or text == '—':
                continue
            label = str(key).replace('_', ' ').capitalize()
            lines.append(f'{label}: {text}' if '\n' not in text else f'{label}:\n{text}')
        return '\n'.join(lines)
    return str(value)


def goals(value):
    if value in (None, ''):
        return []
    if isinstance(value, int):
        return [value]
    if isinstance(value, list):
        found = []
        for item in value:
            if isinstance(item, dict):
                item = item.get('sdg_number') or item.get('goal') or item.get('number')
            found += goals(item)
        return found
    return [int(n) for n in re.findall(r'\d+', str(value))]


class Command(BaseCommand):
    help = 'Import catalogue portfolios from a JSON or CSV file (see the module docstring for the format).'

    def add_arguments(self, parser):
        parser.add_argument('path')
        parser.add_argument('--owner', help='Email of the account that owns the imported portfolios '
                                            '(default: the first administrator).')
        parser.add_argument('--collection', choices=COLLECTION_KEYS, help='Collection for records that do not say.')
        parser.add_argument('--unit', choices=list(UNITS), default='unit',
                            help='Scale of the money columns in the file (default: unit = whole NRs).')
        parser.add_argument('--dry-run', action='store_true', help='Validate and report without saving.')

    def read(self, path):
        if path.suffix.lower() == '.json':
            data = json.loads(path.read_text(encoding='utf-8'))
            if isinstance(data, dict):
                data = data.get('portfolios') or data.get('results') or data.get('items') or [data]
            return data
        if path.suffix.lower() == '.csv':
            with path.open(encoding='utf-8-sig', newline='') as handle:
                return list(csv.DictReader(handle))
        raise CommandError('Use a .json or .csv file.')

    def handle(self, *args, **options):
        path = Path(options['path'])
        if not path.exists():
            raise CommandError(f'No such file: {path}')
        if options['owner']:
            owner = User.objects.filter(email__iexact=options['owner']).first()
            if owner is None:
                raise CommandError(f'No account with email {options["owner"]}.')
        else:
            owner = User.objects.filter(role=User.Role.ADMIN).order_by('id').first()
            if owner is None:
                raise CommandError('Create an administrator first (python manage.py createsuperuser) or pass --owner.')

        records = self.read(path)
        scale = Decimal(UNITS[options['unit']])
        created = updated = 0
        problems = []
        with transaction.atomic():
            for number, record in enumerate(records, start=1):
                try:
                    was_new = self.save(record, owner, options['collection'], scale)
                except (ValueError, InvalidOperation) as error:
                    problems.append(f'record {number}: {error}')
                    continue
                created += was_new
                updated += not was_new
            if options['dry_run']:
                transaction.set_rollback(True)

        for problem in problems:
            self.stderr.write(self.style.WARNING(problem))
        verb = 'Would import' if options['dry_run'] else 'Imported'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {created + updated} portfolios ({created} new, {updated} updated), {len(problems)} skipped.'))

    def save(self, record, owner, default_collection, scale):
        name = str(record.get('name') or record.get('title') or '').strip()
        if not name:
            raise ValueError('missing name')
        collection = str(record.get('collection') or default_collection or 'member').strip()
        if collection not in COLLECTION_KEYS:
            raise ValueError(f'unknown collection "{collection}"')

        primary = goals(record.get('primary_sdg'))
        secondary = goals(record.get('secondary_sdgs'))
        if any(not 1 <= g <= 17 for g in primary + secondary):
            raise ValueError('SDG numbers must be between 1 and 17')

        money = {}
        for field in MONEY:
            raw = str(record.get(field) or '').replace(',', '').strip()
            money[field] = (Decimal(raw) * scale).quantize(Decimal('0.01')) if raw not in ('', '—', '-') else None

        sections = dict(record.get('details') or {}) if isinstance(record.get('details'), dict) else {}
        for key in SECTION_KEYS:
            if record.get(key) not in (None, ''):
                sections[key] = record[key]
        details = {key: as_text(value) for key, value in sections.items() if key in SECTION_KEYS and as_text(value)}

        fields = {
            'name': name[:200],
            'description': as_text(record.get('description'))[:5000],
            'collection': collection,
            'category': str(record.get('category') or '').strip()[:120],
            'sector': str(record.get('sector') or '').strip()[:200],
            'primary_sdg': primary[0] if primary else None,
            'costing_period': str(record.get('costing_period') or '').strip()[:20],
            'currency': (str(record.get('currency') or 'NPR').strip().upper() or 'NPR')[:8],
            'details': details,
            **money,
        }
        reference = str(record.get('reference') or '').strip()[:60]
        existing = (Project.objects.filter(reference=reference).first() if reference
                    else Project.objects.filter(name=fields['name'], collection=collection).first())
        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
            existing.save()
            project, is_new = existing, False
        else:
            project = Project.objects.create(owner=owner, reference=reference, **fields)
            project.move_to(Stage.DRAFT)
            project.move_to(Stage.REGISTERED)
            is_new = True

        wanted = list(dict.fromkeys(primary + secondary))
        if wanted:
            project.sdgs.exclude(goal__in=wanted).delete()
            for goal in wanted:
                ProjectSDG.objects.get_or_create(project=project, goal=goal)
        return is_new
