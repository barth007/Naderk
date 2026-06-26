from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'naderk.users'

    def ready(self):
        import naderk.users.signals
