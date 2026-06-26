import urllib.request
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone
from naderk.cms.models import BlogCategory, BlogPost
from naderk.core.models import User

class Command(BaseCommand):
    help = 'Seed the database with initial healthcare blog categories and posts'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Starting blog seeding process..."))

        # Create Categories
        categories = [
            {"name": "Eye Care", "description": "Tips and advice for maintaining healthy eyes."},
            {"name": "Diagnostics", "description": "Understanding eye tests and diagnoses."},
            {"name": "Telehealth", "description": "Virtual healthcare guides."},
            {"name": "Wellness", "description": "General health and wellness."},
            {"name": "Nutrition", "description": "Diet and nutrition for vision."},
            {"name": "Preventive Care", "description": "How to prevent eye diseases."},
            {"name": "Child Vision Care", "description": "Eye health for kids and teens."}
        ]

        category_objs = []
        for cat_data in categories:
            cat, created = BlogCategory.objects.get_or_create(
                name=cat_data["name"],
                defaults={"description": cat_data["description"]}
            )
            category_objs.append(cat)
        
        self.stdout.write(self.style.SUCCESS(f"Created/Verified {len(category_objs)} categories."))

        # Get or Create a dummy author
        author, _ = User.objects.get_or_create(
            email="doctor@naderkeye.com",
            defaults={
                "first_name": "Dr. Sarah",
                "last_name": "Naderk",
                "is_staff": True,
                "is_superuser": True
            }
        )
        if not author.password:
            author.set_password("password123")
            author.save()

        # Create Blog Posts
        blogs_data = [
            {
                "title": "5 Ways to Reduce Digital Eye Strain",
                "category": "Eye Care",
                "excerpt": "Learn how the 20-20-20 rule and screen adjustments can save your eyes from fatigue.",
                "content": "Digital eye strain is a modern epidemic. As we spend more time staring at screens, our eyes suffer from reduced blinking and harsh blue light. \n\nTo combat this, start by implementing the 20-20-20 rule: every 20 minutes, look at something 20 feet away for at least 20 seconds. Also, ensure your screen is at eye level and consider using anti-reflective coating on your glasses.",
                "image": "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&q=80",
                "is_featured": True
            },
            {
                "title": "Understanding Cataracts: Early Signs and Treatments",
                "category": "Preventive Care",
                "excerpt": "Cataracts are common as we age. Discover the early symptoms and when it's time to consider surgery.",
                "content": "A cataract is a clouding of the normally clear lens of the eye. For people who have cataracts, seeing through cloudy lenses is a bit like looking through a frosty or fogged-up window. \n\nEarly signs include blurred vision, increasing difficulty with vision at night, sensitivity to light and glare, and seeing 'halos' around lights. Fortunately, cataract surgery is generally safe and highly effective.",
                "image": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80",
                "is_featured": False
            },
            {
                "title": "Nutrition for Better Vision: Foods You Should Eat",
                "category": "Nutrition",
                "excerpt": "Carrots aren't the only food good for your eyes. Discover the top nutrients for optimal eye health.",
                "content": "A healthy diet is crucial for eye health. Nutrients like omega-3 fatty acids, lutein, zinc, and vitamins C and E might help ward off age-related vision problems like macular degeneration and cataracts.\n\nFill your plate with green leafy vegetables like spinach and kale, salmon and other oily fish, eggs, nuts, beans, and other nonmeat protein sources.",
                "image": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80",
                "is_featured": True
            },
            {
                "title": "When Should Your Child Have Their First Eye Exam?",
                "category": "Child Vision Care",
                "excerpt": "Early detection is key for children's eye health. Learn the recommended schedule for pediatric eye exams.",
                "content": "According to the American Optometric Association, infants should have their first comprehensive eye exam at 6 months of age. \n\nThey should have additional eye exams at age 3, and just before they enter kindergarten or the first grade at about age 5 or 6. For school-aged children, an eye exam every two years is recommended if no vision correction is required.",
                "image": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&q=80",
                "is_featured": False
            },
            {
                "title": "Glaucoma: The Silent Thief of Sight",
                "category": "Diagnostics",
                "excerpt": "Glaucoma often presents no early symptoms. Learn why regular screening is critical to preserving your vision.",
                "content": "Glaucoma is a group of eye conditions that damage the optic nerve. It is often associated with high pressure in your eye. \n\nIt's called the 'silent thief of sight' because there are typically no early warning signs. You may not notice a change in vision until the disease is at an advanced stage. Regular eye exams that include measurements of your eye pressure can help detect glaucoma in its early stages.",
                "image": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80",
                "is_featured": False
            },
            {
                "title": "Telehealth: The Future of Eye Care Appointments",
                "category": "Telehealth",
                "excerpt": "Discover how virtual consultations are revolutionizing access to specialized eye care from home.",
                "content": "Telehealth is changing how we access healthcare, and eye care is no exception. Virtual consultations allow for quick follow-ups, initial screenings, and expert advice without the need to travel. \n\nWhile a comprehensive exam still requires an in-person visit, telehealth is an incredible tool for triage, managing chronic conditions like dry eye, and refilling prescriptions.",
                "image": "https://images.unsplash.com/photo-1583324113626-70df0f4deaab?auto=format&fit=crop&q=80",
                "is_featured": False
            },
            {
                "title": "The Proper Way to Care for Contact Lenses",
                "category": "Eye Care",
                "excerpt": "Prevent infections and extend the life of your lenses with these essential contact lens hygiene tips.",
                "content": "Proper contact lens hygiene is essential to prevent painful eye infections. Always wash and dry your hands before handling your lenses. \n\nNever use tap water or saliva to rinse your lenses; only use the prescribed contact lens solution. Additionally, adhere strictly to the replacement schedule provided by your eye care professional.",
                "image": "https://images.unsplash.com/photo-1582570077858-f7556de6522c?auto=format&fit=crop&q=80",
                "is_featured": False
            },
            {
                "title": "Diabetes and Your Eyes: What You Need to Know",
                "category": "Preventive Care",
                "excerpt": "Diabetic retinopathy is a serious complication. Learn how managing your blood sugar protects your vision.",
                "content": "If you have diabetes, you have an increased risk of developing diabetic retinopathy, a condition that damages the blood vessels in the retina. \n\nManaging your blood sugar, blood pressure, and cholesterol is crucial. Annual dilated eye exams are essential because they can detect retinopathy before vision loss occurs. Early treatment can often prevent severe vision loss.",
                "image": "https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&q=80",
                "is_featured": True
            },
            {
                "title": "How UV Rays Affect Your Vision Over Time",
                "category": "Wellness",
                "excerpt": "Sunglasses aren't just a fashion statement. Understand the long-term impact of UV exposure on eye health.",
                "content": "Prolonged exposure to the sun's ultraviolet (UV) rays can modify eye structures. Over time, UV exposure can lead to cataracts, macular degeneration, and even pterygium (a growth on the eye surface). \n\nProtect your eyes by wearing sunglasses that block 99% to 100% of both UVA and UVB radiation, even on cloudy days. A wide-brimmed hat offers additional protection.",
                "image": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80",
                "is_featured": False
            },
            {
                "title": "The Link Between Sleep and Eye Health",
                "category": "Wellness",
                "excerpt": "Lack of sleep can cause more than dark circles. Explore the restorative power of rest for your eyes.",
                "content": "Just like the rest of your body, your eyes need rest to heal and recover from the day's stress. Lack of sleep can lead to dry eyes, eye spasms (myokymia), and popped blood vessels. \n\nAim for 7 to 8 hours of quality sleep per night. If you experience persistent dry eyes despite adequate sleep, consult an eye care professional.",
                "image": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&q=80",
                "is_featured": False
            }
        ]

        count = 0
        try:
            import cloudinary.uploader
            cloudinary_configured = True
        except Exception:
            cloudinary_configured = False

        for data in blogs_data:
            cat = next((c for c in category_objs if c.name == data["category"]), None)
            
            # Check if blog exists to avoid duplicate downloads
            if BlogPost.objects.filter(title=data["title"]).exists():
                continue
                
            blog = BlogPost(
                title=data["title"],
                category=cat,
                author=author,
                excerpt=data["excerpt"],
                content=data["content"],
                status=BlogPost.StatusChoices.PUBLISHED,
                published_at=timezone.now(),
                is_featured=data["is_featured"],
                meta_title=data["title"],
                meta_description=data["excerpt"],
            )
            
            # Upload to Cloudinary if configured, otherwise use raw Unsplash URL
            if cloudinary_configured and data.get("image"):
                try:
                    upload_data = cloudinary.uploader.upload(data["image"], folder="blogs")
                    blog.image_url = upload_data.get("secure_url")
                    blog.image_public_id = upload_data.get("public_id")
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Cloudinary upload failed (using fallback URL): {e}"))
                    blog.image_url = data["image"]
            else:
                blog.image_url = data.get("image", "")
                
            blog.save()
            count += 1
                
        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {count} new blog posts."))
