"""
Create an admin account, or reset an existing one's password.

`seed_admin.py` only set the password inside `if created:`, so re-running it
against an existing account silently did nothing — leaving you locked out with
no way to recover short of a shell. This is idempotent: it always leaves the
account usable with the password you supplied.

Also sets the fields the dashboard requires. A user without
profile_completion_status='COMPLETED' is bounced to /onboarding on every login,
which looks like the credentials were rejected.
"""
import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

User = get_user_model()


class Command(BaseCommand):
    help = "Create or reset an admin account (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument('--email', default='admin@naderk.com')
        parser.add_argument('--password', default=None,
                            help='Omit to be prompted (avoids the password landing in shell history).')
        parser.add_argument('--role', default='ADMIN', choices=['ADMIN', 'SUPER_ADMIN'])
        parser.add_argument('--list', action='store_true',
                            help='List existing admin accounts in this database and exit.')

    def handle(self, *args, **opts):
        # Which database is this actually touching? With more than one Postgres
        # on the host, knowing this is half the battle.
        db = connection.settings_dict
        self.stdout.write(
            f"Database: {db.get('NAME')} on {db.get('HOST')}:{db.get('PORT')}\n"
        )

        if opts['list']:
            admins = User.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN']).order_by('email')
            if not admins:
                self.stdout.write(self.style.WARNING('No admin accounts in this database.'))
                return
            self.stdout.write(f'{admins.count()} admin account(s):')
            for u in admins:
                usable = u.has_usable_password()
                self.stdout.write(
                    f"  {u.email:<34} role={u.role:<12} active={u.is_active} "
                    f"password={'set' if usable else 'UNUSABLE'} "
                    f"profile={u.profile_completion_status}"
                )
            return

        email = opts['email'].strip().lower()
        password = opts['password']
        if not password:
            password = getpass.getpass('New password: ')
            if password != getpass.getpass('Confirm: '):
                raise CommandError('Passwords did not match.')
        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters.')

        user, created = User.objects.get_or_create(
            email=email,
            defaults={'first_name': 'Clinic', 'last_name': 'Admin'},
        )

        # Applied on both paths — this is the bit seed_admin.py skipped for
        # existing users, which is how an account became unrecoverable.
        user.set_password(password)
        user.role = opts['role']
        user.is_verified = True
        user.otp_verified = True
        user.profile_completion_status = 'COMPLETED'
        user.is_active = True
        user.is_staff = True
        user.save()

        verb = 'Created' if created else 'Reset password for existing'
        self.stdout.write(self.style.SUCCESS(f'{verb} admin: {email} (role={opts["role"]})'))
        if not created:
            self.stdout.write('  All other fields were normalised so the account can log in.')
