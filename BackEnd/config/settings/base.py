from pathlib import Path
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False)
)
environ.Env.read_env(BASE_DIR / '.env')

# Quick-start development settings - unsuitable for production
SECRET_KEY = env('SECRET_KEY', default='django-insecure-zag5^3^$t8gv$$%#cq(+msitais0*h$pz(!g9(9_(b5b%ass$l')
DEBUG = env('DEBUG', default=True)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# Application definition
INSTALLED_APPS = [
    'daphne',
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local apps
    'naderk.core',
    'naderk.common',
    'naderk.authentication',
    'naderk.users',
    'naderk.appointments',
    'naderk.telehealth',
    'naderk.laboratory',
    'naderk.ecommerce',
    'naderk.prescriptions',
    'naderk.donations',
    'naderk.notifications',
    'naderk.dashboard',
    'naderk.cms',
    'naderk.payments',
    'naderk.medical_records',
    'naderk.messaging',
    'naderk.storage',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': env.db('DATABASE_URL')
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# MinIO / S3-compatible Storage
STORAGE = {
    'ENDPOINT':        env('MINIO_ENDPOINT', default='http://localhost:9000'),
    'ACCESS_KEY':      env('MINIO_ACCESS_KEY', default='minioadmin'),
    'SECRET_KEY':      env('MINIO_SECRET_KEY', default='minioadmin123'),
    'USE_SSL':         env.bool('MINIO_USE_SSL', default=False),
    'PUBLIC_BUCKET':   env('MINIO_PUBLIC_BUCKET', default='naderk-public'),
    'PRIVATE_BUCKET':  env('MINIO_PRIVATE_BUCKET', default='naderk-private'),
    'REGION':          env('MINIO_REGION', default='us-east-1'),
    'URL_EXPIRATION':  env.int('MINIO_URL_EXPIRATION', default=300),
}

# Custom User Model
AUTH_USER_MODEL = 'core.User'

# LiveKit Configuration
LIVEKIT_URL = env('LIVEKIT_URL', default='http://localhost:7880')
LIVEKIT_API_KEY = env('LIVEKIT_API_KEY', default='devkey')
LIVEKIT_API_SECRET = env('LIVEKIT_API_SECRET', default='naderk-livekit-dev-secret-key-2024')

# Paystack
PAYSTACK_SECRET_KEY = env('PAYSTACK_SECRET_KEY', default='')
PAYSTACK_PUBLIC_KEY = env('PAYSTACK_PUBLIC_KEY', default='')
PAYSTACK_WEBHOOK_SECRET = env('PAYSTACK_WEBHOOK_SECRET', default='')

# Celery Configuration
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# DRF Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'EXCEPTION_HANDLER': 'naderk.common.handlers.exception_handler.custom_exception_handler',
}

# Simple JWT Settings
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Email Settings
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='mail.privateemail.com')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='notification@totalesg360.com')

# Email provider: postmark | smtp | resend | ses
EMAIL_PROVIDER = env('EMAIL_PROVIDER', default='smtp')

# Postmark
POSTMARK_SERVER_TOKEN    = env('POSTMARK_SERVER_TOKEN', default='')
POSTMARK_MESSAGE_STREAM  = env('POSTMARK_MESSAGE_STREAM', default='outbound')
POSTMARK_WEBHOOK_TOKEN   = env('POSTMARK_WEBHOOK_TOKEN', default='')
DEFAULT_REPLY_TO_EMAIL   = env('DEFAULT_REPLY_TO_EMAIL', default='')

# Resend
EMAIL_RESEND_API_KEY = env('EMAIL_RESEND_API_KEY', default='')

# AWS SES
AWS_SES_ACCESS_KEY_ID     = env('AWS_SES_ACCESS_KEY_ID', default='')
AWS_SES_SECRET_ACCESS_KEY = env('AWS_SES_SECRET_ACCESS_KEY', default='')
AWS_SES_REGION            = env('AWS_SES_REGION', default='us-east-1')

# Brand / frontend
BRAND_NAME      = env('BRAND_NAME', default='NaderkEye Care')
BRAND_LOGO_URL  = env('BRAND_LOGO_URL', default='')
FRONTEND_URL    = env('FRONTEND_URL', default='http://localhost:3000')

# ASGI and Channels settings
ASGI_APPLICATION = 'config.asgi.application'

# Base URL used in RFC 7807 problem type URIs — read from env so it reflects
# the actual environment (localhost in dev, real domain in production).
API_BASE_URL = env('API_BASE_URL', default='http://localhost:8000')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [env('REDIS_URL', default='redis://localhost:6379/0')],
        },
    },
}

