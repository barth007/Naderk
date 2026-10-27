"""
Brand details for outbound email, read from the CMS.

Emails used to take the name and logo from the BRAND_NAME / BRAND_LOGO_URL env
vars, so renaming the platform or changing the logo in the admin CMS updated the
site and the prescription PDFs but left every email on the old brand. The CMS
site settings are now the source; the env vars are only the fallback for when
nothing is configured (or the database cannot be read).
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def get_email_brand() -> dict:
    """
    Template context for the email header and footer.

    Keys: brand_name, brand_logo_url, brand_address, brand_phone, brand_email,
    brand_socials (list of {label, url}). Empty values are falsy so templates
    can skip them.
    """
    brand = {
        'brand_name': getattr(settings, 'BRAND_NAME', 'Naderkela'),
        'brand_logo_url': getattr(settings, 'BRAND_LOGO_URL', ''),
        'brand_address': '',
        'brand_phone': '',
        'brand_email': '',
        'brand_socials': [],
    }

    try:
        from naderk.cms.models import SiteSettings
        row = SiteSettings.objects.first()
    except Exception:
        logger.warning("Email brand: could not read site settings", exc_info=True)
        return brand

    if not row:
        return brand

    brand['brand_name'] = row.company_name or brand['brand_name']
    brand['brand_logo_url'] = row.logo_url or brand['brand_logo_url']
    brand['brand_address'] = row.address or ''
    brand['brand_phone'] = row.phone_primary or ''
    brand['brand_email'] = row.email_support or row.email_general or ''
    brand['brand_socials'] = [
        {'label': label, 'url': url}
        for label, url in (
            ('Facebook', row.facebook_url),
            ('Instagram', row.instagram_url),
            ('Twitter', row.twitter_url),
            ('LinkedIn', row.linkedin_url),
        )
        if url
    ]
    return brand
