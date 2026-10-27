"""Static reference data: the 17 UN Sustainable Development Goals."""

SDG_GOALS = [
    {'number': 1, 'name': 'No Poverty', 'short': ['No', 'Poverty'],
     'indicators': ['People lifted above poverty line', 'Households with basic services (%)']},
    {'number': 2, 'name': 'Zero Hunger', 'short': ['Zero', 'Hunger'],
     'indicators': ['Food-secure households (%)', 'Agricultural yield (t/ha)']},
    {'number': 3, 'name': 'Good Health & Well-being', 'short': ['Good', 'Health'],
     'indicators': ['Patients served per year', 'Health facilities connected', 'Average travel time to care (min)']},
    {'number': 4, 'name': 'Quality Education', 'short': ['Quality', 'Education'],
     'indicators': ['Learners enrolled', 'Completion rate (%)']},
    {'number': 5, 'name': 'Gender Equality', 'short': ['Gender', 'Equality'],
     'indicators': ['Women in workforce (%)', 'Women in leadership roles (%)']},
    {'number': 6, 'name': 'Clean Water', 'short': ['Clean', 'Water'],
     'indicators': ['People with safe water access', 'Wastewater treated (%)', 'Water recycled (ML/yr)']},
    {'number': 7, 'name': 'Clean Energy', 'short': ['Clean', 'Energy'],
     'indicators': ['Renewable energy share (%)', 'Households electrified', 'Installed capacity (MW)']},
    {'number': 8, 'name': 'Decent Work', 'short': ['Decent', 'Work'],
     'indicators': ['Jobs created', 'Youth employed (%)']},
    {'number': 9, 'name': 'Industry & Innovation', 'short': ['Industry &', 'Innovation'],
     'indicators': ['Infrastructure investment (USD)', 'Local suppliers engaged', 'R&D spend (% of budget)']},
    {'number': 10, 'name': 'Reduced Inequalities', 'short': ['Reduced', 'Inequalities'],
     'indicators': ['Low-income beneficiaries (%)', 'Rural population reached']},
    {'number': 11, 'name': 'Sustainable Cities', 'short': ['Sustainable', 'Cities'],
     'indicators': ['Residents served', 'Waste diverted from landfill (%)']},
    {'number': 12, 'name': 'Responsible Consumption', 'short': ['Responsible', 'Consumption'],
     'indicators': ['Material recycled (t/yr)', 'Recycling rate (%)']},
    {'number': 13, 'name': 'Climate Action', 'short': ['Climate', 'Action'],
     'indicators': ['CO2e avoided (t/yr)', 'Emission reduction (%)']},
    {'number': 14, 'name': 'Life Below Water', 'short': ['Life Below', 'Water'],
     'indicators': ['Coastline protected (km)', 'Marine area restored (ha)']},
    {'number': 15, 'name': 'Life on Land', 'short': ['Life on', 'Land'],
     'indicators': ['Land restored (ha)', 'Trees planted']},
    {'number': 16, 'name': 'Peace & Justice', 'short': ['Peace &', 'Justice'],
     'indicators': ['Community grievances resolved (%)', 'Public disclosures published']},
    {'number': 17, 'name': 'Partnerships for Goals', 'short': ['Partnerships', 'for Goals'],
     'indicators': ['Partner organisations', 'Co-financing mobilised (USD)']},
]

SDG_BY_NUMBER = {g['number']: g for g in SDG_GOALS}


def sdg_name(number):
    goal = SDG_BY_NUMBER.get(number)
    return goal['name'] if goal else f'SDG {number}'


# ------------------------------------------------- investment network --
# Terms below follow the jtech Invest prototype (investment_portfolio_v1.1).

ACTOR_TYPES = [
    ('investor', 'Investor'),
    ('investment_firm', 'Investment Firm'),
    ('startup', 'Startup'),
    ('entrepreneur', 'Entrepreneur'),
    ('platform_company', 'Platform Company'),
    ('business_house', 'Business House'),
    ('association', 'Association'),
    ('financial_institution', 'Financial Institution'),
    ('development_partner', 'Development Partner'),
    ('government', 'Government Agency'),
    ('academic', 'Academic / Research'),
    ('expert', 'Expert / Advisor'),
    ('media', 'Media'),
]
ACTOR_LABEL = dict(ACTOR_TYPES)

# Portfolio collections ("datasets" in the prototype).
COLLECTIONS = [
    ('sdg_intervention', 'SDG Intervention'),
    ('sdg_indicator', 'SDG Indicator'),
    ('nap', 'Climate NAP 2021–2050'),
    ('sovereign', 'Digital/AI Sovereign'),
    ('draft', 'Draft Portfolio'),
    ('member', 'Member Portfolio'),
]
COLLECTION_LABEL = dict(COLLECTIONS)
COLLECTION_KEYS = [key for key, _ in COLLECTIONS]

PILLARS = [
    ('information', 'Access to Information',
     'Catalogues, datasets, dashboards and brochures on Digital/AI, SDG, climate and sovereign investment.'),
    ('knowledge', 'Access to Knowledge',
     'Expert insight, research, investment readiness and learning circles.'),
    ('communities', 'Access to Communities',
     'Peer networks of investors, startups, entrepreneurs, associations and business houses.'),
    ('investment', 'Access to Investment Services',
     'Deal rooms, co-investment, blended finance, due diligence and advisory.'),
]
PILLAR_LABEL = {key: label for key, label, _ in PILLARS}

# The communities of the four pillars, created by migration 0003.
COMMUNITIES = [
    ('sdg-investment-data-room', 'SDG Investment Data Room', 'information',
     'SDG interventions and indicator costing, digital and AI shares for SDGs 1–17.',
     ['government', 'development_partner', 'academic']),
    ('climate-nap-portfolio', 'Climate NAP 2021–2050 Portfolio', 'information',
     'Nepal National Adaptation Plan interventions by sector with digital/AI costing.',
     ['development_partner', 'government', 'business_house']),
    ('digital-ai-sovereign-stack', 'Digital/AI Sovereign Stack', 'information',
     'The 15-layer sovereign Digital/AI investment architecture, from energy-for-compute to AI governance.',
     ['platform_company', 'investment_firm', 'government']),
    ('ai-digital-economy-experts', 'AI & Digital Economy Experts', 'knowledge',
     'Experts, researchers and practitioners sharing analysis on Digital/AI economy investment.',
     ['expert', 'academic', 'platform_company']),
    ('investment-readiness-clinic', 'Investment Readiness Clinic', 'knowledge',
     'Business models, feasibility, financial models and pitch reviews for portfolio owners.',
     ['startup', 'entrepreneur', 'expert']),
    ('startups-entrepreneurs-nepal', 'Startups & Entrepreneurs Nepal', 'communities',
     'Founders building on the draft and member portfolios — find co-founders, pilots and customers.',
     ['startup', 'entrepreneur']),
    ('investors-circle', 'Investors Circle', 'communities',
     'Angels, funds and investment firms discussing deal flow across the Digital/AI economy.',
     ['investor', 'investment_firm', 'financial_institution']),
    ('associations-business-houses', 'Associations & Business Houses', 'communities',
     'Chambers, federations and business groups coordinating private-sector participation.',
     ['association', 'business_house']),
    ('deal-room-co-investment', 'Deal Room & Co-investment', 'investment',
     'Post and discuss live opportunities, syndicate co-investments and term sheets.',
     ['investor', 'investment_firm', 'startup']),
    ('blended-climate-finance', 'Blended & Climate Finance', 'investment',
     'Concessional, blended and climate finance for adaptation and Digital/AI public goods.',
     ['development_partner', 'financial_institution', 'government']),
    ('due-diligence-advisory', 'Due Diligence & Advisory', 'investment',
     'Due diligence, valuation, legal and technical advisory for portfolio deals.',
     ['expert', 'investment_firm', 'financial_institution']),
]

# Investment services a member can request (Access to Investment Services).
SERVICES = [
    ('deal_room', 'Deal room'),
    ('co_investment', 'Co-investment'),
    ('blended_finance', 'Blended / climate finance'),
    ('due_diligence', 'Due diligence'),
    ('advisory', 'Advisory'),
    ('investment_readiness', 'Investment readiness review'),
    ('other', 'Other'),
]

# The written sections of a portfolio record, in display order.
PORTFOLIO_SECTIONS = [
    ('purpose', 'Purpose'),
    ('rationale', 'Rationale'),
    ('objectives', 'Objectives'),
    ('target_groups', 'Target groups'),
    ('geographic_scope', 'Geographic scope'),
    ('strategic_alignment', 'Strategic alignment'),
    ('nepal_context', 'Nepal context'),
    ('investment_opportunity', 'Investment opportunity'),
    ('demand_assessment', 'Demand assessment'),
    ('implementation', 'Implementation'),
    ('financing_strategy', 'Financing strategy'),
    ('stakeholder_coordination', 'Stakeholder coordination'),
    ('performance_indicators', 'Performance indicators'),
    ('risk_register', 'Risk register'),
    ('monitoring_evaluation', 'Monitoring, evaluation and learning'),
    ('investment_readiness', 'Investment readiness'),
    ('data_sources', 'Data sources'),
    ('validation_notes', 'Validation notes'),
]
SECTION_KEYS = [key for key, _ in PORTFOLIO_SECTIONS]

# Built-in affinity of each actor type for each collection (0–1), used by the
# recommender before it is blended with what members actually engage with.
# Column order: SDG Intervention, SDG Indicator, NAP, Sovereign, Draft, Member.
AFFINITY = {
    'investor':              [0.60, 0.10, 0.10, 0.50, 0.90, 1.00],
    'investment_firm':       [0.45, 0.05, 0.41, 0.50, 0.55, 0.40],
    'startup':               [0.10, 0.10, 0.10, 0.50, 1.00, 0.70],
    'entrepreneur':          [0.40, 0.10, 0.10, 0.10, 1.00, 0.80],
    'platform_company':      [0.10, 0.10, 0.10, 1.00, 0.80, 0.10],
    'business_house':        [0.60, 0.10, 0.70, 0.90, 0.10, 0.60],
    'association':           [0.70, 0.10, 0.10, 0.10, 0.70, 0.60],
    'financial_institution': [0.80, 0.10, 0.10, 0.60, 0.80, 0.10],
    'development_partner':   [1.00, 0.80, 1.00, 0.10, 0.10, 0.10],
    'government':            [0.90, 1.00, 0.90, 0.80, 0.10, 0.10],
    'academic':              [0.55, 0.50, 0.30, 0.35, 0.14, 0.05],
    'expert':                [0.10, 0.80, 0.60, 0.80, 0.70, 0.10],
    'media':                 [0.50, 0.10, 0.10, 0.70, 0.70, 0.10],
}

# Catalogues & brochures (Access to Information).
RESOURCES = [
    ('SDG Investment Portfolio', 'Catalogue', 'https://jtech.com.np/digital-AI-SDG-catalogue/'),
    ('Digital/AI SDG Investment Portfolio', 'Brochure', 'https://jtech.com.np/digital-AI-SDG-catalogue/brochure/'),
    ('Nepal Climate Change NAP 2021–2050', 'Catalogue', 'https://jtech.com.np/climate-change-nap-2021-2050-catalogue/'),
    ('Nepal Climate Investment Portfolio', 'Brochure',
     'https://jtech.com.np/climate-change-nap-2021-2050-catalogue/brochure/'),
    ('Digital / AI Sovereign Investment Portfolio', 'Catalogue',
     'https://jtech.com.np/digital-ai-sovereign-investment-portfolio-catalogue/'),
    ('Digital / AI Sovereign Investment Portfolio', 'Brochure',
     'https://jtech.com.np/digital-ai-sovereign-investment-portfolio-catalogue/brochure/'),
    ('Draft Investment Portfolio Dashboard', 'Dashboard', 'https://jtech.com.np/draft-portfolio-list/'),
    ('jTech Investment Portfolio', 'Brochure', 'https://jtech.com.np/draft-portfolio-list/brochure/'),
    ('jTech Investor AI — Recommender', 'Brochure',
     'https://jtech.com.np/AI-Based-Investment-Portfolio-Recommender-System/recomender-brochure/'),
    ('MagicProperty', 'Platform', 'http://jtech.com.np/magicproperty_fb/'),
    ('j-IDES 2027 — International Digital/AI Economy Investors Summit', 'Event', 'https://jtech.com.np/j-ideis2027/'),
]

SHARE_CHANNELS = [
    ('copy', 'Copy link'), ('whatsapp', 'WhatsApp'), ('facebook', 'Facebook'),
    ('linkedin', 'LinkedIn'), ('x', 'X'),
]
