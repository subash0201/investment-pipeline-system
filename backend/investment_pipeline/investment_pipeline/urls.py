"""URL configuration for the investment_pipeline project.

The React app owns /admin/... (the administrator workspace), so Django's own admin
site lives under DJANGO_ADMIN_URL (default: django-admin/).
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    path('api/', include('core.urls')),
]
