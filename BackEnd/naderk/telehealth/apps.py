from django.apps import AppConfig

class TelehealthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'naderk.telehealth'

    def ready(self):
        import naderk.telehealth.signals

