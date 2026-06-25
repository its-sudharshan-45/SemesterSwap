from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, Any
from backend.app.models import Listing, ListingView, Conversation, Wishlist, Message

def get_seller_insights(db: Session, product_id: UUID) -> Dict[str, Any]:
    """
    Retrieves seller analytics metrics (views, chats, wishlists, response times)
    and estimates listing selling probability along with suggestions.
    """
    listing = db.query(Listing).filter(Listing.id == product_id).first()
    if not listing:
        return {}

    views = db.query(ListingView).filter(ListingView.listing_id == product_id).count()
    chats = db.query(Conversation).filter(Conversation.product_id == product_id).count()
    wishlist = db.query(Wishlist).filter(Wishlist.listing_id == product_id).count()

    # Calculate conversion rate (chats / views)
    conversion_rate = (chats / views * 100.0) if views > 0 else 0.0

    # Calculate average seller response time in minutes
    conversations = db.query(Conversation).filter(Conversation.product_id == product_id).all()
    response_times = []
    
    for conv in conversations:
        # Find first buyer message
        first_buyer_msg = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id == conv.buyer_id
        ).order_by(Message.created_at.asc()).first()
        
        if first_buyer_msg:
            # Find first seller response
            first_seller_resp = db.query(Message).filter(
                Message.conversation_id == conv.id,
                Message.sender_id == conv.seller_id,
                Message.created_at > first_buyer_msg.created_at
            ).order_by(Message.created_at.asc()).first()
            
            if first_seller_resp:
                diff = (first_seller_resp.created_at - first_buyer_msg.created_at).total_seconds()
                response_times.append(diff / 60.0)
                
    avg_response_time = sum(response_times) / len(response_times) if response_times else 15.0

    # Calculate selling probability score
    if listing.status == "sold":
        selling_probability = 100.0
    else:
        base_prob = 15.0
        views_points = min(views * 3.0, 30.0)
        wishlist_points = min(wishlist * 12.0, 25.0)
        chats_points = min(chats * 20.0, 30.0)
        selling_probability = min(base_prob + views_points + wishlist_points + chats_points, 95.0)

    # Compile recommendations suggestions list
    suggestions = []
    if listing.status != "sold":
        if views < 5:
            suggestions.append("Listing visibility is low. Try enhancing the title using AI to include discoverable terms.")
            suggestions.append("Upload more clear, high-resolution pictures to attract interest.")
        elif chats == 0:
            suggestions.append(f"Your item has {views} views but 0 inquiries. Try lowering the price by ₹50 to attract buyers.")
            suggestions.append("Update your description with key highlights or bulleted features.")
        else:
            suggestions.append("Engagement looks healthy! Ensure you reply promptly to finalize the trade.")
            
        if len(listing.images) < 2:
            suggestions.append("Listings with 2 or more images sell 40% faster. Take a picture from another angle.")
    else:
        suggestions.append("Swap completed successfully!")

    return {
        "product_id": product_id,
        "views": views,
        "chats": chats,
        "wishlist_count": wishlist,
        "conversion_rate": round(conversion_rate, 1),
        "average_response_time": round(avg_response_time, 1),
        "selling_probability": round(selling_probability),
        "suggestions": suggestions
    }
