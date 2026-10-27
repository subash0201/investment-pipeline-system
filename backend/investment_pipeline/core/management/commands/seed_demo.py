"""Load demo accounts and sample projects:  python manage.py seed_demo [--reset]"""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.constants import SDG_BY_NUMBER
from core.models import (
    PIPELINE, Community, CommunityMembership, CommunityPost, PortfolioComment, PortfolioLike, PortfolioShare,
    Project, ProjectSDG, ReadinessScore, RegistryActivity, RegistryEntry, SDGIndicator, ServiceRequest,
    Stage, StageHistory, StageRequest, User,
)

PASSWORD = 'Passw0rd!'
S = Stage
REJECTED_PATH = [S.DRAFT, S.REGISTERED, S.UNDER_REVIEW, S.PENDING_APPROVAL, S.REJECTED]

USERS = [
    ('sam', 'sam.rivera@example.com', 'Sam', 'Rivera', User.Role.USER),
    ('alex', 'alex.morgan@example.com', 'Alex', 'Morgan', User.Role.ADMIN),
    ('priya', 'priya.nair@example.com', 'Priya', 'Nair', User.Role.USER),
    ('jo', 'jo.patel@example.com', 'Jo', 'Patel', User.Role.USER),
    ('lee', 'lee.chen@example.com', 'Lee', 'Chen', User.Role.USER),
]

# key: actor type, organization, headline, location, SDG interests, followed collections
PROFILES = {
    'sam': ('startup', 'GreenGrid Labs', 'Founder building clean-energy micro-grids', 'Pokhara, Gandaki',
            [7, 9, 13], ['draft', 'member']),
    'alex': ('government', 'Investment Board Secretariat', 'Platform administrator', 'Kathmandu, Bagmati',
             [8, 9, 17], ['sdg_intervention', 'sovereign']),
    'priya': ('investor', 'Himal Angels', 'Seed investor in AgriTech and climate', 'Lalitpur, Bagmati',
              [2, 13], ['draft', 'member', 'nap']),
    'jo': ('development_partner', 'Mountain Resilience Fund', 'Blended finance for adaptation',
           'Kathmandu, Bagmati', [6, 11, 13], ['nap', 'sdg_intervention']),
    'lee': ('platform_company', 'Sagarmatha Cloud', 'Sovereign cloud and AI infrastructure', 'Biratnagar, Koshi',
            [9, 16, 17], ['sovereign']),
}

B = 1_000_000_000  # NRs billion
# Catalogue portfolios: collection, reference, name, category, primary SDG, secondary SDGs,
# total / digital / AI (NRs billion), summary, sections
CATALOGUE = [
    ('draft', '2_SDG2_INT_005', 'Digital Market Price Information System', 'Agriculture and Food', 2, [1, 8, 13],
     None, None, None,
     "A digital/AI intervention for Nepal aligned with SDG 2 and the Digital Nepal Framework.",
     {'purpose': "Deploy a digital market price information system to improve transparency and decisions "
                 "in Nepal's agriculture, food security and nutrition sector.",
      'objectives': "• Expand coverage of market price information across Nepal\n• Digitize delivery through the "
                    "farmer registry\n• Use AI crop advisory with human oversight",
      'target_groups': "• Smallholder farmers\n• Agro-enterprises and cooperatives\n• Women farmers",
      'geographic_scope': "Countrywide: 7 provinces, 753 local governments. Priority: Karnali, Sudurpaschim, Madhes.",
      'strategic_alignment': "Sixteenth Periodic Plan; Digital Nepal Framework 2.0; National AI Policy 2082; "
                             "Agriculture Development Strategy 2015–2035.",
      'nepal_context': "Farming families: 4,130,000 households (2021). Stunting, children under 5: 25% (2022).",
      'validation_notes': "No cost figure exists in the catalogue for this entry. Cost it through a feasibility "
                          "study before publishing financing figures."}),
    ('draft', '2_SDG2_INT_004', 'AI-Matched Seasonal Agri-Labor Deployment', 'Agriculture and Food', 2, [8],
     None, None, None, "Matching seasonal agricultural labour to farm demand with AI forecasting.", {}),
    ('draft', '9_SDG9_INT_011', 'Digital IP & Patent Registration Standardization Platform',
     'Governance, Public Data and Standards', 9, [16], None, None, None,
     "A single digital platform for intellectual property and patent registration.", {}),
    ('sdg_intervention', '3_SDG3_INT_ALL', 'Health Workforce', 'Health', 3, [5, 10], 312.4, 62.5, 50.0,
     "Costed SDG 3 intervention to close Nepal's health workforce gap.",
     {'financing_strategy': "Blend of federal budget, development partner grants and private training providers.",
      'performance_indicators': "• Doctors, nurses and midwives per 10,000 people\n• Vacancy rate at health posts"}),
    ('sdg_intervention', '4_SDG4_INT_002', 'Digital Classrooms for Public Schools', 'Education', 4, [5, 9],
     185.0, 37.0, 29.6, "Connectivity, devices and teacher training for public schools.", {}),
    ('sdg_intervention', '1_SDG1_INT_003', 'Pro-Poor Social Protection Program', 'Social Protection', 1, [10],
     240.0, 48.0, 38.4, "Targeted cash transfers delivered through a digital social registry.", {}),
    ('sdg_indicator', '6_SDG6_IND_001', 'Safely Managed Drinking Water Coverage', 'Water and Sanitation', 6, [3],
     96.0, 19.2, 15.4, "Indicator costing for safely managed drinking water services.", {}),
    ('nap', 'NAP_AGRI_004', 'Climate-Smart Agriculture Extension', 'Agriculture and Food Security', 13, [2],
     58.7, 11.7, 9.4, "Adaptation priority: climate-resilient crops, insurance and advisory services.", {}),
    ('nap', 'NAP_GOV_001', 'Strengthen Capacities of Federal Thematic Ministries and Provincial Agencies',
     'Climate Governance', 13, [16, 17], 21.3, 4.3, 3.4,
     "Adaptation planning, budgeting and monitoring capacity across government.", {}),
    ('nap', 'NAP_WASH_002', 'Climate-Resilient Water Supply', 'Water Resources and Energy', 6, [13],
     44.2, 8.8, 7.1, "Climate-proofing drinking water schemes against floods and drought.", {}),
    ('sovereign', 'SOV_L01_ENERGY', 'Energy for Compute', 'Layer 1 — Energy for compute', 7, [9],
     35.0, 35.0, 10.0, "Dedicated renewable power for national data centres.", {}),
    ('sovereign', 'SOV_L05_CLOUD', 'National Sovereign Cloud', 'Layer 5 — Sovereign cloud', 9, [16],
     28.0, 28.0, 6.0, "Government-grade cloud hosted in Nepal under Nepali law.", {}),
    ('sovereign', 'SOV_L12_AIGOV', 'AI Governance and Safety Office', 'Layer 12 — AI governance', 16, [9, 17],
     4.5, 4.5, 4.5, "Institutional capacity to implement the National AI Policy 2082.", {}),
]

# Who likes / comments on which catalogue reference.
LIKES = [('priya', '2_SDG2_INT_005'), ('jo', '2_SDG2_INT_005'), ('sam', 'NAP_AGRI_004'),
         ('priya', '2_SDG2_INT_004'), ('lee', 'SOV_L05_CLOUD'), ('alex', 'SOV_L05_CLOUD'),
         ('jo', 'NAP_WASH_002'), ('priya', 'PRJ-0035'), ('lee', 'PRJ-0032')]
COMMENTS = [
    ('priya', '2_SDG2_INT_005', 'Interested in a pilot in Madhes. Is there a costing study under way?'),
    ('jo', '2_SDG2_INT_005', 'Our fund could support the feasibility study through blended finance.'),
    ('alex', 'SOV_L05_CLOUD', 'The sovereign cloud layer depends on the energy-for-compute portfolio.'),
    ('sam', 'NAP_AGRI_004', 'Advisory services could reuse the market price system data.'),
]
POSTS = [
    ('investors-circle', 'priya', 'Looking for co-investors on AgriTech draft portfolios this quarter.', None),
    ('deal-room-co-investment', 'jo', 'Open to syndicating climate adaptation deals above NRs 1 billion.', None),
    ('startups-entrepreneurs-nepal', 'sam', 'Building on the micro-grid portfolio — looking for a pilot municipality.',
     'PRJ-0042'),
    ('digital-ai-sovereign-stack', 'lee', 'Shared a draft architecture for layers 1–5 of the sovereign stack.', None),
]
MEMBERSHIPS = {
    'sam': ['startups-entrepreneurs-nepal', 'investment-readiness-clinic'],
    'priya': ['investors-circle', 'deal-room-co-investment'],
    'jo': ['blended-climate-finance', 'deal-room-co-investment', 'climate-nap-portfolio'],
    'lee': ['digital-ai-sovereign-stack', 'ai-digital-economy-experts'],
    'alex': ['sdg-investment-data-room'],
}

SOLAR_INDICATORS = {
    7: [('Renewable energy share (%)', 60, 38), ('Households electrified', 2400, 1800)],
    9: [('Local suppliers engaged', 20, 12)],
    13: [('CO2e avoided (t/yr)', 5000, 3100), ('Emission reduction (%)', 40, 22)],
}

# code, name, owner, stage, registered (days ago), last stage change (days ago),
# SDGs, indicator progress, scores [(days ago, score, by, remarks)], description
PROJECTS = [
    ('PRJ-0042', 'Solar Micro-grid Expansion', 'sam', S.UNDER_REVIEW, 51, 48, [7, 9, 13], None,
     [(84, 55, 'jo', 'Early concept; financing plan incomplete.'),
      (66, 64, 'sam', 'Needs permit timeline.'),
      (51, 72, 'sam', 'Financial model updated.')],
     'Community solar and battery storage micro-grid serving 12 villages currently on diesel generation.'),
    ('PRJ-0041', 'Urban Water Recycling Plant', 'sam', S.PENDING_APPROVAL, 60, 13, [6, 11], 0.48,
     [(20, 82, 'sam', 'Offtake agreement signed with the municipality.')],
     'Greywater treatment and reuse facility supplying non-potable water to three industrial estates.'),
    ('PRJ-0039', 'Rural Telehealth Network', 'sam', S.INVESTMENT_READY, 73, 30, [3, 10], 0.81,
     [(30, 91, 'sam', 'Pilot clinics exceeded patient targets.')],
     'Connects 40 rural health posts to district hospitals with remote consultation and diagnostics.'),
    ('PRJ-0037', 'Green Hydrogen Pilot', 'sam', S.REGISTERED, 80, 80, [7, 13], 0.22, [],
     'Pilot electrolyser powered by surplus hydro generation, producing hydrogen for local fertiliser use.'),
    ('PRJ-0035', 'Smart Waste Sorting Hub', 'sam', S.LISTED, 94, 13, [11, 12], 0.9,
     [(35, 88, 'sam', 'Operating partner and site secured.')],
     'Automated sorting and recycling hub diverting municipal solid waste away from landfill.'),
    ('PRJ-0033', 'Vocational Training Campus', 'sam', S.REJECTED, 106, 22, [4, 8], 0.4,
     [(60, 72, 'sam', 'Curriculum accredited.'), (18, 54, 'sam', 'Re-evaluated after construction cost overrun.')],
     'Technical campus training 800 young people a year in construction, electrical and digital trades.'),
    ('PRJ-0031', 'Coastal Mangrove Restoration', 'sam', S.DRAFT, 122, 122, [], None, [],
     'Restoring mangrove belts along the coast.'),
    ('PRJ-0029', 'Community Solar Schools', 'sam', S.UNDER_REVIEW, 6, 4, [4, 7], 0.35,
     [(5, 66, 'sam', 'Maintenance model still to be costed.')],
     'Rooftop solar with battery backup for 60 public schools, with energy clubs run by students.'),
    ('PRJ-0040', 'Community Biogas Network', 'priya', S.LISTED, 110, 35, [7, 12], 0.75,
     [(50, 84, 'priya', 'Feedstock contracts in place.')],
     'Shared biogas digesters turning farm and market waste into cooking gas for 3,000 households.'),
    ('PRJ-0036', 'Harbour Cold-chain Logistics', 'priya', S.LISTED, 90, 20, [2, 9], 0.6,
     [(40, 82, 'priya', 'Anchor tenants signed letters of intent.')],
     'Cold storage and refrigerated transport linking fishing cooperatives to inland markets.'),
    ('PRJ-0030', 'Riverbank Flood Defences', 'priya', S.APPROVED, 45, 8, [11, 13], 0.3,
     [(15, 75, 'priya', 'Engineering design reviewed.')],
     'Embankments and early-warning sensors protecting 9,000 riverside residents from seasonal floods.'),
    ('PRJ-0038', 'Urban Rooftop Farms', 'jo', S.INVESTMENT_READY, 100, 10, [2, 11], 0.55,
     [(55, 73, 'jo', 'Yield data from two pilot rooftops.')],
     'Hydroponic rooftop farms on public buildings supplying fresh vegetables to school kitchens.'),
    ('PRJ-0034', 'Highland Agro-processing Park', 'jo', S.LISTED, 85, 27, [8, 9], 0.65,
     [(45, 79, 'jo', 'Land lease and utilities confirmed.')],
     'Shared processing, packaging and storage facilities for 1,200 smallholder tea and spice growers.'),
    ('PRJ-0028', 'Lakeside Eco-tourism Trail', 'jo', S.REGISTERED, 3, 3, [], None, [],
     'Community-run trail, homestays and guide training around the lake conservation area.'),
    ('PRJ-0032', 'Precision Irrigation Grid', 'lee', S.LISTED, 120, 64, [2, 6], 0.85,
     [(75, 90, 'lee', 'Water savings verified by third party.')],
     'Sensor-driven drip irrigation shared across 450 farms, cutting water use by a third.'),
    ('PRJ-0027', 'E-bus Depot Electrification', 'lee', S.UNDER_REVIEW, 25, 12, [7, 11, 13], 0.25,
     [(10, 61, 'lee', 'Grid connection study outstanding.')],
     'Charging depot and 40 electric buses replacing the diesel fleet on four city routes.'),
    ('PRJ-0026', 'Digital Skills Bootcamp', 'lee', S.DRAFT, 2, 2, [], None, [],
     'Twelve-week coding and data bootcamps for unemployed graduates.'),
]

# code, project, listed (days ago), amount, status
REGISTRY = [
    ('REG-0007', 'PRJ-0032', 64, 2_050_000, RegistryEntry.Status.FUNDED),
    ('REG-0008', 'PRJ-0038', 49, 1_100_000, RegistryEntry.Status.DELISTED),
    ('REG-0009', 'PRJ-0040', 35, 900_000, RegistryEntry.Status.FUNDED),
    ('REG-0010', 'PRJ-0034', 27, 2_500_000, RegistryEntry.Status.LISTED),
    ('REG-0011', 'PRJ-0036', 20, 3_200_000, RegistryEntry.Status.LISTED),
    ('REG-0012', 'PRJ-0035', 13, 1_800_000, RegistryEntry.Status.LISTED),
]

# code, project, from, to, requested (days ago), justification
PENDING = [
    ('REQ-0112', 'PRJ-0033', S.REJECTED, S.UNDER_REVIEW, 16,
     'Construction budget has been revised and a new permit timeline is attached.'),
    ('REQ-0114', 'PRJ-0037', S.REGISTERED, S.UNDER_REVIEW, 14,
     'Feasibility study is complete; requesting technical review.'),
    ('REQ-0116', 'PRJ-0041', S.UNDER_REVIEW, S.PENDING_APPROVAL, 13,
     'SDG indicators are tagged and the latest readiness score is above the threshold.'),
]


class Command(BaseCommand):
    help = 'Create demo users, projects, scores, stage requests and registry entries.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete existing data first.')

    @transaction.atomic
    def handle(self, *args, **options):
        if Project.objects.exists() or User.objects.exists():
            if not options['reset']:
                raise CommandError('The database already has data. Re-run with --reset to replace it.')
            for model in (CommunityPost, CommunityMembership, ServiceRequest, PortfolioShare, PortfolioComment,
                          PortfolioLike, RegistryActivity, RegistryEntry, StageRequest, Project, User):
                model.objects.all().delete()

        today = timezone.localdate()
        day = lambda ago: today - timedelta(days=ago)  # noqa: E731
        moment = lambda ago: timezone.make_aware(datetime.combine(day(ago), time(10, 30)))  # noqa: E731

        users = {}
        for key, email, first, last, role in USERS:
            create = User.objects.create_superuser if role == User.Role.ADMIN else User.objects.create_user
            actor, organization, headline, location, sdgs, follows = PROFILES[key]
            users[key] = create(email=email, password=PASSWORD, first_name=first, last_name=last,
                                actor_type=actor, organization=organization, headline=headline,
                                location=location, sdg_interests=sdgs, followed_collections=follows)
        admin = users['alex']

        projects = {}
        for code, name, owner, stage, registered, changed, goals, ratio, scores, description in PROJECTS:
            project = Project.objects.create(
                code=code, name=name, description=description, owner=users[owner], stage=stage,
                registration_date=day(registered), created_at=moment(registered), updated_at=moment(changed),
                sdg_updated_at=moment(max(changed - 1, 0)) if goals else None,
                primary_sdg=goals[0] if goals else None,
            )
            projects[code] = project

            path = REJECTED_PATH if stage == S.REJECTED else PIPELINE[:PIPELINE.index(stage) + 1]
            # Draft and Registered share the registration day; later stages are spread out evenly.
            later = max(len(path) - 2, 1)
            starts = [registered if i < 2 else round(registered - (registered - changed) * (i - 1) / later)
                      for i in range(len(path))]
            for i, step in enumerate(path):
                StageHistory.objects.create(
                    project=project, stage=step, start_date=day(starts[i]),
                    end_date=day(starts[i + 1]) if i + 1 < len(path) else None)
                # Every past move that needed an administrator has an approved request behind it.
                if i and path[i - 1] in (S.REGISTERED, S.UNDER_REVIEW) and (step != S.PENDING_APPROVAL or i + 1 < len(path)):
                    outcome_index = i + 1 if step == S.PENDING_APPROVAL else i
                    outcome = path[outcome_index]
                    StageRequest.objects.create(
                        project=project, from_stage=path[i - 1], to_stage=step, requested_by=users[owner],
                        created_at=moment(starts[i]), decided_by=admin, decided_at=moment(starts[outcome_index]),
                        status=(StageRequest.Status.REJECTED if outcome == S.REJECTED
                                else StageRequest.Status.APPROVED),
                        comments='Permit timeline missing' if outcome == S.REJECTED else '',
                        resulting_stage=outcome,
                        justification='Ready for the next stage of review.')

            for goal in goals:
                tag = ProjectSDG.objects.create(project=project, goal=goal)
                rows = (SOLAR_INDICATORS[goal] if ratio is None else
                        [(label, 100 * (n + 1), round(100 * (n + 1) * ratio))
                         for n, label in enumerate(SDG_BY_NUMBER[goal]['indicators'][:2])])
                for label, target, current in rows:
                    SDGIndicator.objects.create(
                        project_sdg=tag, name=label, target_value=target, current_value=current)

            for ago, score, by, remarks in scores:
                ReadinessScore.objects.create(
                    project=project, evaluation_date=day(ago), score=score, remarks=remarks,
                    evaluated_by=users[by])

        for code, project_code, from_stage, to_stage, ago, justification in PENDING:
            project = projects[project_code]
            StageRequest.objects.create(
                code=code, project=project, from_stage=from_stage, to_stage=to_stage,
                requested_by=project.owner, created_at=moment(ago), justification=justification)

        for code, project_code, ago, amount, status in REGISTRY:
            RegistryEntry.objects.create(
                code=code, project=projects[project_code], listed_date=day(ago),
                investment_amount=Decimal(amount), status=status)

        now = timezone.now()
        for code, action, detail, age in [
            ('REG-0012', 'listed', 'Smart Waste Sorting Hub', timedelta(hours=2)),
            ('REG-0011', 'edited', 'Investment amount updated', timedelta(days=1)),
            ('REG-0010', 'listed', 'Highland Agro-processing Park', timedelta(days=3)),
            ('REG-0007', 'funded', 'Precision Irrigation Grid', timedelta(days=7)),
        ]:
            RegistryActivity.objects.create(entry_code=code, action=action, detail=detail, created_at=now - age)

        self.seed_network(users, projects, admin, day, moment)

        if options['verbosity']:
            self.stdout.write(self.style.SUCCESS(
                f'Seeded {len(users)} users and {Project.objects.count()} portfolios. '
                f'Password for every account: {PASSWORD}'))
            self.stdout.write('  User : sam.rivera@example.com')
            self.stdout.write('  Admin: alex.morgan@example.com')

    def seed_network(self, users, projects, admin, day, moment):
        """Catalogue portfolios, engagement, community posts and service requests."""
        by_ref = dict(projects)
        for index, (collection, ref, name, category, primary, secondary, total, digital, ai, summary,
                    sections) in enumerate(CATALOGUE):
            ago = 40 - index * 2
            project = Project.objects.create(
                name=name, description=summary, owner=admin, stage=Stage.REGISTERED, collection=collection,
                category=category, reference=ref, primary_sdg=primary, costing_period='2026-2030',
                total_investment=Decimal(str(total)) * B if total else None,
                conventional_investment=Decimal(str(total - digital - ai)) * B if total else None,
                digital_investment=Decimal(str(digital)) * B if digital else None,
                ai_investment=Decimal(str(ai)) * B if ai else None,
                details=sections, registration_date=day(ago), created_at=moment(ago), updated_at=moment(ago))
            StageHistory.objects.create(project=project, stage=Stage.DRAFT, start_date=day(ago), end_date=day(ago))
            StageHistory.objects.create(project=project, stage=Stage.REGISTERED, start_date=day(ago))
            for goal in [primary, *secondary]:
                ProjectSDG.objects.get_or_create(project=project, goal=goal)
            by_ref[ref] = project

        for n, (who, ref) in enumerate(LIKES):
            PortfolioLike.objects.create(user=users[who], project=by_ref[ref], created_at=moment(n % 9))
        for n, (who, ref, body) in enumerate(COMMENTS):
            PortfolioComment.objects.create(user=users[who], project=by_ref[ref], body=body, created_at=moment(n + 1))
        for n, channel in enumerate(['copy', 'whatsapp', 'linkedin']):
            PortfolioShare.objects.create(project=by_ref['2_SDG2_INT_005'], channel=channel, created_at=moment(n))

        communities = {c.slug: c for c in Community.objects.all()}
        for who, slugs in MEMBERSHIPS.items():
            for slug in slugs:
                if slug in communities:
                    CommunityMembership.objects.get_or_create(community=communities[slug], user=users[who])
        for n, (slug, who, body, ref) in enumerate(POSTS):
            if slug in communities:
                CommunityPost.objects.create(community=communities[slug], author=users[who], body=body,
                                             project=by_ref.get(ref) if ref else None, created_at=moment(n + 2))

        ServiceRequest.objects.create(
            requester=users['sam'], service='investment_readiness', project=by_ref['PRJ-0042'],
            message='Please review our financial model before we request Pending Approval.', created_at=moment(3))
        ServiceRequest.objects.create(
            requester=users['priya'], service='due_diligence', project=by_ref['PRJ-0036'],
            community=communities.get('due-diligence-advisory'), status=ServiceRequest.Status.IN_PROGRESS,
            message='Requesting technical due diligence on the cold-chain listing.', created_at=moment(6),
            admin_notes='Assigned to the advisory panel.')
