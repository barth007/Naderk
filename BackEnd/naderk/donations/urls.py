from django.urls import path

from . import apis

urlpatterns = [
    path('', apis.DonationCreateApi.as_view(), name='donation-create'),
    path('verify/', apis.DonationVerifyApi.as_view(), name='donation-verify'),
    path('volunteers/', apis.VolunteerApplyApi.as_view(), name='volunteer-apply'),
    path('admin/donations/', apis.AdminDonationListApi.as_view(), name='admin-donations'),
    path('admin/volunteers/', apis.AdminVolunteerListApi.as_view(), name='admin-volunteers'),
    path('admin/volunteers/<uuid:pk>/', apis.AdminVolunteerDetailApi.as_view(), name='admin-volunteer-detail'),
]
