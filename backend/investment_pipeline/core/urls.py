from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import network_views, views

router = DefaultRouter()
router.register('projects', views.ProjectViewSet, basename='project')
router.register('stage-requests', views.StageRequestViewSet, basename='stage-request')
router.register('registry', views.RegistryViewSet, basename='registry')
# Investment network
router.register('portfolios', network_views.PortfolioViewSet, basename='portfolio')
router.register('communities', network_views.CommunityViewSet, basename='community')
router.register('service-requests', network_views.ServiceRequestViewSet, basename='service-request')

urlpatterns = [
    path('health/', views.HealthView.as_view()),
    path('auth/login/', views.LoginView.as_view()),
    path('auth/logout/', views.LogoutView.as_view()),
    path('auth/me/', views.MeView.as_view()),
    path('auth/register/', network_views.RegisterView.as_view()),
    path('sdg-goals/', views.SDGGoalsView.as_view()),
    path('sdg-dashboard/', views.SDGDashboardView.as_view()),
    path('browse/', views.BrowseView.as_view()),
    path('dashboard/user/', views.UserDashboardView.as_view()),
    path('dashboard/admin/', views.AdminDashboardView.as_view()),
    path('dashboard/summary/', views.SummaryView.as_view()),
    path('dashboard/summary/export/', views.SummaryExportView.as_view()),
    # Investment network
    path('reference/', network_views.ReferenceView.as_view()),
    path('network/overview/', network_views.NetworkOverviewView.as_view()),
    path('network/feed/', network_views.FeedView.as_view()),
    path('network/dashboard/', network_views.NetworkDashboardView.as_view()),
    path('members/', network_views.MembersView.as_view()),
    path('recommendations/', network_views.RecommendationsView.as_view()),
    path('comments/<int:pk>/', network_views.CommentDeleteView.as_view()),
    path('posts/<int:pk>/', network_views.PostDeleteView.as_view()),
    path('', include(router.urls)),
]
