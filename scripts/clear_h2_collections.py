import firebase_admin
from firebase_admin import firestore

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': 'cs-roadmap-p-940d50'})
db = firestore.client()

collections = ["cycles", "streams", "people", "initiatives", "conflicts", "milestones", "allocations", "trees"]
cycle_id = "2026-H2"

for col in collections:
    print(f"Clearing collection '{col}' for cycle '{cycle_id}'...")
    docs = db.collection(col).where("cycleId", "==", cycle_id).stream()
    count = 0
    batch = db.batch()
    for doc in docs:
        batch.delete(doc.reference)
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = db.batch()
    if count % 400 != 0:
        batch.commit()
    print(f"Deleted {count} documents from '{col}'.")

# Also delete the cycle document itself if it exists
cycle_ref = db.collection("cycles").document(cycle_id)
if cycle_ref.get().exists:
    cycle_ref.delete()
    print("Deleted cycle document '2026-H2'.")

print("Cleanup complete!")
