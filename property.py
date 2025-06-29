from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.property import Property, PropertyRecommendation, MarketTrend
from datetime import datetime, date, timedelta
import json

property_bp = Blueprint('property', __name__)

@property_bp.route('/properties', methods=['GET'])
def get_properties():
    """Get all properties with optional filtering"""
    try:
        # Get query parameters
        search = request.args.get('search', '')
        property_type = request.args.get('type', '')
        state = request.args.get('state', '')
        city = request.args.get('city', '')
        status = request.args.get('status', '')
        min_price = request.args.get('min_price', type=int)
        max_price = request.args.get('max_price', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Build query
        query = Property.query
        
        # Apply filters
        if search:
            query = query.filter(
                db.or_(
                    Property.title.ilike(f'%{search}%'),
                    Property.city.ilike(f'%{search}%'),
                    Property.state.ilike(f'%{search}%'),
                    Property.description.ilike(f'%{search}%')
                )
            )
        
        if property_type and property_type != 'all':
            query = query.filter(Property.property_type == property_type)
        
        if state and state != 'all':
            query = query.filter(Property.state == state)
        
        if city and city != 'all':
            query = query.filter(Property.city == city)
        
        if status and status != 'all':
            query = query.filter(Property.status == status)
        
        if min_price:
            query = query.filter(Property.price >= min_price)
        
        if max_price:
            query = query.filter(Property.price <= max_price)
        
        # Order by created date (newest first)
        query = query.order_by(Property.created_at.desc())
        
        # Paginate
        pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        properties = [prop.to_dict() for prop in pagination.items]
        
        return jsonify({
            'success': True,
            'data': properties,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@property_bp.route('/properties/<int:property_id>', methods=['GET'])
def get_property(property_id):
    """Get a single property by ID"""
    try:
        property_obj = Property.query.get_or_404(property_id)
        return jsonify({
            'success': True,
            'data': property_obj.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@property_bp.route('/properties', methods=['POST'])
def create_property():
    """Create a new property listing"""
    try:
        data = request.get_json()
        
        property_obj = Property(
            title=data.get('title'),
            property_type=data.get('type'),
            price=data.get('price'),
            size=data.get('size'),
            size_unit=data.get('sizeUnit', 'sq ft'),
            bedrooms=data.get('bedrooms'),
            bathrooms=data.get('bathrooms'),
            state=data.get('state'),
            city=data.get('city'),
            status=data.get('status'),
            tenure=data.get('tenure'),
            description=data.get('description'),
            agent_name=data.get('agent'),
            agent_contact=data.get('agentContact'),
            source_url=data.get('sourceUrl'),
            source_website=data.get('sourceWebsite'),
            image_url=data.get('imageUrl')
        )
        
        db.session.add(property_obj)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': property_obj.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@property_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Get weekly property recommendations"""
    try:
        week_start = request.args.get('week_start')
        if week_start:
            week_start = datetime.strptime(week_start, '%Y-%m-%d').date()
        else:
            # Get current week's recommendations
            today = date.today()
            week_start = today - datetime.timedelta(days=today.weekday())
        
        recommendations = PropertyRecommendation.query.filter(
            PropertyRecommendation.week_start == week_start
        ).order_by(
            PropertyRecommendation.featured.desc(),
            PropertyRecommendation.rating.desc()
        ).all()
        
        return jsonify({
            'success': True,
            'data': [rec.to_dict() for rec in recommendations],
            'week_start': week_start.isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@property_bp.route('/market-trends', methods=['GET'])
def get_market_trends():
    """Get current market trends"""
    try:
        week_start = request.args.get('week_start')
        if week_start:
            week_start = datetime.strptime(week_start, '%Y-%m-%d').date()
        else:
            # Get current week's trends
            today = date.today()
            week_start = today - datetime.timedelta(days=today.weekday())
        
        trends = MarketTrend.query.filter(
            MarketTrend.week_start == week_start
        ).all()
        
        return jsonify({
            'success': True,
            'data': [trend.to_dict() for trend in trends],
            'week_start': week_start.isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@property_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get general statistics"""
    try:
        total_properties = Property.query.count()
        
        # Properties by state
        state_stats = db.session.query(
            Property.state, 
            db.func.count(Property.id).label('count')
        ).group_by(Property.state).all()
        
        # Properties by type
        type_stats = db.session.query(
            Property.property_type, 
            db.func.count(Property.id).label('count')
        ).group_by(Property.property_type).all()
        
        # Average price by state
        price_stats = db.session.query(
            Property.state,
            db.func.avg(Property.price).label('avg_price'),
            db.func.min(Property.price).label('min_price'),
            db.func.max(Property.price).label('max_price')
        ).group_by(Property.state).all()
        
        return jsonify({
            'success': True,
            'data': {
                'total_properties': total_properties,
                'by_state': [{'state': stat.state, 'count': stat.count} for stat in state_stats],
                'by_type': [{'type': stat.property_type, 'count': stat.count} for stat in type_stats],
                'price_by_state': [{
                    'state': stat.state,
                    'avg_price': float(stat.avg_price) if stat.avg_price else 0,
                    'min_price': stat.min_price,
                    'max_price': stat.max_price
                } for stat in price_stats]
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

