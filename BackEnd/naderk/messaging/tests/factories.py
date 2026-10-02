"""Small builders for messaging data, shared by the pytest-style tests."""
from naderk.messaging.models import MessagingCategory
from naderk.messaging.services import create_conversation


def conversation(patient, message='Hello, I have a question.', category=MessagingCategory.APPOINTMENT,
                 subject='Question', **extra):
    return create_conversation(
        patient=patient, category=category, subject=subject, initial_message=message, **extra,
    )
