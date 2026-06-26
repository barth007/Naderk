"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Badge, Button } from "@/components/ui"
import { CAROUSEL_SLIDES } from "./carousel.constants"
import { cn } from "@/lib/cn"

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    zIndex: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    zIndex: 0,
  }),
}

export function HeroSection() {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const [isHovered, setIsHovered] = useState(false)

  const handleNext = useCallback(() => {
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % CAROUSEL_SLIDES.length)
  }, [])

  const handlePrev = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length)
  }, [])

  const handleDotClick = (index: number) => {
    if (index === currentIndex) return
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev()
      } else if (e.key === "ArrowRight") {
        handleNext()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleNext, handlePrev])

  // Autoplay functionality
  useEffect(() => {
    if (isHovered) return
    const timer = setInterval(() => {
      handleNext()
    }, 5500)
    return () => clearInterval(timer)
  }, [currentIndex, isHovered, handleNext])

  const currentSlide = CAROUSEL_SLIDES[currentIndex]
  const isDark = currentSlide.theme === "dark"

  return (
    <section
      className="relative w-full h-[550px] md:h-[620px] lg:h-[680px] xl:h-[720px] overflow-hidden bg-slate-50 select-none"
      aria-label="Promotional eye care campaigns"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-full h-full">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.25 },
            }}
            className="absolute inset-0 w-full h-full flex items-center"
            style={{ background: currentSlide.backgroundColor }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(e, { offset, velocity }) => {
              const swipeThreshold = 50
              if (offset.x < -swipeThreshold) {
                handleNext()
              } else if (offset.x > swipeThreshold) {
                handlePrev()
              }
            }}
          >
            <div className="relative w-full h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-16 md:pt-20 lg:pt-24 pb-8">
              
              {/* Left Column / Mobile Stack: Banner Copy */}
              <div className="relative z-10 col-span-1 lg:col-span-6 flex flex-col justify-center items-center lg:items-start text-center lg:text-left space-y-4 md:space-y-6 max-w-xl mx-auto lg:mx-0">
                
                {/* Badge and Discount Indicator */}
                <div className="flex flex-wrap gap-2.5 items-center justify-center lg:justify-start">
                  {currentSlide.badge && (
                    <Badge
                      variant="muted"
                      className={cn(
                        "h-8 rounded-full border px-4 text-xs font-bold uppercase tracking-widest backdrop-blur-md",
                        isDark
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white border-slate-200 text-[#E53E3E] shadow-sm"
                      )}
                    >
                      <span className={cn("mr-2 h-1.5 w-1.5 rounded-full animate-pulse", isDark ? "bg-white" : "bg-[#E53E3E]")} />
                      {currentSlide.badge}
                    </Badge>
                  )}
                  {currentSlide.discount && (
                    <Badge
                      className={cn(
                        "h-8 rounded-full px-4 text-xs font-bold uppercase border-0 shadow-sm",
                        isDark
                          ? "bg-white text-slate-900 hover:bg-slate-100"
                          : "bg-[#E53E3E] text-white hover:bg-[#c93636]"
                      )}
                    >
                      {currentSlide.discount}
                    </Badge>
                  )}
                </div>

                {/* Subtitle */}
                {currentSlide.subtitle && (
                  <span
                    className={cn(
                      "text-xs md:text-sm font-bold uppercase tracking-[0.2em] font-poppins",
                      isDark ? "text-slate-200" : "text-[#E53E3E]"
                    )}
                  >
                    {currentSlide.subtitle}
                  </span>
                )}

                {/* Headline */}
                <h1
                  className={cn(
                    "text-3xl md:text-5xl lg:text-[3.25rem] xl:text-[4rem] font-extrabold leading-[1.1] tracking-tight font-poppins",
                    isDark ? "text-white" : "text-slate-900"
                  )}
                >
                  {currentSlide.title}
                </h1>

                {/* Description */}
                <p
                  className={cn(
                    "text-sm md:text-base lg:text-lg leading-relaxed font-medium max-w-lg lg:max-w-none",
                    isDark ? "text-slate-200/90" : "text-slate-600"
                  )}
                >
                  {currentSlide.description}
                </p>

                {/* Call To Action Button */}
                {currentSlide.ctaText && currentSlide.ctaLink && (
                  <div className="pt-2 w-full sm:w-auto">
                    <Button
                      variant={isDark ? "outline" : "default"}
                      size="lg"
                      className={cn(
                        "w-full sm:w-auto rounded-md px-6 font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
                        isDark
                          ? "bg-white text-slate-900 border-white hover:bg-slate-100 shadow-lg"
                          : "bg-[#E53E3E] text-white hover:bg-[#c93636]"
                      )}
                      onClick={() => router.push(currentSlide.ctaLink!)}
                    >
                      {currentSlide.ctaText}
                    </Button>
                  </div>
                )}
              </div>

              {/* Right Column / Mobile Background Image */}
              <div className="absolute inset-0 lg:static lg:col-span-6 h-full w-full select-none pointer-events-none z-0">
                {/* Mobile: Dimmed background watermark to guarantee readability */}
                <div className="absolute inset-0 lg:hidden opacity-[0.18]">
                  <Image
                    src={currentSlide.mobileImage || currentSlide.image}
                    alt={currentSlide.title}
                    fill
                    priority={currentIndex === 0}
                    sizes="100vw"
                    className="object-cover object-center"
                  />
                </div>

                {/* Desktop: Crisp product campaign graphic */}
                <div className="hidden lg:block relative w-full h-[400px] xl:h-[480px]">
                  <Image
                    src={currentSlide.image}
                    alt={currentSlide.title}
                    fill
                    priority={currentIndex === 0}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-contain drop-shadow-2xl hover:scale-[1.01] transition-transform duration-500"
                  />
                </div>
              </div>

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Arrows: Glassmorphic, shown only on desktop hover */}
      <button
        onClick={handlePrev}
        className={cn(
          "absolute left-6 top-1/2 -translate-y-1/2 z-20 hidden lg:flex items-center justify-center w-12 h-12 rounded-full",
          "bg-white/30 backdrop-blur-md border border-white/20 shadow-lg text-slate-800 hover:bg-white/50 transition-all duration-300",
          "opacity-0 pointer-events-none",
          isHovered && "opacity-100 pointer-events-auto"
        )}
        aria-label="Previous slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={handleNext}
        className={cn(
          "absolute right-6 top-1/2 -translate-y-1/2 z-20 hidden lg:flex items-center justify-center w-12 h-12 rounded-full",
          "bg-white/30 backdrop-blur-md border border-white/20 shadow-lg text-slate-800 hover:bg-white/50 transition-all duration-300",
          "opacity-0 pointer-events-none",
          isHovered && "opacity-100 pointer-events-auto"
        )}
        aria-label="Next slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Bottom Page Indicator Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2.5 items-center">
        {CAROUSEL_SLIDES.map((slide, index) => {
          const isActive = index === currentIndex
          return (
            <button
              key={slide.id}
              onClick={() => handleDotClick(index)}
              className={cn(
                "h-2.5 rounded-full transition-all duration-300 cursor-pointer border-0 outline-none",
                isActive ? "w-8 bg-[#E53E3E]" : "w-2.5 bg-slate-400/60 hover:bg-slate-500"
              )}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={isActive ? "true" : "false"}
            />
          )
        })}
      </div>
    </section>
  )
}

