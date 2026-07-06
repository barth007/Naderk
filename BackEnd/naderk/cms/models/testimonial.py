from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Testimonial(models.Model):
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=150)
    company = models.CharField(max_length=150, blank=True)
    location = models.CharField(max_length=150, blank=True)
    quote = models.TextField()
    rating = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    image_url = models.URLField(max_length=1000, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.name} — {self.role}"
