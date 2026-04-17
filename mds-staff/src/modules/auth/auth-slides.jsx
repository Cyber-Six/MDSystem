import { useState, useEffect } from 'react';
import { Shield, FileText, Lock, Zap } from 'lucide-react';

const AuthSlides = ({ isPanelOpen, activeView }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [slideProgress, setSlideProgress] = useState(0);

  const slides = [
    {
      id: 1, icon: Shield, color: 'primary',
      headline: 'Welcome to MDS Healthcare',
      description: 'Comprehensive healthcare management platform designed for modern medical institutions.',
    },
    {
      id: 2, icon: FileText, color: 'accent',
      headline: 'Centralized Medical Records',
      description: 'Organized, secure, and accessible patient records at your fingertips.',
    },
    {
      id: 3, icon: Lock, color: 'success',
      headline: 'Enterprise-Grade Security',
      description: 'Your data is protected with advanced encryption and role-based access control.',
    },
    {
      id: 4, icon: Zap, color: 'warning',
      headline: 'Fast & Accessible Anywhere',
      description: 'High-performance system accessible from any device, anytime, anywhere.',
    },
  ];

  // Auto-slide with progress
  useEffect(() => {
    if (isHovered) return;
    const progressInterval = setInterval(() => {
      setSlideProgress((prev) => (prev >= 100 ? 0 : prev + (100 / 55)));
    }, 100);
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
      setSlideProgress(0);
    }, 5500);
    return () => { clearInterval(progressInterval); clearInterval(slideInterval); };
  }, [isHovered, slides.length]);

  useEffect(() => { setSlideProgress(0); }, [currentSlide]);

  // Touch swipe
  const minSwipeDistance = 50;
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance)  setCurrentSlide((p) => (p + 1) % slides.length);
    if (distance < -minSwipeDistance) setCurrentSlide((p) => (p - 1 + slides.length) % slides.length);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeView === 'register' || isPanelOpen) return;
      if (e.key === 'ArrowLeft')  setCurrentSlide((p) => (p - 1 + slides.length) % slides.length);
      if (e.key === 'ArrowRight') setCurrentSlide((p) => (p + 1) % slides.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, isPanelOpen, slides.length]);

  const iconColorMap = {
    primary: 'text-primary-400',
    accent:  'text-accent-400',
    success: 'text-success-400',
    warning: 'text-warning-400',
  };

  return (
    <div
      className={`fixed top-0 left-0 w-full h-screen z-[1] transition-all duration-300 ${activeView === 'register' ? 'blur-sm' : ''}`}
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 20% 50%, rgba(245, 158, 11, 0.08) 0%, transparent 60%)' }}
      />

      {/* Slider */}
      <div
        className="h-full flex items-center justify-center px-6 sm:px-10 lg:px-14 py-10"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-full max-w-2xl">
          {/* Desktop */}
          <div className="hidden md:block">
            <div className="relative overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {slides.map((slide) => {
                  const Icon = slide.icon;
                  return (
                    <div key={slide.id} className="min-w-full flex items-center gap-10 lg:gap-14">
                      {/* Text */}
                      <div className="flex-1 space-y-3">
                        <h2 className={`font-heading font-bold text-white leading-snug transition-all duration-300
                          ${isPanelOpen ? 'text-2xl lg:text-3xl' : 'text-3xl lg:text-4xl'}`}>
                          {slide.headline}
                        </h2>
                        <p className={`text-slate-400 leading-relaxed transition-all duration-300
                          ${isPanelOpen ? 'text-sm lg:text-base' : 'text-base lg:text-lg'}`}>
                          {slide.description}
                        </p>
                      </div>

                      {/* Icon card */}
                      <div className={`transition-all duration-300 flex-shrink-0
                        ${isPanelOpen ? 'hidden xl:flex' : 'flex'} items-center justify-center`}>
                        <div className={`rounded-2xl border border-white/10
                          bg-white/[0.04] backdrop-blur-sm transition-all duration-300
                          flex items-center justify-center
                          ${isPanelOpen ? 'w-28 h-28 lg:w-36 lg:h-36' : 'w-40 h-40 lg:w-52 lg:h-52'}`}>
                          <Icon
                            className={`${iconColorMap[slide.color]} transition-all duration-300
                              ${isPanelOpen ? 'w-12 h-12 lg:w-16 lg:h-16' : 'w-20 h-20 lg:w-24 lg:h-24'}`}
                            strokeWidth={1.25}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden">
            <div className="relative overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {slides.map((slide) => {
                  const Icon = slide.icon;
                  return (
                    <div key={slide.id} className="min-w-full flex flex-col items-center text-center space-y-5">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 w-24 h-24 flex items-center justify-center">
                        <Icon className={`w-full h-full ${iconColorMap[slide.color]}`} strokeWidth={1.25} />
                      </div>
                      <div className="space-y-2">
                        <h2 className="font-heading font-bold text-white text-xl sm:text-2xl">{slide.headline}</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">{slide.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dot navigation */}
          <div className="flex flex-col items-center gap-3 mt-10 lg:mt-12">
            <div className="flex items-center gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => { setCurrentSlide(index); setSlideProgress(0); }}
                  aria-label={`Go to slide ${index + 1}`}
                  className="relative"
                >
                  <div className={`transition-all duration-300 rounded-full
                    ${currentSlide === index
                      ? 'bg-primary-500 w-7 h-1.5'
                      : 'bg-white/25 hover:bg-white/40 w-1.5 h-1.5'
                    }`}
                  />
                  {currentSlide === index && (
                    <div
                      className="absolute top-0 left-0 h-full bg-primary-300 rounded-full transition-all duration-100"
                      style={{ width: `${(slideProgress / 100) * 28}px` }}
                    />
                  )}
                </button>
              ))}
            </div>
            <span className="text-slate-500 text-xs tabular-nums">
              {currentSlide + 1} / {slides.length}
            </span>
          </div>
        </div>

        {/* Swipe hint — mobile only */}
        <div className="md:hidden absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-500 text-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span>Swipe to navigate</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default AuthSlides;