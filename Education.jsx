import React, { useState } from 'react';
import { BookOpen, Target, MapPin, Calculator, TrendingUp, Shield, Clock, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';

const Education = () => {
  const [selectedPurpose, setSelectedPurpose] = useState('investment');

  const investmentCriteria = [
    {
      id: 'median',
      title: 'Median Price',
      icon: <DollarSign className="text-primary" size={24} />,
      description: 'Buy at or below median price to predict future value and ensure profitability.',
      example: 'If median price in Cheras is RM500K, look for properties priced at RM450K or below.',
      importance: 'High'
    },
    {
      id: 'new-vs-old',
      title: 'New vs Old Property',
      icon: <TrendingUp className="text-primary" size={24} />,
      description: 'Choose new properties if premium is 30% or less for better capital gains.',
      example: 'New condo at RM600K vs old at RM450K = 33% premium (avoid). New at RM580K vs old at RM450K = 29% premium (good).',
      importance: 'High'
    },
    {
      id: 'tier',
      title: 'Location Tier',
      icon: <MapPin className="text-primary" size={24} />,
      description: 'Don\'t overpay for properties in lower-tier areas with Tier 1 prices.',
      example: 'Tier 1: KLCC area. Tier 2: Cheras. Don\'t pay KLCC prices for Cheras properties.',
      importance: 'High'
    },
    {
      id: 'booster',
      title: 'Property Boosters',
      icon: <TrendingUp className="text-primary" size={24} />,
      description: 'Look for multiple boosters: infrastructure, commercial, and population growth.',
      example: 'Near MRT station (infrastructure) + shopping mall (commercial) + new township (population).',
      importance: 'Medium'
    },
    {
      id: 'supply',
      title: 'Supply & Demand',
      icon: <Target className="text-primary" size={24} />,
      description: 'Ensure balanced supply that matches job creation and usage demand.',
      example: 'Avoid areas with 10 new condos launching simultaneously without job growth.',
      importance: 'High'
    },
    {
      id: 'maturity',
      title: 'Maturity Point',
      icon: <Clock className="text-primary" size={24} />,
      description: 'Choose properties that can mature and provide returns within 5 years.',
      example: 'Properties near upcoming MRT stations or developing commercial areas.',
      importance: 'Medium'
    },
    {
      id: 'rental',
      title: 'Multiple Rental Options',
      icon: <Shield className="text-primary" size={24} />,
      description: 'Ensure property can cover 70% of monthly installment with standard rental.',
      example: 'RM2000 installment should generate at least RM1400 rental income.',
      importance: 'High'
    }
  ];

  const ownStayCriteria = [
    {
      id: 'location',
      title: 'Proximity to Work/School',
      icon: <MapPin className="text-primary" size={24} />,
      description: 'Choose locations that minimize daily commute time and transportation costs.',
      example: 'Within 30 minutes drive to workplace or near good public transport.',
      importance: 'High'
    },
    {
      id: 'amenities',
      title: 'Nearby Amenities',
      icon: <Target className="text-primary" size={24} />,
      description: 'Ensure access to essential services like hospitals, schools, and shopping.',
      example: 'Within 5km of hospital, good schools, and shopping centers.',
      importance: 'High'
    },
    {
      id: 'affordability',
      title: 'Affordability',
      icon: <Calculator className="text-primary" size={24} />,
      description: 'Monthly installment should not exceed 30% of household income.',
      example: 'RM8000 monthly income = maximum RM2400 monthly installment.',
      importance: 'High'
    },
    {
      id: 'future-value',
      title: 'Future Appreciation',
      icon: <TrendingUp className="text-primary" size={24} />,
      description: 'Consider long-term development plans and infrastructure projects.',
      example: 'Areas with upcoming MRT lines or government development projects.',
      importance: 'Medium'
    }
  ];

  const terminologies = [
    {
      term: 'Freehold vs Leasehold',
      definition: 'Freehold means you own the land indefinitely. Leasehold means ownership for a specific period (e.g., 99 years).',
      importance: 'Freehold properties generally have higher value and appreciation potential.'
    },
    {
      term: 'Rental Yield',
      definition: 'Annual rental income expressed as a percentage of property purchase price.',
      importance: 'Indicates return on investment from rental income. Good yield is 4-6% in Malaysia.'
    },
    {
      term: 'Capital Appreciation',
      definition: 'The increase in property value over time.',
      importance: 'Key factor for long-term investment returns. Aim for 5-8% annually.'
    },
    {
      term: 'Real Property Gains Tax (RPGT)',
      definition: 'Tax imposed on profit from property disposal. Rate varies by holding period.',
      importance: 'Affects net profit when selling. Longer holding periods have lower rates.'
    },
    {
      term: 'Debt Service Ratio (DSR)',
      definition: 'Ratio comparing total monthly debt obligations to net monthly income.',
      importance: 'Banks use this to assess loan eligibility. Keep below 60% for approval.'
    },
    {
      term: 'Loan-to-Value (LTV)',
      definition: 'Ratio of loan amount to property value. Determines maximum loan amount.',
      importance: 'Higher LTV means lower down payment but higher monthly installments.'
    }
  ];

  const financingOptions = [
    {
      type: 'Term Loan',
      description: 'Fixed monthly installments with constant interest rate throughout loan tenure.',
      pros: ['Predictable monthly payments', 'Simple structure'],
      cons: ['No flexibility for additional payments', 'May have early settlement penalties']
    },
    {
      type: 'Semi-Flexi Loan',
      description: 'Allows additional payments to reduce principal and interest charges.',
      pros: ['Interest savings with extra payments', 'Some liquidity'],
      cons: ['Slightly higher interest rates', 'Limited withdrawal options']
    },
    {
      type: 'Flexi Home Loan',
      description: 'Linked to current account with automatic deduction and withdrawal flexibility.',
      pros: ['High flexibility', 'Significant interest savings potential', 'Easy access to extra payments'],
      cons: ['Requires discipline', 'Higher interest rates']
    },
    {
      type: 'Islamic Financing (BBA)',
      description: 'Shariah-compliant buy-and-sell concept without interest charges.',
      pros: ['Shariah-compliant', 'Fixed payment structure'],
      cons: ['Limited flexibility', 'May have higher effective rates']
    },
    {
      type: 'Islamic Financing (MM)',
      description: 'Partnership concept with joint ownership and gradual acquisition.',
      pros: ['Shariah-compliant', 'Joint ownership benefits'],
      cons: ['Complex structure', 'Limited availability']
    }
  ];

  const currentCriteria = selectedPurpose === 'investment' ? investmentCriteria : ownStayCriteria;

  return (
    <section id="education" className="section-padding bg-muted/30">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Property Investment <span className="text-gradient">Education</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Master the fundamentals of property investment in Malaysia with our comprehensive guide
            designed for first-time investors.
          </p>
        </div>

        <Tabs defaultValue="criteria" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="criteria" className="flex items-center gap-2">
              <Target size={20} />
              Investment Criteria
            </TabsTrigger>
            <TabsTrigger value="terminology" className="flex items-center gap-2">
              <BookOpen size={20} />
              Terminology
            </TabsTrigger>
            <TabsTrigger value="financing" className="flex items-center gap-2">
              <Calculator size={20} />
              Financing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criteria" className="space-y-8">
            {/* Purpose Selection */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-4">Select Your Investment Purpose</h3>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setSelectedPurpose('investment')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedPurpose === 'investment'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                  }`}
                >
                  For Investment
                </button>
                <button
                  onClick={() => setSelectedPurpose('ownstay')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedPurpose === 'ownstay'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                  }`}
                >
                  For Own Stay
                </button>
              </div>
            </div>

            {/* Criteria Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentCriteria.map((criterion, index) => (
                <Card key={criterion.id} className="property-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {criterion.icon}
                        <CardTitle className="text-lg">{criterion.title}</CardTitle>
                      </div>
                      <Badge variant={criterion.importance === 'High' ? 'destructive' : 'secondary'}>
                        {criterion.importance}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4 text-base">
                      {criterion.description}
                    </CardDescription>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Example:</p>
                      <p className="text-sm">{criterion.example}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="terminology" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {terminologies.map((term, index) => (
                <Card key={index} className="property-card">
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">{term.term}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4 text-base">
                      {term.definition}
                    </CardDescription>
                    <div className="bg-accent/20 p-4 rounded-lg">
                      <p className="text-sm font-medium text-accent-foreground mb-1">Why it matters:</p>
                      <p className="text-sm text-accent-foreground">{term.importance}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="financing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {financingOptions.map((option, index) => (
                <Card key={index} className="property-card">
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">{option.type}</CardTitle>
                    <CardDescription className="text-base">
                      {option.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-accent/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-accent-foreground mb-2">Pros:</h4>
                        <ul className="space-y-1">
                          {option.pros.map((pro, i) => (
                            <li key={i} className="text-sm text-accent-foreground flex items-start gap-2">
                              <span className="text-accent font-bold">•</span>
                              {pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-destructive/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-destructive mb-2">Cons:</h4>
                        <ul className="space-y-1">
                          {option.cons.map((con, i) => (
                            <li key={i} className="text-sm text-destructive flex items-start gap-2">
                              <span className="text-destructive font-bold">•</span>
                              {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

export default Education;

