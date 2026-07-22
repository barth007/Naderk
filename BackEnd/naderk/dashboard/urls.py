from django.urls import path
from . import apis

app_name = 'dashboard'

urlpatterns = [
    path('doctor/summary/', apis.DoctorSummaryAPI.as_view(), name='doctor-summary'),
    path('doctor/calendar/', apis.DoctorCalendarAPI.as_view(), name='doctor-calendar'),
    path('doctor/appointments/', apis.DoctorAppointmentsAPI.as_view(), name='doctor-appointments'),
    path('doctor/requests/', apis.DoctorRequestsAPI.as_view(), name='doctor-requests'),
    path('doctor/requests/<uuid:pk>/accept/', apis.DoctorAcceptRequestAPI.as_view(), name='doctor-requests-accept'),
    path('doctor/requests/<uuid:pk>/reject/', apis.DoctorRejectRequestAPI.as_view(), name='doctor-requests-reject'),
    path('doctor/telehealth/', apis.DoctorTelehealthAPI.as_view(), name='doctor-telehealth'),
    path('doctor/scratchpad/', apis.DoctorScratchpadAPI.as_view(), name='doctor-scratchpad'),
    path('admin/summary/', apis.AdminDashboardSummaryAPI.as_view(), name='admin-summary'),
    path('admin/appointments/requests/', apis.AdminAppointmentRequestsAPI.as_view(), name='admin-appt-requests'),
    path('admin/appointments/calendar/', apis.AdminAppointmentCalendarAPI.as_view(), name='admin-appt-calendar'),
    path('admin/appointments/<uuid:pk>/schedule/', apis.AdminScheduleAppointmentAPI.as_view(), name='admin-appt-schedule'),
    path('admin/doctors/', apis.AdminDoctorListAPI.as_view(), name='admin-doctors'),
    path('admin/inventory/summary/', apis.AdminInventorySummaryAPI.as_view(), name='admin-inventory-summary'),
    path('admin/products/create/', apis.AdminProductCreateAPI.as_view(), name='admin-product-create'),
    path('admin/products/', apis.AdminProductsAPI.as_view(), name='admin-products'),
    path('admin/products/<uuid:pk>/', apis.AdminProductDetailAPI.as_view(), name='admin-product-detail'),
    path('admin/products/<uuid:pk>/restock/', apis.AdminProductRestockAPI.as_view(), name='admin-product-restock'),
    path('admin/products/<uuid:pk>/toggle-status/', apis.AdminProductToggleStatusAPI.as_view(), name='admin-product-toggle'),
    path('admin/products/<uuid:pk>/history/', apis.AdminProductHistoryAPI.as_view(), name='admin-product-history'),
    path('admin/orders/', apis.AdminAllOrdersAPI.as_view(), name='admin-orders'),
    # Categories
    path('admin/categories/', apis.AdminCategoryListAPI.as_view(), name='admin-categories'),
    path('admin/categories/<uuid:pk>/', apis.AdminCategoryDetailAPI.as_view(), name='admin-category-detail'),
    # Flash Sales
    path('admin/flash-sales/', apis.AdminFlashSaleListAPI.as_view(), name='admin-flash-sales'),
    path('admin/flash-sales/active/', apis.AdminActiveFlashSaleAPI.as_view(), name='admin-flash-sale-active'),
    path('admin/flash-sales/<uuid:pk>/', apis.AdminFlashSaleDetailAPI.as_view(), name='admin-flash-sale-detail'),
    # Staff Management
    path('admin/staff/', apis.AdminStaffListAPI.as_view(), name='admin-staff'),
    path('admin/staff/schedule/', apis.AdminWeekScheduleAPI.as_view(), name='admin-staff-schedule'),
    path('admin/staff/<uuid:pk>/toggle/', apis.AdminStaffToggleAPI.as_view(), name='admin-staff-toggle'),
    # Departments
    path('admin/departments/', apis.AdminDepartmentListAPI.as_view(), name='admin-departments'),
    path('admin/departments/<uuid:pk>/', apis.AdminDepartmentDetailAPI.as_view(), name='admin-department-detail'),
    # Permissions
    path('admin/permissions/', apis.AdminPermissionsAPI.as_view(), name='admin-permissions'),
    # Medical Services
    path('admin/services/', apis.AdminServiceListAPI.as_view(), name='admin-services'),
    path('admin/services/<uuid:pk>/', apis.AdminServiceDetailAPI.as_view(), name='admin-service-detail'),
]
