from .base import *  # noqa: F403

# Matches config.settings.local, which the suite ran under before pytest: a few
# views only refuse a localhost/insecure LiveKit URL when DEBUG is off, and the
# tests that cover that switch it off themselves with override_settings.
DEBUG = True

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
EMAIL_PROVIDER = 'smtp'
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

# No Redis needed: tasks run inline and channel groups stay in process.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}

# Never talk to a real provider, whatever a developer's .env holds.
DISABLE_OTP_VERIFICATION = False
PAYSTACK_SECRET_KEY = 'sk_test_dummy'
PAYSTACK_PUBLIC_KEY = 'pk_test_dummy'
PAYSTACK_WEBHOOK_SECRET = ''
LIVEKIT_URL = 'http://localhost:7880'
LIVEKIT_API_KEY = 'testkey'
LIVEKIT_API_SECRET = 'test-secret-that-is-long-enough-for-hs256'
