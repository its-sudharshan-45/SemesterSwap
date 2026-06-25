from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Dict, List, Any
from backend.app.models import User, Listing, ListingView, SearchHistory
from datetime import datetime, timezone

def get_personalized_recommendation_sections(db: Session, current_user: User) -> Dict[str, List[Listing]]:
    """
    Retrieves personalized recommendations grouped into four distinct sections:
    Recommended For You, Similar Products, Trending In Your College, and Based On Your Searches.
    """
    # 1. Fetch available listings excluding user's own
    all_available = db.query(Listing).options(
        joinedload(Listing.seller).joinedload(User.college),
        joinedload(Listing.seller).joinedload(User.department)
    ).filter(
        Listing.status == "available",
        Listing.seller_id != current_user.id
    ).all()

    if not all_available:
        return {
            "recommended_for_you": [],
            "similar_products": [],
            "trending_in_college": [],
            "based_on_searches": []
        }

    # 2. Extract views and views counts
    trending_views = db.query(
        ListingView.listing_id,
        func.count(ListingView.id).label("view_count")
    ).group_by(ListingView.listing_id).all()
    view_counts = {v.listing_id: v.view_count for v in trending_views}

    # SECTION A: Trending in college
    college_listings = [
        lst for lst in all_available 
        if lst.seller.college_id == current_user.college_id
    ]
    college_listings.sort(key=lambda x: view_counts.get(x.id, 0), reverse=True)
    trending_in_college = college_listings[:4]

    # SECTION B: Similar Products
    user_views = db.query(ListingView).filter(
        ListingView.user_id == current_user.id
    ).order_by(ListingView.created_at.desc()).limit(3).all()
    
    recent_viewed_categories = set()
    recent_viewed_ids = set()
    for view in user_views:
        recent_viewed_ids.add(view.listing_id)
        lst = db.query(Listing).filter(Listing.id == view.listing_id).first()
        if lst:
            recent_viewed_categories.add(lst.category)

    similar_products = [
        lst for lst in all_available 
        if lst.category in recent_viewed_categories and lst.id not in recent_viewed_ids
    ]
    similar_products.sort(key=lambda x: view_counts.get(x.id, 0), reverse=True)
    similar_products = similar_products[:4]
    if not similar_products:
        similar_products = [l for l in all_available if l.id not in recent_viewed_ids][:4]

    # SECTION C: Based On Your Searches
    user_searches = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).order_by(SearchHistory.created_at.desc()).limit(5).all()
    
    search_keywords = set()
    for s in user_searches:
        search_keywords.update([w.lower() for w in s.query.split() if len(w) >= 3])

    based_on_searches = []
    if search_keywords:
        for lst in all_available:
            title_words = [w.lower() for w in lst.title.split()]
            if any(kw in title_words for kw in search_keywords):
                based_on_searches.append(lst)
    based_on_searches.sort(key=lambda x: view_counts.get(x.id, 0), reverse=True)
    based_on_searches = based_on_searches[:4]
    if not based_on_searches:
        based_on_searches = all_available[:4]

    # SECTION D: Recommended For You (Personalized 2.0 scoring)
    collaborative_scores = {}
    viewed_listing_ids = {v.listing_id for v in user_views}
    if viewed_listing_ids:
        other_views = db.query(ListingView.user_id).filter(
            ListingView.listing_id.in_(list(viewed_listing_ids)),
            ListingView.user_id != current_user.id
        ).all()
        other_user_ids = {ov.user_id for ov in other_views}
        
        if other_user_ids:
            co_listings = db.query(ListingView.listing_id).filter(
                ListingView.user_id.in_(list(other_user_ids)),
                ListingView.listing_id.notin_(list(viewed_listing_ids))
            ).all()
            for col_lst in co_listings:
                lid = col_lst.listing_id
                collaborative_scores[lid] = collaborative_scores.get(lid, 0) + 4

    scored_candidates = []
    for candidate in all_available:
        category_match = candidate.category in recent_viewed_categories
        cand_title_lower = candidate.title.lower()
        cand_desc_lower = candidate.description.lower()
        matches = sum(1 for kw in search_keywords if kw in cand_title_lower or kw in cand_desc_lower)
        dept_match = current_user.department_id and candidate.seller.department_id == current_user.department_id
        
        content_raw = (3 if category_match else 0) + min(matches * 2, 6) + (2 if dept_match else 0)
        content_sub = min(float(content_raw), 10.0)
        
        co_score = collaborative_scores.get(candidate.id, 0)
        collab_sub = min(float(co_score), 10.0)
        
        trend_views = view_counts.get(candidate.id, 0)
        trending_sub = min(float(trend_views), 10.0)
        
        final_score = 0.5 * content_sub + 0.3 * collab_sub + 0.2 * trending_sub
        scored_candidates.append((final_score, candidate))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    
    recommended_for_you = []
    category_counts = {}
    for score, candidate in scored_candidates:
        cat = candidate.category
        if cat not in category_counts:
            category_counts[cat] = 0
        if category_counts[cat] < 2:
            recommended_for_you.append(candidate)
            category_counts[cat] += 1
        if len(recommended_for_you) >= 4:
            break

    return {
        "recommended_for_you": recommended_for_you,
        "similar_products": similar_products,
        "trending_in_college": trending_in_college,
        "based_on_searches": based_on_searches
    }
