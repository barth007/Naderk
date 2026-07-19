from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'naderk.common'

    def ready(self):
        # Register email admin only when the admin app is installed
        try:
            from naderk.common.email import admin as _  # noqa: F401
        except Exception:
            pass
