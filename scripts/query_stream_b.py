import firebase_admin
from firebase_admin import firestore

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': 'cs-roadmap-p-940d50'})
db = firestore.client()

# Stream B initiatives
stream_b_inits = ["H2-18", "H2-17", "H2-16", "H2-07", "H2-10", "H2-12", "H2-13", "H2-14"]
months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Get all allocations
docs = db.collection("allocations").where("cycleId", "==", "2026-H2").stream()

alloc_by_month = {m: [] for m in months}
for doc in docs:
    data = doc.to_dict()
    init_id = data.get("initiativeId")
    month = data.get("month")
    
    # We want to see allocations for people in Stream B (guljar, ismail, kev, and borrowed_dc)
    person_id = data.get("personId")
    if person_id in ["guljar", "ismail", "kev", "borrowed_dc"] and month in months:
        data["id"] = doc.id
        alloc_by_month[month].append(data)

# Print totals and details for each month
for m in months:
    print(f"\n--- {m} ---")
    total_fte = 0.0
    for a in sorted(alloc_by_month[m], key=lambda x: (x.get("personId"), x.get("initiativeId"))):
        print(f"  Person: {a['personId']:<15} | Init: {a['initiativeId']:<8} | FTE: {a['fte']}")
        total_fte += a['fte']
    print(f"Total FTE for {m}: {total_fte:.2f}")
