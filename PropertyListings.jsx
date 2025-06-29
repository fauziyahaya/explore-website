import React, { useState, useMemo } from 'react';
import { Search, Filter, MapPin, Home, Building, DollarSign, Ruler, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const PropertyListings = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    state: 'all',
    city: 'all',
    status: 'all',
    priceRange: 'all',
    sizeRange: 'all'
  });

  // Mock property data - in real app, this would come from API
  const properties = [
    {
      id: 1,
      title: 'Windows on The Park Condominium',
      type: 'Condominium',
      price: 738000,
      size: 2681,
      sizeUnit: 'sq ft',
      bedrooms: 3,
      bathrooms: 3,
      state: 'Selangor',
      city: 'Cheras',
      status: 'Completed',
      tenure: 'Freehold',
      image: '/api/placeholder/400/300',
      agent: 'Teammy Lee',
      listedDays: 2,
      description: 'Ground floor condo with park view in Bandar Tun Hussein'
    },
    {
      id: 2,
      title: 'Shah Alam Shop Lot',
      type: 'Commercial',
      price: 2188000,
      size: 4620,
      sizeUnit: 'sq ft',
      bedrooms: null,
      bathrooms: null,
      state: 'Selangor',
      city: 'Shah Alam',
      status: 'Completed',
      tenure: 'Leasehold',
      image: '/api/placeholder/400/300',
      agent: 'Property Agent',
      listedDays: 6,
      description: '3-story shop in prime area ROI 5.8%'
    },
    {
      id: 3,
      title: 'Residensi Fairpark Apartment',
      type: 'Apartment',
      price: 250000,
      size: 850,
      sizeUnit: 'sq ft',
      bedrooms: 3,
      bathrooms: 2,
      state: 'Perak',
      city: 'Ipoh',
      status: 'Completed',
      tenure: 'Leasehold',
      image: '/api/placeholder/400/300',
      agent: 'Local Agent',
      listedDays: 21,
      description: 'Affordable apartment in established area'
    },
    {
      id: 4,
      title: 'KLCC Luxury Condominium',
      type: 'Condominium',
      price: 1500000,
      size: 1200,
      sizeUnit: 'sq ft',
      bedrooms: 2,
      bathrooms: 2,
      state: 'Kuala Lumpur',
      city: 'KLCC',
      status: 'New Launch',
      tenure: 'Freehold',
      image: '/api/placeholder/400/300',
      agent: 'Premium Properties',
      listedDays: 5,
      description: 'Luxury living in the heart of KL'
    },
    {
      id: 5,
      title: 'Penang Terrace House',
      type: 'Landed Terrace',
      price: 680000,
      size: 1400,
      sizeUnit: 'sq ft',
      bedrooms: 4,
      bathrooms: 3,
      state: 'Penang',
      city: 'George Town',
      status: 'Sub-sale',
      tenure: 'Freehold',
      image: '/api/placeholder/400/300',
      agent: 'Island Realty',
      listedDays: 12,
      description: 'Heritage area terrace house with modern renovation'
    },
    {
      id: 6,
      title: 'Johor Semi-D House',
      type: 'Landed Semi-detached',
      price: 850000,
      size: 2200,
      sizeUnit: 'sq ft',
      bedrooms: 5,
      bathrooms: 4,
      state: 'Johor',
      city: 'Johor Bahru',
      status: 'Completed',
      tenure: 'Freehold',
      image: '/api/placeholder/400/300',
      agent: 'Southern Properties',
      listedDays: 8,
      description: 'Spacious family home near Singapore border'
    }
  ];

  const states = ['Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Perak', 'Negeri Sembilan'];
  const propertyTypes = ['Apartment', 'Condominium', 'Landed Bungalow', 'Landed Semi-detached', 'Landed Terrace', 'Commercial'];
  const statusOptions = ['New Launch', 'Completed', 'Sub-sale'];

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      const matchesSearch = property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.state.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filters.type === 'all' || property.type === filters.type;
      const matchesState = filters.state === 'all' || property.state === filters.state;
      const matchesStatus = filters.status === 'all' || property.status === filters.status;
      
      const matchesPrice = filters.priceRange === 'all' || (() => {
        switch (filters.priceRange) {
          case 'under-300k': return property.price < 300000;
          case '300k-600k': return property.price >= 300000 && property.price < 600000;
          case '600k-1m': return property.price >= 600000 && property.price < 1000000;
          case 'above-1m': return property.price >= 1000000;
          default: return true;
        }
      })();

      return matchesSearch && matchesType && matchesState && matchesStatus && matchesPrice;
    });
  }, [searchTerm, filters, properties]);

  const formatPrice = (price) => {
    if (price >= 1000000) {
      return `RM ${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `RM ${(price / 1000).toFixed(0)}K`;
    }
    return `RM ${price.toLocaleString()}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New Launch': return 'bg-accent text-accent-foreground';
      case 'Completed': return 'bg-primary text-primary-foreground';
      case 'Sub-sale': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <section id="listings" className="section-padding">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Property <span className="text-gradient">Listings</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover the latest property listings across Malaysia with advanced filtering and search capabilities.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-card p-6 rounded-lg shadow-lg mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                placeholder="Search location or property name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.type} onValueChange={(value) => setFilters({...filters, type: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Property Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {propertyTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.state} onValueChange={(value) => setFilters({...filters, state: value})}>
              <SelectTrigger>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {states.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={filters.priceRange} onValueChange={(value) => setFilters({...filters, priceRange: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Price Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="under-300k">Under RM 300K</SelectItem>
                <SelectItem value="300k-600k">RM 300K - 600K</SelectItem>
                <SelectItem value="600k-1m">RM 600K - 1M</SelectItem>
                <SelectItem value="above-1m">Above RM 1M</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredProperties.length} properties found
              </span>
            </div>
          </div>
        </div>

        {/* Property Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="property-card overflow-hidden">
              <div className="relative">
                <div className="h-48 bg-muted flex items-center justify-center">
                  <Building size={48} className="text-muted-foreground" />
                </div>
                <Badge className={`absolute top-2 right-2 ${getStatusColor(property.status)}`}>
                  {property.status}
                </Badge>
                <Badge variant="outline" className="absolute top-2 left-2 bg-white/90">
                  {property.tenure}
                </Badge>
              </div>
              
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg line-clamp-2">{property.title}</CardTitle>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{formatPrice(property.price)}</div>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <MapPin size={16} />
                  {property.city}, {property.state}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Ruler size={16} className="text-muted-foreground" />
                    <span className="text-sm">{property.size.toLocaleString()} {property.sizeUnit}</span>
                  </div>
                  {property.bedrooms && (
                    <div className="flex items-center gap-2">
                      <Home size={16} className="text-muted-foreground" />
                      <span className="text-sm">{property.bedrooms}R {property.bathrooms}B</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {property.description}
                </p>

                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    Listed {property.listedDays} days ago
                  </div>
                  <Button size="sm" className="btn-primary">
                    Contact Agent
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-12">
            <Building size={64} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No properties found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or filters to find more properties.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default PropertyListings;

