from django.db import models


class EmailStatus(models.TextChoices):
    QUEUED     = 'queued',     'Queued'
    SENT       = 'sent',       'Sent'
    DELIVERED  = 'delivered',  'Delivered'
    OPENED     = 'opened',     'Opened'
    CLICKED    = 'clicked',    'Clicked'
    BOUNCED    = 'bounced',    'Bounced'
    COMPLAINED = 'complained', 'Spam Complaint'
    FAILED     = 'failed',     'Failed'


class EmailEventType(models.TextChoices):
    QUEUED     = 'queued',     'Queued'
    SENT       = 'sent',       'Sent'
    DELIVERED  = 'delivered',  'Delivered'
    OPENED     = 'opened',     'Opened'
    CLICKED    = 'clicked',    'Clicked'
    BOUNCED    = 'bounced',    'Bounced'
    COMPLAINED = 'complained', 'Spam Complaint'
    FAILED     = 'failed',     'Failed'


class BounceType(models.TextChoices):
    HARD      = 'hard',      'Hard Bounce'
    SOFT      = 'soft',      'Soft Bounce'
    TRANSIENT = 'transient', 'Transient'
    UNKNOWN   = 'unknown',   'Unknown'
