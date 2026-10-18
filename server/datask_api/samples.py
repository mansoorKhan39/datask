"""A built-in sample dataset so people can try the product without uploading anything."""
import csv
import io
import random
from datetime import date, timedelta

CITIES = [("Karachi", 1.0), ("Lahore", 0.9), ("Islamabad", 0.6), ("Faisalabad", 0.4), ("Peshawar", 0.35), ("Multan", 0.3), ("Quetta", 0.2)]
CATEGORIES = {
    "Electronics": [("Earbuds", 4500), ("Power bank", 3200), ("Smart watch", 9800), ("Bluetooth speaker", 5400)],
    "Fashion": [("Lawn suit", 5200), ("Kurta", 3600), ("Sneakers", 6800), ("Shawl", 4100)],
    "Grocery": [("Basmati rice 5kg", 1850), ("Cooking oil 5L", 3300), ("Tea 900g", 1750), ("Dates box", 1500)],
    "Home": [("Bedsheet set", 4200), ("Table lamp", 2600), ("Cookware set", 7900)],
    "Beauty": [("Face wash", 950), ("Perfume", 5800), ("Hair oil", 700)],
}
PAYMENTS = ["Cash on delivery", "Card", "JazzCash", "Easypaisa", "Bank transfer"]


def sales_csv(today: date | None = None) -> bytes:
    """About 1,500 orders over the 12 months up to yesterday. Seeded, so it is the same every time."""
    today = today or date.today()
    rnd = random.Random(42)
    start = today - timedelta(days=365)
    weights = [w for _, w in CITIES]
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["order_id", "order_date", "city", "category", "product", "quantity", "unit_price", "sales", "payment_method", "customer_type"])
    for i in range(1, 1501):
        d = start + timedelta(days=int((rnd.random() ** 0.9) * 364))
        city = rnd.choices([c for c, _ in CITIES], weights)[0]
        cat = rnd.choice(list(CATEGORIES))
        product, base = rnd.choice(CATEGORIES[cat])
        # a little seasonality: more fashion before Eid-like peaks, more electronics in the last quarter
        price = round(base * rnd.uniform(0.9, 1.15), -1)
        qty = rnd.choices([1, 2, 3, 4], [0.6, 0.25, 0.1, 0.05])[0]
        w.writerow([f"ORD-{10000 + i}", d.isoformat(), city, cat, product, qty, int(price), int(price) * qty,
                    rnd.choices(PAYMENTS, [0.38, 0.22, 0.17, 0.13, 0.10])[0], rnd.choices(["New", "Returning"], [0.4, 0.6])[0]])
    return out.getvalue().encode("utf-8")
