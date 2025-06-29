from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Property(db.Model):
    __tablename__ = 'properties'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    property_type = db.Column(db.String(50), nullable=False)  # Apartment, Condominium, etc.
    price = db.Column(db.Integer, nullable=False)
    size = db.Column(db.Integer, nullable=False)
    size_unit = db.Column(db.String(10), nullable=False, default='sq ft')
    bedrooms = db.Column(db.Integer)
    bathrooms = db.Column(db.Integer)
    state = db.Column(db.String(50), nullable=False)
    city = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # New Launch, Completed, Sub-sale
    tenure = db.Column(db.String(20), nullable=False)  # Freehold, Leasehold
    description = db.Column(db.Text)
    agent_name = db.Column(db.String(100))
    agent_contact = db.Column(db.String(50))
    source_url = db.Column(db.String(500))
    source_website = db.Column(db.String(50))
    image_url = db.Column(db.String(500))
    listed_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'type': self.property_type,
            'price': self.price,
            'size': self.size,
            'sizeUnit': self.size_unit,
            'bedrooms': self.bedrooms,
            'bathrooms': self.bathrooms,
            'state': self.state,
            'city': self.city,
            'status': self.status,
            'tenure': self.tenure,
            'description': self.description,
            'agent': self.agent_name,
            'agentContact': self.agent_contact,
            'sourceUrl': self.source_url,
            'sourceWebsite': self.source_website,
            'imageUrl': self.image_url,
            'listedDate': self.listed_date.isoformat() if self.listed_date else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }

class PropertyRecommendation(db.Model):
    __tablename__ = 'property_recommendations'
    
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    expected_roi = db.Column(db.Float, nullable=False)
    rental_yield = db.Column(db.Float, nullable=False)
    rating = db.Column(db.Float, nullable=False)
    risk_level = db.Column(db.String(20), nullable=False)  # Low, Medium, High
    investment_horizon = db.Column(db.String(20), nullable=False)
    reasons = db.Column(db.JSON)  # List of reasons
    featured = db.Column(db.Boolean, default=False)
    week_start = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    property = db.relationship('Property', backref=db.backref('recommendations', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'propertyId': self.property_id,
            'title': self.title,
            'location': self.location,
            'price': self.price,
            'expectedROI': self.expected_roi,
            'rentalYield': self.rental_yield,
            'rating': self.rating,
            'riskLevel': self.risk_level,
            'investmentHorizon': self.investment_horizon,
            'reasons': self.reasons,
            'featured': self.featured,
            'weekStart': self.week_start.isoformat() if self.week_start else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

class MarketTrend(db.Model):
    __tablename__ = 'market_trends'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    trend_value = db.Column(db.String(20), nullable=False)
    period = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # rising, falling, stable
    description = db.Column(db.Text)
    week_start = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'trend': self.trend_value,
            'period': self.period,
            'status': self.status,
            'description': self.description,
            'weekStart': self.week_start.isoformat() if self.week_start else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

