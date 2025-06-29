import React from 'react';
import { ArrowRight, TrendingUp, Shield, Users } from 'lucide-react';
import heroImage from '../assets/kl_skyline_hero.jpg';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 hero-gradient"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container-max text-white">
        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Your Gateway to
            <span className="block text-secondary"> Smart Property Investment</span>
            in Malaysia
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 text-gray-200 leading-relaxed">
            Discover the best property investment opportunities in Malaysia with expert guidance, 
            comprehensive market data, and personalized recommendations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button className="btn-primary flex items-center justify-center gap-2 text-lg">
              Start Investing
              <ArrowRight size={20} />
            </button>
            <button className="btn-secondary flex items-center justify-center gap-2 text-lg">
              Learn More
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <TrendingUp className="text-secondary" size={32} />
              </div>
              <div>
                <div className="text-2xl font-bold">15%+</div>
                <div className="text-gray-200">Average ROI</div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Shield className="text-secondary" size={32} />
              </div>
              <div>
                <div className="text-2xl font-bold">10K+</div>
                <div className="text-gray-200">Properties Listed</div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Users className="text-secondary" size={32} />
              </div>
              <div>
                <div className="text-2xl font-bold">5K+</div>
                <div className="text-gray-200">Happy Investors</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

