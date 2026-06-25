from datetime import datetime, timezone

def calculate_trust_score(
    created_at: datetime,
    verification_status: str,
    rating: float,
    total_reviews: int,
    completed_transactions: int,
    products_sold: int
) -> int:
    """
    Standardized Trust Score Calculation Algorithm
    
    Weights:
    - College Verification: 30% (30 points if APPROVED, 0 otherwise)
    - Average Rating: 20% ((rating / 5.0) * 20 if total_reviews > 0, default 12 if APPROVED, 0 otherwise)
    - Completed Transactions: 20% (min(completed_transactions * 4.0, 20.0))
    - Account Age: 20% (min(age_days / 5.0, 20.0))
    - Products Sold: 10% (min(products_sold * 2.0, 10.0))
    
    Returns a value between 0 and 100.
    """
    # 1. College Verification (30%)
    verification_points = 30.0 if verification_status == "APPROVED" else 0.0

    # 2. Average Rating (20%)
    if total_reviews > 0:
        # Scale 0.0 - 5.0 rating to 0 - 20 points
        rating_points = (rating / 5.0) * 20.0
    else:
        # If no reviews yet, give default points if verified
        rating_points = 12.0 if verification_status == "APPROVED" else 0.0

    # 3. Completed Transactions (20%)
    # Scale: 4 points per completed transaction, max 20 points (hits max at 5 transactions)
    transaction_points = min(completed_transactions * 4.0, 20.0)

    # 4. Account Age (20%)
    # Scale: 1 point per 5 days of account age, max 20 points (hits max at 100 days)
    if created_at.tzinfo is None:
        created_at_utc = created_at.replace(tzinfo=timezone.utc)
    else:
        created_at_utc = created_at.astimezone(timezone.utc)
        
    now = datetime.now(timezone.utc)
    age_days = (now - created_at_utc).days
    age_points = min(max(age_days / 5.0, 0.0), 20.0)

    # 5. Products Sold (10%)
    # Scale: 2 points per product sold, max 10 points (hits max at 5 products sold)
    sold_points = min(products_sold * 2.0, 10.0)

    total_score = verification_points + rating_points + transaction_points + age_points + sold_points
    
    # Return score between 0 and 100 rounded to the nearest integer
    return min(max(round(total_score), 0), 100)
