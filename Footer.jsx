import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import logoImage from '../assets/website_logo.png';

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-max">
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Company Info */}
            <div className="space-y-4">
              <Link to="/" className="flex items-center space-x-2">
                <img src={logoImage} alt="PropertyMalaysia" className="h-12 w-auto brightness-0 invert" />
              </Link>
              <p className="text-primary-foreground/80 text-sm leading-relaxed">
                Your trusted partner for smart property investment in Malaysia. 
                We provide comprehensive market insights, expert guidance, and 
                personalized recommendations to help you make informed investment decisions.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                  <Facebook size={20} />
                </a>
                <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                  <Twitter size={20} />
                </a>
                <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                  <Instagram size={20} />
                </a>
                <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                  <Linkedin size={20} />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/education" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Investment Education
                  </Link>
                </li>
                <li>
                  <Link to="/listings" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Property Listings
                  </Link>
                </li>
                <li>
                  <Link to="/recommendations" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Weekly Recommendations
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Market Analysis
                  </a>
                </li>
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Investment Calculator
                  </a>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Services</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Property Valuation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Investment Consultation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Market Research
                  </a>
                </li>
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Financing Assistance
                  </a>
                </li>
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Legal Support
                  </a>
                </li>
                <li>
                  <a href="#" className="text-primary-foreground/80 hover:text-secondary transition-colors text-sm">
                    Property Management
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-secondary mt-1 flex-shrink-0" />
                  <div className="text-sm text-primary-foreground/80">
                    Level 10, Menara Axiata,<br />
                    No. 9, Jalan Stesen Sentral 5,<br />
                    Kuala Lumpur Sentral,<br />
                    50470 Kuala Lumpur
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-secondary flex-shrink-0" />
                  <a href="tel:+60123456789" className="text-sm text-primary-foreground/80 hover:text-secondary transition-colors">
                    +60 12-345 6789
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-secondary flex-shrink-0" />
                  <a href="mailto:info@propertymalaysia.com" className="text-sm text-primary-foreground/80 hover:text-secondary transition-colors">
                    info@propertymalaysia.com
                  </a>
                </div>
              </div>

              {/* Newsletter Signup */}
              <div className="mt-6">
                <h4 className="font-semibold mb-2">Newsletter</h4>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="flex-1 px-3 py-2 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:border-secondary text-primary-foreground placeholder:text-primary-foreground/60"
                  />
                  <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm font-semibold hover:bg-secondary/90 transition-colors">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-primary-foreground/20 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-primary-foreground/60">
              © 2024 PropertyMalaysia. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                Cookie Policy
              </a>
              <a href="#" className="text-primary-foreground/60 hover:text-secondary transition-colors">
                Sitemap
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

