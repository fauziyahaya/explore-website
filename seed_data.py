#!/usr/bin/env python3
"""
Script to seed the database with sample property data
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, date, timedelta
from src.models.user import db
from src.models.property import Property, PropertyRecommendation, MarketTrend
from src.main import app

def seed_properties():
    """Seed sample property data"""
    properties = [
        {
            'title': 'Windows on The Park Condominium',
            'property_type': 'Condominium',
            'price': 738000,
            'size': 2681,
            'size_unit': 'sq ft',
            'bedrooms': 3,
            'bathrooms': 3,
            'state': 'Selangor',
            'city': 'Cheras',
            'status': 'Completed',
            'tenure': 'Freehold',
            'description': 'Ground floor condo with park view in Bandar Tun Hussein Onn',
            'agent_name': 'Teammy Lee',
            'agent_contact': '+60123456789',
            'source_website': 'PropertyGuru'
        },
        {
            'title': 'Shah Alam Premium Shop Lot',
            'property_type': 'Commercial',
            'price': 2188000,
            'size': 4620,
            'size_unit': 'sq ft',
            'bedrooms': None,
            'bathrooms': None,
            'state': 'Selangor',
            'city': 'Shah Alam',
            'status': 'Completed',
            'tenure': 'Leasehold',
            'description': '3-story shop in prime commercial area with ROI 5.8%',
            'agent_name': 'Commercial Properties Sdn Bhd',
            'agent_contact': '+60123456790',
            'source_website': 'iProperty'
        },
        {
            'title': 'Residensi Fairpark Apartment',
            'property_type': 'Apartment',
            'price': 250000,
            'size': 850,
            'size_unit': 'sq ft',
            'bedrooms': 3,
            'bathrooms': 2,
            'state': 'Perak',
            'city': 'Ipoh',
            'status': 'Completed',
            'tenure': 'Leasehold',
            'description': 'Affordable apartment in established residential area',
            'agent_name': 'Ipoh Properties',
            'agent_contact': '+60123456791',
            'source_website': 'Mudah'
        },
        {
            'title': 'KLCC Luxury Condominium',
            'property_type': 'Condominium',
            'price': 1500000,
            'size': 1200,
            'size_unit': 'sq ft',
            'bedrooms': 2,
            'bathrooms': 2,
            'state': 'Kuala Lumpur',
            'city': 'KLCC',
            'status': 'New Launch',
            'tenure': 'Freehold',
            'description': 'Luxury living in the heart of KL with panoramic city views',
            'agent_name': 'Premium Properties KL',
            'agent_contact': '+60123456792',
            'source_website': 'PropertyGuru'
        },
        {
            'title': 'George Town Heritage Terrace House',
            'property_type': 'Landed Terrace',
            'price': 680000,
            'size': 1400,
            'size_unit': 'sq ft',
            'bedrooms': 4,
            'bathrooms': 3,
            'state': 'Penang',
            'city': 'George Town',
            'status': 'Sub-sale',
            'tenure': 'Freehold',
            'description': 'UNESCO World Heritage area terrace house with modern renovation',
            'agent_name': 'Island Realty',
            'agent_contact': '+60123456793',
            'source_website': 'iProperty'
        },
        {
            'title': 'Johor Bahru Semi-Detached House',
            'property_type': 'Landed Semi-detached',
            'price': 850000,
            'size': 2200,
            'size_unit': 'sq ft',
            'bedrooms': 5,
            'bathrooms': 4,
            'state': 'Johor',
            'city': 'Johor Bahru',
            'status': 'Completed',
            'tenure': 'Freehold',
            'description': 'Spacious family home near Singapore border with easy access to CIQ',
            'agent_name': 'Southern Properties',
            'agent_contact': '+60123456794',
            'source_website': 'PropertyGuru'
        },
        {
            'title': 'Cyberjaya Tech Hub Condominium',
            'property_type': 'Condominium',
            'price': 580000,
            'size': 1100,
            'size_unit': 'sq ft',
            'bedrooms': 3,
            'bathrooms': 2,
            'state': 'Selangor',
            'city': 'Cyberjaya',
            'status': 'New Launch',
            'tenure': 'Freehold',
            'description': 'Modern condo near major tech companies with excellent connectivity',
            'agent_name': 'Tech City Properties',
            'agent_contact': '+60123456795',
            'source_website': 'iProperty'
        },
        {
            'title': 'Mont Kiara Luxury Apartment',
            'property_type': 'Apartment',
            'price': 1200000,
            'size': 1800,
            'size_unit': 'sq ft',
            'bedrooms': 4,
            'bathrooms': 3,
            'state': 'Kuala Lumpur',
            'city': 'Mont Kiara',
            'status': 'Completed',
            'tenure': 'Freehold',
            'description': 'Upscale apartment in expat-friendly neighborhood with international schools nearby',
            'agent_name': 'Mont Kiara Realty',
            'agent_contact': '+60123456796',
            'source_website': 'PropertyGuru'
        },
        {
            'title': 'Iskandar Puteri Bungalow',
            'property_type': 'Landed Bungalow',
            'price': 1800000,
            'size': 3500,
            'size_unit': 'sq ft',
            'bedrooms': 6,
            'bathrooms': 5,
            'state': 'Johor',
            'city': 'Iskandar Puteri',
            'status': 'Completed',
            'tenure': 'Freehold',
            'description': 'Luxurious bungalow in gated community with golf course view',
            'agent_name': 'Iskandar Properties',
            'agent_contact': '+60123456797',
            'source_website': 'iProperty'
        },
        {
            'title': 'Petaling Jaya Office Suite',
            'property_type': 'Commercial',
            'price': 950000,
            'size': 1500,
            'size_unit': 'sq ft',
            'bedrooms': None,
            'bathrooms': None,
            'state': 'Selangor',
            'city': 'Petaling Jaya',
            'status': 'Sub-sale',
            'tenure': 'Freehold',
            'description': 'Prime office space in established business district',
            'agent_name': 'PJ Commercial',
            'agent_contact': '+60123456798',
            'source_website': 'Mudah'
        }
    ]
    
    for prop_data in properties:
        # Check if property already exists
        existing = Property.query.filter_by(title=prop_data['title']).first()
        if not existing:
            property_obj = Property(**prop_data)
            db.session.add(property_obj)
    
    db.session.commit()
    print(f"Seeded {len(properties)} properties")

def seed_recommendations():
    """Seed sample property recommendations"""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    
    recommendations = [
        {
            'property_id': 7,  # Cyberjaya Tech Hub Condominium
            'title': 'Cyberjaya Tech Hub Condominium',
            'location': 'Cyberjaya, Selangor',
            'price': 580000,
            'expected_roi': 18.0,
            'rental_yield': 5.2,
            'rating': 4.8,
            'risk_level': 'Low',
            'investment_horizon': '3-5 years',
            'reasons': [
                'Near major tech companies (Google, Microsoft)',
                'Upcoming MRT extension',
                'High rental demand from expats',
                'Government smart city initiatives'
            ],
            'featured': True,
            'week_start': week_start
        },
        {
            'property_id': 5,  # George Town Heritage Terrace House
            'title': 'Penang Island Seafront Apartment',
            'location': 'George Town, Penang',
            'price': 680000,
            'expected_roi': 15.0,
            'rental_yield': 4.8,
            'rating': 4.6,
            'risk_level': 'Medium',
            'investment_horizon': '2-4 years',
            'reasons': [
                'UNESCO World Heritage area',
                'Strong tourism recovery',
                'Limited heritage property supply',
                'Airbnb potential'
            ],
            'featured': False,
            'week_start': week_start
        },
        {
            'property_id': 2,  # Shah Alam Premium Shop Lot
            'title': 'Johor Bahru Transit Hub Shop',
            'location': 'JB Sentral, Johor',
            'price': 2188000,
            'expected_roi': 22.0,
            'rental_yield': 6.1,
            'rating': 4.7,
            'risk_level': 'Medium',
            'investment_horizon': '5-7 years',
            'reasons': [
                'RTS Link to Singapore (2026)',
                'High foot traffic location',
                'Commercial rental premium',
                'Cross-border business growth'
            ],
            'featured': False,
            'week_start': week_start
        }
    ]
    
    for rec_data in recommendations:
        # Check if recommendation already exists
        existing = PropertyRecommendation.query.filter_by(
            property_id=rec_data['property_id'],
            week_start=rec_data['week_start']
        ).first()
        if not existing:
            recommendation = PropertyRecommendation(**rec_data)
            db.session.add(recommendation)
    
    db.session.commit()
    print(f"Seeded {len(recommendations)} recommendations")

def seed_market_trends():
    """Seed sample market trends"""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    
    trends = [
        {
            'title': 'Klang Valley Property Prices',
            'trend_value': '+3.2%',
            'period': 'Q4 2024',
            'status': 'rising',
            'description': 'Steady growth driven by infrastructure development',
            'week_start': week_start
        },
        {
            'title': 'Rental Yields',
            'trend_value': '4.5%',
            'period': 'Average',
            'status': 'stable',
            'description': 'Consistent returns across major urban areas',
            'week_start': week_start
        },
        {
            'title': 'Foreign Investment',
            'trend_value': '+15%',
            'period': 'YoY',
            'status': 'rising',
            'description': 'Increased interest from Singapore and China investors',
            'week_start': week_start
        },
        {
            'title': 'New Launches',
            'trend_value': '-8%',
            'period': 'Q4 2024',
            'status': 'falling',
            'description': 'Developers focusing on quality over quantity',
            'week_start': week_start
        }
    ]
    
    for trend_data in trends:
        # Check if trend already exists
        existing = MarketTrend.query.filter_by(
            title=trend_data['title'],
            week_start=trend_data['week_start']
        ).first()
        if not existing:
            trend = MarketTrend(**trend_data)
            db.session.add(trend)
    
    db.session.commit()
    print(f"Seeded {len(trends)} market trends")

def main():
    """Main seeding function"""
    with app.app_context():
        print("Starting database seeding...")
        
        # Create tables if they don't exist
        db.create_all()
        
        # Seed data
        seed_properties()
        seed_recommendations()
        seed_market_trends()
        
        print("Database seeding completed!")

if __name__ == '__main__':
    main()

