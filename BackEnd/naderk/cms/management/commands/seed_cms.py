from django.core.management.base import BaseCommand
from naderk.cms.models import HeroSlide, Testimonial, TeamMember, FAQ, TrustMetric, TrustedClient, SiteSettings


class Command(BaseCommand):
    help = 'Seed CMS tables from the hardcoded constants that were previously in the frontend'

    def handle(self, *args, **options):
        self._seed_hero_slides()
        self._seed_testimonials()
        self._seed_team_members()
        self._seed_faqs()
        self._seed_trust_metrics()
        self._seed_trusted_clients()
        self._seed_site_settings()
        self.stdout.write(self.style.SUCCESS('CMS seed complete.'))

    def _seed_hero_slides(self):
        if HeroSlide.objects.exists():
            self.stdout.write('  Hero slides already seeded — skipping')
            return
        slides = [
            dict(badge_text='NEW ARRIVALS', title='Designer Eyewear Collection', subtitle='EXCLUSIVE OFFERS',
                 description='Discover our premium frames and designer styles. Get up to 40% OFF and a free comprehensive vision test with every purchase.',
                 image_url='/images/premium_eyewear_banner.png',
                 cta_primary_text='Shop the Collection', cta_primary_link='/services/optical-store',
                 discount_text='40% OFF', theme='LIGHT', order=1),
            dict(badge_text='ONLINE CARE', title='Virtual Eye Consultations', subtitle='CLINICAL SUPPORT 24/7',
                 description='Speak with certified ophthalmologists and opticians from the comfort of your home. Video consultations start at just $29.',
                 image_url='/images/telehealth_banner.png',
                 cta_primary_text='Book Consultation', cta_primary_link='/services/telehealth',
                 discount_text='FROM $29', theme='LIGHT', order=2),
            dict(badge_text='FAMILY SPECIAL', title='Back to School Screenings', subtitle='PEDIATRIC EYE HEALTH',
                 description='Prepare your children for classroom success. Make sure they see the board clearly with our custom kids\' screening packages.',
                 image_url='/images/pediatric_screening_banner.png',
                 cta_primary_text='Schedule Screening', cta_primary_link='/coming-soon',
                 discount_text='SAVE $50', theme='LIGHT', order=3),
            dict(badge_text='CLINICAL LEADERSHIP', title='Retinal Screening & Imaging', subtitle='PREVENTATIVE EYE HEALTH',
                 description='Early detection saves sight. Get high-definition retinal analysis for glaucoma, diabetic retinopathy, and macular health.',
                 image_url='/images/eye-care-exam.png',
                 cta_primary_text='Book Diagnostics', cta_primary_link='/services/laboratory',
                 discount_text='HIPAA SECURE', theme='LIGHT', order=4),
        ]
        for s in slides:
            HeroSlide.objects.create(**s)
        self.stdout.write(f'  Created {len(slides)} hero slides')

    def _seed_testimonials(self):
        if Testimonial.objects.exists():
            self.stdout.write('  Testimonials already seeded — skipping')
            return
        items = [
            dict(name='Sarah Johnson', role='Patient', location='Abuja',
                 quote='The doctors at NaderkEye completely transformed my experience. The care was exceptional, and my vision has never been clearer.',
                 rating=5, order=1),
            dict(name='Michael Chen', role='Executive', location='Lagos',
                 quote='I use their custom prescription glasses daily. The precision is unmatched, and I can truly focus on my work without strain.',
                 rating=5, order=2),
            dict(name='Emily Rodriguez', role='Teacher', location='Port Harcourt',
                 quote='From the telehealth consultation to the final checkup, every step was handled with incredible professionalism.',
                 rating=4, order=3),
            dict(name='Robert Davis', role='Designer', location='Kano',
                 quote='I found the perfect frames thanks to their precision-led technology. The team was patient and the quality is outstanding.',
                 rating=5, order=4),
            dict(name='David Kim', role='Software Engineer', location='Enugu',
                 quote='State-of-the-art facilities and a reassuring team. They walked me through every step of my laser eye surgery procedure.',
                 rating=5, order=5),
            dict(name='Linda Okafor', role='Entrepreneur', location='Abuja',
                 quote='NaderkEye is a real gem! I started using their services a few months ago and it completely changed the way I experience eye care.',
                 rating=5, order=6),
        ]
        for t in items:
            Testimonial.objects.create(**t)
        self.stdout.write(f'  Created {len(items)} testimonials')

    def _seed_team_members(self):
        if TeamMember.objects.exists():
            self.stdout.write('  Team members already seeded — skipping')
            return
        members = [
            dict(name='Olivia Rhye', role='Founder & CEO',
                 bio='Former co-founder of Opendoor. Early staff at Spotify and Clearbit.',
                 image_url='/assets/image 44.png', order=1),
            dict(name='Phoenix Baker', role='Engineering Manager',
                 bio='Lead engineering teams at Figma, Pitch, and Protocol Labs.',
                 image_url='/images/image 11.png', order=2),
            dict(name='Lana Steiner', role='Product Manager',
                 bio='Former PM for Linear, Lambda School, and On Deck.',
                 image_url='/assets/image 45.png', order=3),
            dict(name='Demi Wilkinson', role='Frontend Developer',
                 bio='Former frontend dev for Linear, Coinbase, and Postscript.',
                 image_url='/assets/image 5.png', order=4),
            dict(name='Candice Wu', role='Backend Developer',
                 bio='Lead backend dev at Clearbit. Former Clearbit and Loom.',
                 image_url='/images/image 13.png', order=5),
            dict(name='Natali Craig', role='Product Designer',
                 bio='Founding design team at Figma. Former Pleo, Stripe, and Tile.',
                 image_url='/images/image 11.png', order=6),
        ]
        for m in members:
            TeamMember.objects.create(**m)
        self.stdout.write(f'  Created {len(members)} team members')

    def _seed_faqs(self):
        if FAQ.objects.exists():
            self.stdout.write('  FAQs already seeded — skipping')
            return
        faqs = [
            dict(question='Is there a free trial available?',
                 answer='Yes, you can try us for free for 30 days. If you want, we\'ll provide you with a free, personalized 30-minute onboarding call to get you up and running as soon as possible.',
                 order=1),
            dict(question='Can I change my plan later?',
                 answer='Absolutely. You can upgrade or downgrade your plan at any time from your account settings. The changes will be prorated automatically.',
                 order=2),
            dict(question='What is your cancellation policy?',
                 answer='You can cancel your subscription at any time. Your access will remain active until the end of your current billing period.',
                 order=3),
            dict(question='Can other info be added to an invoice?',
                 answer='Yes, you can add custom information such as your company name, VAT number, or alternate billing address directly in your billing settings.',
                 order=4),
            dict(question='How does billing work?',
                 answer='We offer both monthly and annual billing options. You will be charged automatically at the beginning of each billing cycle using your default payment method.',
                 order=5),
            dict(question='How do I change my account email?',
                 answer='You can change the email address associated with your account by navigating to the Profile section of your account settings and verifying your new email.',
                 order=6),
        ]
        for f in faqs:
            FAQ.objects.create(**f)
        self.stdout.write(f'  Created {len(faqs)} FAQs')

    def _seed_trust_metrics(self):
        if TrustMetric.objects.exists():
            self.stdout.write('  Trust metrics already seeded — skipping')
            return
        metrics = [
            dict(label='Active Patients', value='10K+', order=1),
            dict(label='Specialist Doctors', value='150+', order=2),
            dict(label='Consultations', value='50K+', order=3),
            dict(label='Availability', value='24/7', order=4),
        ]
        for m in metrics:
            TrustMetric.objects.create(**m)
        self.stdout.write(f'  Created {len(metrics)} trust metrics')

    def _seed_trusted_clients(self):
        if TrustedClient.objects.exists():
            self.stdout.write('  Trusted clients already seeded — skipping')
            return
        clients = [
            dict(name='Microsoft', logo_url='https://cdn.simpleicons.org/microsoft', order=1),
            dict(name='Google', logo_url='https://cdn.simpleicons.org/google', order=2),
            dict(name='Meta', logo_url='https://cdn.simpleicons.org/meta', order=3),
            dict(name='Apple', logo_url='https://cdn.simpleicons.org/apple', order=4),
            dict(name='Amazon', logo_url='https://cdn.simpleicons.org/amazon', order=5),
            dict(name='Netflix', logo_url='https://cdn.simpleicons.org/netflix', order=6),
            dict(name='Stripe', logo_url='https://cdn.simpleicons.org/stripe', order=7),
            dict(name='Vercel', logo_url='https://cdn.simpleicons.org/vercel', order=8),
            dict(name='Notion', logo_url='https://cdn.simpleicons.org/notion', order=9),
            dict(name='OpenAI', logo_url='https://cdn.simpleicons.org/openai', order=10),
            dict(name='X', logo_url='https://cdn.simpleicons.org/x', order=11),
            dict(name='Framer', logo_url='https://cdn.simpleicons.org/framer', order=12),
        ]
        for c in clients:
            TrustedClient.objects.create(**c)
        self.stdout.write(f'  Created {len(clients)} trusted clients')

    def _seed_site_settings(self):
        if SiteSettings.objects.exists():
            self.stdout.write('  Site settings already seeded — skipping')
            return
        SiteSettings.objects.create(
            company_name='NaderkEye Care',
            logo_url='',
            phone_primary='+234 81234567890',
            phone_secondary='+234 81234567891',
            email_support='info@naderkeye.com',
            email_general='appointments@eyecare.com',
            address='150 street suite 400, Medical district, Abuja',
            hours_weekday='Monday - Friday: 8:00AM - 6:00PM',
            hours_saturday='Saturday: 9:00AM - 2:00PM',
            hours_sunday='Sunday: Closed',
        )
        self.stdout.write('  Created site settings')
