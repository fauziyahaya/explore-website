import React from 'react';
import { TrendingUp, Star, MapPin, DollarSign, Calendar, Award, BarChart3, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

const Recommendations = () => {
  const weeklyRecommendations = [
    {
      id: 1,
      title: 'Cyberjaya Tech Hub Condominium',
      location: 'Cyberjaya, Selangor',
      price: 580000,
      expectedROI: 18,
      rentalYield: 5.2,
      rating: 4.8,
      reasons: [
        'Near major tech companies (Google, Microsoft)',
        'Upcoming MRT extension',
        'High rental demand from expats',
        'Government smart city initiatives'
      ],
      riskLevel: 'Low',
      investmentHorizon: '3-5 years',
      image: '/api/placeholder/400/300',
      featured: true
    },
    {
      id: 2,
      title: 'Penang Island Seafront Apartment',
      location: 'George Town, Penang',
      price: 450000,
      expectedROI: 15,
      rentalYield: 4.8,
      rating: 4.6,
      reasons: [
        'UNESCO World Heritage area',
        'Strong tourism recovery',
        'Limited seafront supply',
        'Airbnb potential'
      ],
      riskLevel: 'Medium',
      investmentHorizon: '2-4 years',
      image: '/api/placeholder/400/300',
      featured: false
    },
    {
      id: 3,
      title: 'Johor Bahru Transit Hub Shop',
      location: 'JB Sentral, Johor',
      price: 1200000,
      expectedROI: 22,
      rentalYield: 6.1,
      rating: 4.7,
      reasons: [
        'RTS Link to Singapore (2026)',
        'High foot traffic location',
        'Commercial rental premium',
        'Cross-border business growth'
      ],
      riskLevel: 'Medium',
      investmentHorizon: '5-7 years',
      image: '/api/placeholder/400/300',
      featured: false
    }
  ];

  const marketTrends = [
    {
      title: 'Klang Valley Property Prices',
      trend: '+3.2%',
      period: 'Q4 2024',
      status: 'rising',
      description: 'Steady growth driven by infrastructure development'
    },
    {
      title: 'Rental Yields',
      trend: '4.5%',
      period: 'Average',
      status: 'stable',
      description: 'Consistent returns across major urban areas'
    },
    {
      title: 'Foreign Investment',
      trend: '+15%',
      period: 'YoY',
      status: 'rising',
      description: 'Increased interest from Singapore and China investors'
    },
    {
      title: 'New Launches',
      trend: '-8%',
      period: 'Q4 2024',
      status: 'falling',
      description: 'Developers focusing on quality over quantity'
    }
  ];

  const investmentTips = [
    {
      icon: <Target className="text-primary" size={24} />,
      title: 'Focus on Transit-Oriented Development',
      description: 'Properties near MRT/LRT stations show 15-20% higher appreciation rates.',
      priority: 'High'
    },
    {
      icon: <BarChart3 className="text-primary" size={24} />,
      title: 'Monitor Interest Rate Trends',
      description: 'Current rates favor property investment over fixed deposits.',
      priority: 'Medium'
    },
    {
      icon: <Award className="text-primary" size={24} />,
      title: 'Consider Emerging Townships',
      description: 'New developments in Cyberjaya and Iskandar Puteri show strong potential.',
      priority: 'High'
    }
  ];

  const formatPrice = (price) => {
    if (price >= 1000000) {
      return `RM ${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `RM ${(price / 1000).toFixed(0)}K`;
    }
    return `RM ${price.toLocaleString()}`;
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Low': return 'bg-accent text-accent-foreground';
      case 'Medium': return 'bg-secondary text-secondary-foreground';
      case 'High': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTrendColor = (status) => {
    switch (status) {
      case 'rising': return 'text-accent';
      case 'falling': return 'text-destructive';
      case 'stable': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <section id="recommendations" className="section-padding bg-muted/30">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Weekly <span className="text-gradient">Recommendations</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Expert-curated property investment opportunities with detailed analysis and market insights.
          </p>
        </div>

        {/* Featured Recommendations */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <Star className="text-secondary" />
            This Week's Top Picks
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {weeklyRecommendations.map((property) => (
              <Card key={property.id} className={`property-card ${property.featured ? 'ring-2 ring-primary' : ''}`}>
                {property.featured && (
                  <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                    ⭐ FEATURED PICK
                  </div>
                )}
                
                <div className="relative">
                  <div className="h-48 bg-muted flex items-center justify-center">
                    <MapPin size={48} className="text-muted-foreground" />
                  </div>
                  <Badge className={`absolute top-2 right-2 ${getRiskColor(property.riskLevel)}`}>
                    {property.riskLevel} Risk
                  </Badge>
                </div>

                <CardHeader>
                  <CardTitle className="text-lg">{property.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <MapPin size={16} />
                    {property.location}
                  </CardDescription>
                  <div className="flex justify-between items-center">
                    <div className="text-2xl font-bold text-primary">{formatPrice(property.price)}</div>
                    <div className="flex items-center gap-1">
                      <Star className="text-secondary fill-current" size={16} />
                      <span className="font-semibold">{property.rating}</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-accent/20 rounded-lg">
                      <div className="text-lg font-bold text-accent">{property.expectedROI}%</div>
                      <div className="text-xs text-muted-foreground">Expected ROI</div>
                    </div>
                    <div className="text-center p-3 bg-primary/20 rounded-lg">
                      <div className="text-lg font-bold text-primary">{property.rentalYield}%</div>
                      <div className="text-xs text-muted-foreground">Rental Yield</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">Why We Recommend:</h4>
                    <ul className="space-y-1">
                      {property.reasons.slice(0, 3).map((reason, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-accent font-bold">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                    <span>Investment Horizon: {property.investmentHorizon}</span>
                  </div>

                  <Button className="w-full btn-primary">
                    View Full Analysis
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Market Trends */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <TrendingUp className="text-primary" />
            Market Trends
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {marketTrends.map((trend, index) => (
              <Card key={index} className="text-center">
                <CardHeader>
                  <CardTitle className="text-lg">{trend.title}</CardTitle>
                  <div className={`text-3xl font-bold ${getTrendColor(trend.status)}`}>
                    {trend.trend}
                  </div>
                  <CardDescription>{trend.period}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{trend.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Investment Tips */}
        <div>
          <h3 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <Award className="text-secondary" />
            Weekly Investment Tips
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {investmentTips.map((tip, index) => (
              <Card key={index} className="property-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {tip.icon}
                      <CardTitle className="text-lg">{tip.title}</CardTitle>
                    </div>
                    <Badge variant={tip.priority === 'High' ? 'destructive' : 'secondary'}>
                      {tip.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{tip.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Stay Updated</CardTitle>
              <CardDescription>
                Get weekly property investment insights and recommendations delivered to your inbox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button className="btn-primary">
                  Subscribe
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default Recommendations;

