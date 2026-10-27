"""Create the eleven communities of the four "Access to" pillars."""
from django.db import migrations

from core.constants import COMMUNITIES


def create(apps, schema_editor):
    Community = apps.get_model('core', 'Community')
    for order, (slug, name, pillar, description, actor_types) in enumerate(COMMUNITIES):
        Community.objects.update_or_create(slug=slug, defaults={
            'name': name, 'pillar': pillar, 'description': description,
            'actor_types': actor_types, 'order': order})


def remove(apps, schema_editor):
    apps.get_model('core', 'Community').objects.filter(slug__in=[c[0] for c in COMMUNITIES]).delete()


class Migration(migrations.Migration):
    dependencies = [('core', '0002_network_profiles_and_engagement')]
    operations = [migrations.RunPython(create, remove)]
