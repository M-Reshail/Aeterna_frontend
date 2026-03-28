import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useSocket } from '@hooks/useSocket';
import { ChevronDown, Menu, X } from 'lucide-react';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const { status } = useSocket({ autoConnect: isAuthenticated });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const userMenuRef = useRef(null);

  // Close mobile menu and dropdowns on route change
  useEffect(() => {
    setShowMobileMenu(false);
    setShowMoreMenu(false);
  }, [location.pathname]);

  // Close user dropdown on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handleOutsideClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showUserMenu]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40" style={{paddingTop: '32px'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[71px]">
        {/* Glass header container */}
        <div className={`glass-header border border-emerald-500/20 flex items-stretch justify-between ${isScrolled ? 'fixed-scroll' : ''}`}>
          
          {/* Logo */}
          <RouterLink to="/" className="flex items-center gap-3 group self-center">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white-primary font-bold text-base">Æ</span>
            </div>
            <span className="text-white-primary font-bold text-base hidden sm:inline">AETERNA</span>
          </RouterLink>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-stretch gap-0" style={{height:'100%'}}>
            {isAuthenticated ? (
              <>
                <RouterLink
                  to="/dashboard"
                  className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
                >
                  Dashboard
                </RouterLink>
                <RouterLink
                  to="/alerts"
                  className={`nav-link ${isActive('/alerts') ? 'active' : ''}`}
                >
                  Alerts
                </RouterLink>
                <RouterLink
                  to="/news"
                  className={`nav-link ${isActive('/news') ? 'active' : ''}`}
                >
                  News
                </RouterLink>
                {user?.role === 'admin' && (
                  <RouterLink
                    to="/admin"
                    className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
                  >
                    Admin
                  </RouterLink>
                )}
              </>
            ) : (
              <>
                <a
                  href="#features"
                  className="nav-link"
                >
                  Features
                </a>
                <a
                  href="#testimonials"
                  className="nav-link"
                >
                  Testimonials
                </a>
                <a
                  href="#pricing"
                  className="nav-link"
                >
                  Pricing
                </a>
                
                {/* More Menu */}
                <div className="relative" onMouseLeave={() => setShowMoreMenu(false)}>
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="nav-link flex items-center gap-1"
                  >
                    More
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showMoreMenu && (
                    <div className="absolute top-full mt-0 right-0 bg-black-card/80 border border-emerald-500/20 rounded-lg py-2 min-w-40 shadow-lg backdrop-blur-sm">
                      <a
                        href="#docs"
                        className="block px-4 py-2 text-sm text-white hover:text-emerald-400 hover:bg-black-hover/50 transition"
                      >
                        Documentation
                      </a>
                      <a
                        href="#support"
                        className="block px-4 py-2 text-sm text-white hover:text-emerald-400 hover:bg-black-hover/50 transition"
                      >
                        Support
                      </a>
                      <a
                        href="#blog"
                        className="block px-4 py-2 text-sm text-white hover:text-emerald-400 hover:bg-black-hover/50 transition"
                      >
                        Blog
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4 self-center">
            {isAuthenticated && (
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#1f1f1f] bg-[#0b0b0b]/80">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status === 'connected'
                      ? 'bg-emerald-400'
                      : status === 'reconnecting'
                        ? 'bg-amber-400'
                        : 'bg-slate-500'
                  }`}
                />
                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                  {status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting' : 'Offline'}
                </span>
              </div>
            )}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-black-card transition-colors"
                >
                  <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-black-oled text-xs font-bold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <svg
                    className="w-4 h-4 text-white-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
                {/* User Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-black-card border border-black-card rounded-lg shadow-lg py-1 z-50 screen-edge">
                    <div className="px-4 py-2 border-b border-black-card">
                      <p className="text-xs font-medium text-white-muted">{user?.email}</p>
                    </div>
                    <RouterLink
                      to="/settings"
                      className="block px-4 py-2 text-sm text-white-muted hover:bg-black-hover hover:text-white-primary transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Settings
                    </RouterLink>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-danger-400 hover:bg-black-hover transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-boost hidden md:flex"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="btn-buy hidden md:flex"
                >
                  Get Started
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu((v) => !v)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-black-card transition-colors text-white-muted"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {showMobileMenu && (
          <div className="md:hidden mt-2 glass-header border border-emerald-500/20 rounded-xl overflow-hidden animate-fadeIn">
            <nav className="flex flex-col py-2">
              {isAuthenticated ? (
                <>
                  <RouterLink
                    to="/dashboard"
                    className={`px-5 py-3 text-sm font-medium transition-colors ${location.pathname === '/dashboard' ? 'text-emerald-400 bg-emerald-500/10' : 'text-white-muted hover:text-white-primary hover:bg-black-card'}`}
                  >
                    Dashboard
                  </RouterLink>
                  <RouterLink
                    to="/alerts"
                    className={`px-5 py-3 text-sm font-medium transition-colors ${location.pathname === '/alerts' ? 'text-emerald-400 bg-emerald-500/10' : 'text-white-muted hover:text-white-primary hover:bg-black-card'}`}
                  >
                    Alerts
                  </RouterLink>
                  <RouterLink
                    to="/news"
                    className={`px-5 py-3 text-sm font-medium transition-colors ${location.pathname === '/news' ? 'text-emerald-400 bg-emerald-500/10' : 'text-white-muted hover:text-white-primary hover:bg-black-card'}`}
                  >
                    News
                  </RouterLink>
                  {user?.role === 'admin' && (
                    <RouterLink
                      to="/admin"
                      className={`px-5 py-3 text-sm font-medium transition-colors ${location.pathname === '/admin' ? 'text-emerald-400 bg-emerald-500/10' : 'text-white-muted hover:text-white-primary hover:bg-black-card'}`}
                    >
                      Admin
                    </RouterLink>
                  )}
                  <div className="border-t border-emerald-500/10 mt-1 pt-1">
                    <RouterLink
                      to="/settings"
                      className="px-5 py-3 text-sm font-medium text-white-muted hover:text-white-primary hover:bg-black-card transition-colors block"
                    >
                      Settings
                    </RouterLink>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-5 py-3 text-sm font-medium text-danger-400 hover:bg-black-card transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <a href="#features" className="px-5 py-3 text-sm font-medium text-white-muted hover:text-white-primary hover:bg-black-card transition-colors">Features</a>
                  <a href="#testimonials" className="px-5 py-3 text-sm font-medium text-white-muted hover:text-white-primary hover:bg-black-card transition-colors">Testimonials</a>
                  <a href="#pricing" className="px-5 py-3 text-sm font-medium text-white-muted hover:text-white-primary hover:bg-black-card transition-colors">Pricing</a>
                  <a href="#docs" className="px-5 py-3 text-sm font-medium text-white-muted hover:text-white-primary hover:bg-black-card transition-colors">Documentation</a>
                  <a href="#support" className="px-5 py-3 text-sm font-medium text-white-muted hover:text-white-primary hover:bg-black-card transition-colors">Support</a>
                  <div className="border-t border-emerald-500/10 mt-2 pt-2 px-4 pb-3 flex gap-3">
                    <button
                      onClick={() => { navigate('/login'); setShowMobileMenu(false); }}
                      className="btn-boost flex-1"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => { navigate('/register'); setShowMobileMenu(false); }}
                      className="btn-buy flex-1"
                    >
                      Get Started
                    </button>
                  </div>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
