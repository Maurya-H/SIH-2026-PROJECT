import random

# Categories your system supports
CATEGORIES = ["waterlogging", "pothole", "fallen_tree", "other"]


def classify_image(photo_url: str) -> dict:
    """
    Classifies an uploaded photo into one of the incident categories.

    MVP placeholder: returns a random category with a fake confidence score.
    Replace this with a real call to a pretrained model or API
    (e.g. a vision API, or a small pretrained image classifier)
    before the demo.

    Keep the same return shape so nothing else needs to change:
    { "category": str, "confidence": float }
    """
    # --- Placeholder logic (remove once real model/API is wired in) ---
    category = random.choice(CATEGORIES)
    confidence = round(random.uniform(0.7, 0.95), 2)
    # --------------------------------------------------------------

    return {
        "category": category,
        "confidence": confidence,
    }


def classify_with_fallback(photo_url: str) -> dict:
    """
    Wrapper that tries the real classifier and falls back to a safe
    default if it fails — useful for Day 5's 'backup AI response in
    case live API fails' requirement.
    """
    try:
        return classify_image(photo_url)
    except Exception:
        return {"category": "other", "confidence": 0.5}