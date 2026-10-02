from .base import *  # noqa: F403

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
# A reachable-looking secure URL: the join endpoint refuses localhost and ws://
# whenever DEBUG is off, and the test runner always turns DEBUG off.
LIVEKIT_URL = 'https://livekit.naderk.test'
LIVEKIT_API_KEY = 'testkey'
LIVEKIT_API_SECRET = 'test-secret-that-is-long-enough-for-hs256'
