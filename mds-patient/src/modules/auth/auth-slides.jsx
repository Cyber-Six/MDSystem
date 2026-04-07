import { useState, useEffect } from 'react';
import { Shield, FileText, Lock, Zap } from 'lucide-react';

const AuthSlides = ({ isPanelOpen, activeView }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [slideProgress, setSlideProgress] = useState(0);

  // Slider data
  const slides = [
    {
      id: 1,
      icon: Shield,
      headline: "Welcome to MDS Healthcare",
      description: "Comprehensive healthcare management platform designed for modern medical institutions.",
      color: "primary"
    },
    {
      id: 2,
      icon: FileText,
      headline: "Centralized Medical Records",
      description: "Organized, secure, and accessible patient records at your fingertips.",
      color: "accent"
    },
    {
      id: 3,
      icon: Lock,
      headline: "Enterprise-Grade Security",
      description: "Your data is protected with advanced encryption and role-based access control.",
      color: "success"
    },
    {
      id: 4,
      icon: Zap,
      headline: "Fast & Accessible Anywhere",
      description: "High-performance system accessible from any device, anytime, anywhere.",
      color: "warning"
    }
  ];

  // Auto-slide effect with progress
  useEffect(() => {
    if (isHovered) return;

    const progressInterval = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + (100 / 55); // Update every 100ms for 5500ms total
      });
    }, 100);

    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
      setSlideProgress(0);
    }, 5500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(slideInterval);
    };
  }, [isHovered, slides.length]);

  // Reset progress when slide changes manually
  useEffect(() => {
    setSlideProgress(0);
  }, [currentSlide]);

  // Touch swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (isRightSwipe) {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeView === 'register' || isPanelOpen) return;
      
      if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
      } else if (e.key === 'ArrowRight') {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, isPanelOpen, slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const getIconColor = (color) => {
    const colors = {
      primary: 'text-primary-400',
      accent: 'text-accent-400',
      success: 'text-success-400',
      warning: 'text-warning-400'
    };
    return colors[color] || 'text-primary-400';
  };

  return (
    <div 
      className={`fixed top-0 left-0 w-full h-screen z-[1] transition-all duration-300 bg-white dark:bg-slate-900 ${activeView === 'register' ? 'blur-sm' : ''}`}
    >
      <div 
        className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
      >
        <div 
          className="absolute top-0 left-0 w-full h-full opacity-30 dark:opacity-20"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.2) 0%, transparent 50%)'
          }}
        />
        {/* Hero Slider */}
        <div 
          className="h-full flex items-center justify-center px-6 sm:px-8 lg:px-12 py-8"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-full max-w-5xl">
            {/* Desktop & Tablet Layout */}
            <div className="hidden md:block">
              <div className="relative overflow-hidden">
                {/* Slides Wrapper */}
                <div 
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {slides.map((slide) => {
                    const Icon = slide.icon;
                    return (
                      <div 
                        key={slide.id}
                        className="min-w-full flex items-center gap-8 lg:gap-12"
                      >
                        {/* Text Content - Left Side */}
                        <div className="flex-1 space-y-4">
                          <h2 className={`font-heading font-bold text-secondary-900 dark:text-white transition-all duration-300 animate-slide-in-left ${
                            isPanelOpen 
                              ? 'text-2xl lg:text-3xl' 
                              : 'text-3xl lg:text-4xl'
                          }`}>
                            {slide.headline}
                          </h2>
                          <p className={`text-secondary-700 dark:text-neutral-300 leading-relaxed transition-all duration-300 animate-fade-in-up ${
                            isPanelOpen 
                              ? 'text-sm lg:text-base' 
                              : 'text-base lg:text-lg'
                          }`}>
                            {slide.description}
                          </p>
                        </div>

                        {/* Icon/Visual - Right Side (Hidden when login panel open on smaller screens) */}
                        <div className={`transition-all duration-300 ${
                          isPanelOpen ? 'hidden xl:flex' : 'flex'
                        } items-center justify-center flex-shrink-0`}>
                          <div className={`bg-white/5 dark:bg-white/5 backdrop-blur-sm border border-neutral-300 dark:border-white/10 rounded-3xl p-8 lg:p-12 transition-all duration-300 animate-scale-in ${
                            isPanelOpen ? 'w-32 h-32 lg:w-40 lg:h-40' : 'w-48 h-48 lg:w-56 lg:h-56'
                          }`}>
                            <Icon className={`w-full h-full ${getIconColor(slide.color)} transition-all duration-300`} strokeWidth={1.5} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden">
              <div className="relative overflow-hidden">
                <div 
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {slides.map((slide) => {
                    const Icon = slide.icon;
                    return (
                      <div 
                        key={slide.id}
                        className="min-w-full flex flex-col items-center text-center space-y-6"
                      >
                        {/* Icon at Top */}
                        <div className="bg-neutral-100 dark:bg-white/5 backdrop-blur-sm border border-neutral-300 dark:border-white/10 rounded-2xl p-8 w-32 h-32 animate-scale-in">
                          <Icon className={`w-full h-full ${getIconColor(slide.color)}`} strokeWidth={1.5} />
                        </div>

                        {/* Text Content */}
                        <div className="space-y-3">
                          <h2 className="font-heading font-bold text-secondary-900 dark:text-white text-xl sm:text-2xl animate-fade-in-up">
                            {slide.headline}
                          </h2>
                          <p className="text-secondary-700 dark:text-neutral-300 leading-relaxed text-sm animate-fade-in-up">
                            {slide.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Dot Navigation with Progress */}
            <div className="flex flex-col items-center gap-4 mt-8 lg:mt-12">
              <div className="flex items-center justify-center gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    className="relative group"
                  >
                    <div className={`transition-all duration-300 rounded-full ${
                      currentSlide === index 
                        ? 'bg-primary-500 w-8 h-2' 
                        : 'bg-neutral-400/60 dark:bg-white/30 hover:bg-neutral-500/70 dark:hover:bg-white/50 w-2 h-2'
                    }`} />
                    {currentSlide === index && (
                      <div 
                        className="absolute top-0 left-0 h-full bg-primary-300 rounded-full transition-all duration-100"
                        style={{ width: `${(slideProgress / 100) * 32}px` }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="text-neutral-500 dark:text-neutral-400 text-xs">
                {currentSlide + 1} / {slides.length}
              </div>
            </div>
          </div>

          {/* Touch Swipe Indicator (Mobile Only) */}
          <div className="md:hidden absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span>Swipe to navigate</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthSlides;
