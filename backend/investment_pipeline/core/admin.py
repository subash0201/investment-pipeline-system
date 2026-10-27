from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    Community, CommunityMembership, CommunityPost, PortfolioComment, PortfolioLike, PortfolioShare,
    Project, ProjectSDG, ReadinessScore, RegistryActivity, RegistryEntry, SDGIndicator, ServiceRequest,
    StageHistory, StageRequest, User,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['email']
    list_display = ['email', 'first_name', 'last_name', 'role', 'actor_type', 'organization', 'is_active']
    list_filter = ['role', 'actor_type', 'is_active']
    search_fields = ['email', 'first_name', 'last_name', 'organization']
    fieldsets = [
        (None, {'fields': ['email', 'password']}),
        ('Profile', {'fields': ['first_name', 'last_name', 'role']}),
        ('Network profile', {'fields': ['actor_type', 'organization', 'headline', 'location',
                                        'sdg_interests', 'followed_collections']}),
        ('Permissions', {'fields': ['is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions']}),
    ]
    add_fieldsets = [
        (None, {'classes': ['wide'],
                'fields': ['email', 'first_name', 'last_name', 'role', 'password1', 'password2']}),
    ]


class StageHistoryInline(admin.TabularInline):
    model = StageHistory
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'collection', 'category', 'owner', 'stage', 'total_investment',
                    'registration_date']
    list_filter = ['stage', 'collection', 'primary_sdg']
    search_fields = ['code', 'name', 'reference', 'category']
    inlines = [StageHistoryInline]
    fieldsets = [
        (None, {'fields': ['name', 'description', 'owner', 'stage', 'registration_date']}),
        ('Portfolio', {'fields': ['collection', 'category', 'sector', 'reference', 'primary_sdg']}),
        ('Costing', {'fields': ['costing_period', 'currency', 'total_investment', 'conventional_investment',
                                'digital_investment', 'ai_investment']}),
        ('Sections', {'fields': ['details'], 'classes': ['collapse']}),
    ]


class SDGIndicatorInline(admin.TabularInline):
    model = SDGIndicator
    extra = 0


@admin.register(ProjectSDG)
class ProjectSDGAdmin(admin.ModelAdmin):
    list_display = ['project', 'goal']
    inlines = [SDGIndicatorInline]


@admin.register(ReadinessScore)
class ReadinessScoreAdmin(admin.ModelAdmin):
    list_display = ['project', 'score', 'evaluation_date', 'evaluated_by']


@admin.register(StageRequest)
class StageRequestAdmin(admin.ModelAdmin):
    list_display = ['code', 'project', 'from_stage', 'to_stage', 'status', 'requested_by', 'created_at']
    list_filter = ['status']


@admin.register(RegistryEntry)
class RegistryEntryAdmin(admin.ModelAdmin):
    list_display = ['code', 'project', 'listed_date', 'investment_amount', 'status']
    list_filter = ['status']


admin.site.register(RegistryActivity)


@admin.register(PortfolioComment)
class PortfolioCommentAdmin(admin.ModelAdmin):
    list_display = ['project', 'user', 'created_at']
    search_fields = ['body', 'project__name', 'user__email']


admin.site.register(PortfolioLike)
admin.site.register(PortfolioShare)


class MembershipInline(admin.TabularInline):
    model = CommunityMembership
    extra = 0
    autocomplete_fields = ['user']


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ['name', 'pillar', 'order']
    list_filter = ['pillar']
    prepopulated_fields = {'slug': ['name']}
    inlines = [MembershipInline]


@admin.register(CommunityPost)
class CommunityPostAdmin(admin.ModelAdmin):
    list_display = ['community', 'author', 'created_at']
    list_filter = ['community']
    search_fields = ['body']


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ['code', 'service', 'requester', 'project', 'status', 'created_at']
    list_filter = ['status', 'service']
    search_fields = ['code', 'message', 'requester__email']
