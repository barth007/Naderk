from django.apps import AppConfig


class StorageConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'naderk.storage'

    def ready(self):
        from . import checks  # noqa: F401  registers deploy-time storage checks
