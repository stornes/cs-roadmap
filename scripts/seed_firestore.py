import json
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Initialize Firebase Admin using Application Default Credentials
firebase_admin.initialize_app(options={'projectId': 'cs-roadmap-p-940d50'})
db = firestore.client()

# Load roadmap data
with open("seed/Customer Systems Roadmap H2 2026 - roadmap.json", "r", encoding="utf-8") as f:
    roadmap_data = json.load(f)

cycle_id = "2026-H2"

def seed_db():
    print("Seeding cycle...")
    # 1. Create Cycle
    db.collection("cycles").document(cycle_id).set({
        "title": roadmap_data["meta"]["title"],
        "owner": roadmap_data["meta"]["owner"],
        "status": "active",
        "built": roadmap_data["meta"]["built"],
        "principle": roadmap_data["meta"]["principle"],
        "assumptions": roadmap_data["meta"]["assumptions"]
    })

    print("Seeding streams...")
    # 2. Create Streams
    for s in roadmap_data["streams"]:
        db.collection("streams").document(s["id"]).set({
            "cycleId": cycle_id,
            "name": s["name"],
            "lead": s["lead"],
            "leadOnTop": s["leadOnTop"],
            "deliveryICs": s["deliveryICs"],
            "capacityByMonth": s["capacityByMonth"],
            "baUFloorByMonth": s["baUFloorByMonth"],
            "position": s["position"],
            "holidayMonths": s.get("holidayMonths", ["Jul"])
        })

    print("Seeding people...")
    # 3. Create People
    for p in roadmap_data["people"]:
        db.collection("people").document(p["id"]).set({
            "cycleId": cycle_id,
            "name": p["name"],
            "role": p["role"],
            "stream": p["stream"],
            "isDelivery": p["isDelivery"],
            "fteFactor": p["fteFactor"],
            "note": p.get("note", ""),
            "locked": p.get("locked", "")
        })

    print("Seeding initiatives...")
    # 4. Create Initiatives
    for init in roadmap_data["initiatives"]:
        db.collection("initiatives").document(init["id"]).set({
            "cycleId": cycle_id,
            "name": init["name"],
            "stream": init["stream"],
            "priority": init["priority"],
            "status": init["status"],
            "horizon": init["horizon"],
            "lead": init["lead"],
            "notes": init.get("notes", ""),
            "source": init.get("source", ""),
            "dependencies": init.get("dependencies", [])
        })

    print("Seeding conflicts...")
    # 5. Create Conflicts
    for c in roadmap_data["conflicts"]:
        db.collection("conflicts").document(str(c["id"])).set({
            "cycleId": cycle_id,
            "title": c["title"],
            "tension": c["tension"],
            "recommendation": c["recommendation"],
            "owner": c["owner"],
            "status": c["status"]
        })

    print("Seeding milestones...")
    # 6. Create Milestones
    for m in roadmap_data["milestones"]:
        db.collection("milestones").document(m["id"]).set({
            "cycleId": cycle_id,
            "name": m["name"],
            "date": m["date"],
            "initiativeId": m["initiative"]
        })

    print("Generating and seeding allocations...")
    # 7. Flat Allocations
    # We parse the resourceAllocation and map assignments to initiatives to save as atomic facts
    allocations_count = 0
    months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    # Initiative mappings for name aliases
    label_to_init = {
        "ARM": "H2-11", "ARM close": "H2-11", "ARM assist": "H2-11", "ARM assist + Ph2": "H2-11", "ARM close + Ph2": "H2-11",
        "Dedupe": "H2-25", "Dedupe lead": "H2-25", "Dedupe assist": "H2-25", "Dedupe + Ph2": "H2-25",
        "Ph2": "H2-09", "Ph2 prep": "H2-09", "Ph2 delivery": "H2-09", "Ph2 delivery (back)": "H2-09",
        "IROPS/B2B": "H2-26", "IROPS": "H2-26",
        "Partner API": "H2-22", "Partner API v2": "H2-22",
        "Bynder": "H2-21",
        "Seaware OCI": "H2-24",
        "Agent portal": "H2-03",
        "B2X": "B2X", "B2X Initiatives (backend support)": "B2X", "Commission x2 + B2X": "B2X",
        "SF init support": "SF-sup",
        "Swiss migration": "WS3",
        "Commission": "H2-20",
        "BaU/platform": "H2-23",
        "Segmentation": "H2-17",
        "Travel Docs": "H2-18", "Travel Docs + TrustPilot": "H2-18", "Travel Docs + VoC": "H2-18",
        "TrustPilot": "H2-16",
        "Consent/Pref Centre": "H2-07", "Consent/Pref + AirPort": "H2-07",
        "Compass + VoC + Support": "H2-17", "Compass + TrustPilot + Support": "H2-17", "Compass + Support": "H2-17", "Compass + Consent design + Support": "H2-17",
        "AirPort": "H2-12",
        "Commission x2": "H2-20",
        "Compass": "H2-17",
        "Consent design": "H2-07",
        "Consent/Pref": "H2-07",
        "DC assist": "H2-17",
        "QA": "H2-23",
        "SFS/Fidelio": "H2-05",
        "Seg": "H2-17",
        "Support": "H2-17",
        "VoC": "H2-17"
    }

    for stream_id, val in roadmap_data["resourceAllocation"].items():
        if stream_id == "B":
            # Seed Kev's roadmap directly using the correct allocations
            print("Seeding Stream B allocations (Kev's roadmap)...")
            stream_b_allocations = [
                # July (Total: 4.0 FTE)
                {"personId": "ismail", "initiativeId": "H2-18", "month": "Jul", "fte": 0.5},
                {"personId": "ismail", "initiativeId": "H2-16", "month": "Jul", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-18", "month": "Jul", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-17", "month": "Jul", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-17", "month": "Jul", "fte": 1.25},
                {"personId": "borrowed_dc", "initiativeId": "H2-30", "month": "Jul", "fte": 0.25},
                {"personId": "borrowed_dc", "initiativeId": "H2-23", "month": "Jul", "fte": 0.5},

                # August (Total: 4.0 FTE)
                {"personId": "ismail", "initiativeId": "H2-18", "month": "Aug", "fte": 0.5},
                {"personId": "ismail", "initiativeId": "H2-16", "month": "Aug", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-16", "month": "Aug", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-17", "month": "Aug", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-18", "month": "Aug", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-17", "month": "Aug", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-17", "month": "Aug", "fte": 0.25},
                {"personId": "borrowed_dc", "initiativeId": "H2-11", "month": "Aug", "fte": 0.25},
                {"personId": "borrowed_dc", "initiativeId": "H2-23", "month": "Aug", "fte": 0.5},

                # September (Total: 3.75 FTE)
                {"personId": "ismail", "initiativeId": "H2-18", "month": "Sep", "fte": 0.5},
                {"personId": "ismail", "initiativeId": "H2-16", "month": "Sep", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-17", "month": "Sep", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-11", "month": "Sep", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-17", "month": "Sep", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-11", "month": "Sep", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-17", "month": "Sep", "fte": 0.25},
                {"personId": "borrowed_dc", "initiativeId": "H2-23", "month": "Sep", "fte": 0.5},

                # October (Total: 4.0 FTE)
                {"personId": "ismail", "initiativeId": "H2-18", "month": "Oct", "fte": 0.5},
                {"personId": "ismail", "initiativeId": "H2-16", "month": "Oct", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-17", "month": "Oct", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-25", "month": "Oct", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-11", "month": "Oct", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-25", "month": "Oct", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-11", "month": "Oct", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-23", "month": "Oct", "fte": 0.5},

                # November (Total: 4.5 FTE)
                {"personId": "ismail", "initiativeId": "H2-16", "month": "Nov", "fte": 0.5},
                {"personId": "ismail", "initiativeId": "H2-07", "month": "Nov", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-17", "month": "Nov", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-10", "month": "Nov", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-25", "month": "Nov", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-07", "month": "Nov", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-25", "month": "Nov", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-10", "month": "Nov", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-23", "month": "Nov", "fte": 0.5},

                # December (Total: 3.25 FTE)
                {"personId": "ismail", "initiativeId": "H2-16", "month": "Dec", "fte": 0.5},
                {"personId": "ismail", "initiativeId": "H2-07", "month": "Dec", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-17", "month": "Dec", "fte": 0.5},
                {"personId": "guljar", "initiativeId": "H2-10", "month": "Dec", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-07", "month": "Dec", "fte": 0.5},
                {"personId": "kev", "initiativeId": "H2-10", "month": "Dec", "fte": 0.5},
                {"personId": "borrowed_dc", "initiativeId": "H2-12", "month": "Dec", "fte": 0.25}
            ]
            for a in stream_b_allocations:
                alloc_id = f"{a['personId']}_{a['initiativeId']}_{a['month']}"
                db.collection("allocations").document(alloc_id).set({
                    "cycleId": cycle_id,
                    "personId": a["personId"],
                    "initiativeId": a["initiativeId"],
                    "month": a["month"],
                    "fte": a["fte"]
                })
                allocations_count += 1
            continue

        if stream_id == "C":
            # Seed updated Backend (Stream C) directly using the correct allocations
            print("Seeding Stream C allocations (updated Backend roadmap)...")
            stream_c_allocations = [
                # July
                {"personId": "jyhe", "initiativeId": "H2-22", "month": "Jul", "fte": 1.0},
                {"personId": "lasse", "initiativeId": "H2-22", "month": "Jul", "fte": 0.5},
                {"personId": "lasse", "initiativeId": "H2-23", "month": "Jul", "fte": 0.5},
                {"personId": "sylwester", "initiativeId": "H2-03", "month": "Jul", "fte": 1.0},
                {"personId": "darren", "initiativeId": "H2-23", "month": "Jul", "fte": 0.25},
                {"personId": "halvor", "initiativeId": "H2-23", "month": "Jul", "fte": 0.5},
                {"personId": "ove", "initiativeId": "H2-23", "month": "Jul", "fte": 0.5},
                {"personId": "darren", "initiativeId": "H2-20", "month": "Jul", "fte": 0.5},
                {"personId": "halvor", "initiativeId": "H2-20", "month": "Jul", "fte": 0.5},
                {"personId": "kirill", "initiativeId": "H2-23", "month": "Jul", "fte": 1.0},

                # August
                {"personId": "jyhe", "initiativeId": "H2-22", "month": "Aug", "fte": 1.0},
                {"personId": "lasse", "initiativeId": "H2-21", "month": "Aug", "fte": 0.5},
                {"personId": "lasse", "initiativeId": "H2-23", "month": "Aug", "fte": 0.5},
                {"personId": "jonas", "initiativeId": "H2-24", "month": "Aug", "fte": 1.0},
                {"personId": "kato", "initiativeId": "H2-24", "month": "Aug", "fte": 1.0},
                {"personId": "oyvind", "initiativeId": "H2-24", "month": "Aug", "fte": 1.0},
                {"personId": "erik", "initiativeId": "B2X", "month": "Aug", "fte": 1.0},
                {"personId": "darren", "initiativeId": "WS3", "month": "Aug", "fte": 1.0},
                {"personId": "halvor", "initiativeId": "H2-23", "month": "Aug", "fte": 0.5},
                {"personId": "ove", "initiativeId": "H2-23", "month": "Aug", "fte": 0.5},
                {"personId": "sylwester", "initiativeId": "H2-23", "month": "Aug", "fte": 0.5},
                {"personId": "halvor", "initiativeId": "H2-20", "month": "Aug", "fte": 0.5},
                {"personId": "sylwester", "initiativeId": "H2-20", "month": "Aug", "fte": 0.5},
                {"personId": "kirill", "initiativeId": "H2-23", "month": "Aug", "fte": 1.0},

                # September
                {"personId": "jyhe", "initiativeId": "H2-22", "month": "Sep", "fte": 1.0},
                {"personId": "lasse", "initiativeId": "SF-sup", "month": "Sep", "fte": 1.0},
                {"personId": "jonas", "initiativeId": "H2-05", "month": "Sep", "fte": 1.0},
                {"personId": "kato", "initiativeId": "H2-05", "month": "Sep", "fte": 1.0},
                {"personId": "oyvind", "initiativeId": "H2-05", "month": "Sep", "fte": 1.0},
                {"personId": "erik", "initiativeId": "B2X", "month": "Sep", "fte": 1.0},
                {"personId": "sylwester", "initiativeId": "H2-03", "month": "Sep", "fte": 1.0},
                {"personId": "darren", "initiativeId": "H2-23", "month": "Sep", "fte": 0.5},
                {"personId": "halvor", "initiativeId": "H2-23", "month": "Sep", "fte": 0.5},
                {"personId": "ove", "initiativeId": "H2-23", "month": "Sep", "fte": 0.5},
                {"personId": "kirill", "initiativeId": "H2-23", "month": "Sep", "fte": 1.0},

                # October
                {"personId": "jyhe", "initiativeId": "H2-22", "month": "Oct", "fte": 1.0},
                {"personId": "lasse", "initiativeId": "SF-sup", "month": "Oct", "fte": 1.0},
                {"personId": "jonas", "initiativeId": "H2-20", "month": "Oct", "fte": 1.0},
                {"personId": "kato", "initiativeId": "H2-20", "month": "Oct", "fte": 1.0},
                {"personId": "erik", "initiativeId": "B2X", "month": "Oct", "fte": 1.0},
                {"personId": "darren", "initiativeId": "H2-23", "month": "Oct", "fte": 0.5},
                {"personId": "halvor", "initiativeId": "H2-23", "month": "Oct", "fte": 0.5},
                {"personId": "ove", "initiativeId": "H2-23", "month": "Oct", "fte": 0.5},
                {"personId": "sylwester", "initiativeId": "H2-23", "month": "Oct", "fte": 0.5},
                {"personId": "kirill", "initiativeId": "H2-23", "month": "Oct", "fte": 1.0},

                # November
                {"personId": "jyhe", "initiativeId": "H2-22", "month": "Nov", "fte": 1.0},
                {"personId": "lasse", "initiativeId": "SF-sup", "month": "Nov", "fte": 1.0},
                {"personId": "erik", "initiativeId": "B2X", "month": "Nov", "fte": 1.0},
                {"personId": "darren", "initiativeId": "H2-23", "month": "Nov", "fte": 0.5},
                {"personId": "halvor", "initiativeId": "H2-23", "month": "Nov", "fte": 0.5},
                {"personId": "ove", "initiativeId": "H2-23", "month": "Nov", "fte": 0.5},
                {"personId": "sylwester", "initiativeId": "H2-23", "month": "Nov", "fte": 0.5},
                {"personId": "kirill", "initiativeId": "H2-23", "month": "Nov", "fte": 1.0},

                # December
                {"personId": "jyhe", "initiativeId": "H2-22", "month": "Dec", "fte": 1.0},
                {"personId": "lasse", "initiativeId": "SF-sup", "month": "Dec", "fte": 1.0},
                {"personId": "erik", "initiativeId": "B2X", "month": "Dec", "fte": 1.0},
                {"personId": "darren", "initiativeId": "H2-23", "month": "Dec", "fte": 0.5},
                {"personId": "halvor", "initiativeId": "H2-23", "month": "Dec", "fte": 0.5},
                {"personId": "ove", "initiativeId": "H2-23", "month": "Dec", "fte": 0.5},
                {"personId": "sylwester", "initiativeId": "H2-23", "month": "Dec", "fte": 0.5},
                {"personId": "kirill", "initiativeId": "H2-23", "month": "Dec", "fte": 1.0}
            ]
            for a in stream_c_allocations:
                alloc_id = f"{a['personId']}_{a['initiativeId']}_{a['month']}"
                db.collection("allocations").document(alloc_id).set({
                    "cycleId": cycle_id,
                    "personId": a["personId"],
                    "initiativeId": a["initiativeId"],
                    "month": a["month"],
                    "fte": a["fte"]
                })
                allocations_count += 1
            continue

        for person_alloc in val["people"]:
            person_name = person_alloc["person"]
            
            # Find the person ID
            person_id = person_name.lower().split(" ")[0].replace("(should", "").replace("borrowed", "borrowed_dc")
            if "borrowed" in person_id:
                person_id = "borrowed_dc"
            elif person_id in ["natasa", "nataša"]:
                person_id = "natasa"
            elif person_id == "halvor":
                person_id = "ove" # Halvor / Ove (50%) shares key
            
            if "fteByMonth" in person_alloc:
                # Borrowed resource
                for m in months:
                    fte = person_alloc["fteByMonth"][m]
                    if fte > 0:
                        alloc_id = f"{person_id}_gap_{m}"
                        db.collection("allocations").document(alloc_id).set({
                            "cycleId": cycle_id,
                            "personId": person_id,
                            "initiativeId": "H2-17", # default to CRM segmentation
                            "month": m,
                            "fte": fte
                        })
                        allocations_count += 1
            elif "byMonth" in person_alloc:
                for m in months:
                    label = person_alloc["byMonth"][m]
                    if label not in ["-", "out", "out — holiday"]:
                        init_id = label_to_init.get(label, "H2-23") # default to BAU if not matched
                        
                        # Calculate fte. If split (e.g. "ARM assist + Ph2"), we allocate 0.5 to each
                        # If the person is a delivery IC in Stream A, we scale down (0.4 instead of 0.5) to cap at 0.8 total FTE
                        stream_a_people = ["pawel", "natasa", "miranda", "arthur"]
                        is_stream_a = person_id in stream_a_people

                        if "+" in label:
                            parts = [p.strip() for p in label.split("+")]
                            for part in parts:
                                part_init = label_to_init.get(part, "H2-23")
                                alloc_id = f"{person_id}_{part_init}_{m}"
                                db.collection("allocations").document(alloc_id).set({
                                    "cycleId": cycle_id,
                                    "personId": person_id,
                                    "initiativeId": part_init,
                                    "month": m,
                                    "fte": 0.4 if is_stream_a else 0.5
                                })
                                allocations_count += 1
                        else:
                            alloc_id = f"{person_id}_{init_id}_{m}"
                            db.collection("allocations").document(alloc_id).set({
                                    "cycleId": cycle_id,
                                    "personId": person_id,
                                    "initiativeId": init_id,
                                    "month": m,
                                    "fte": 0.8 if is_stream_a else (1.0 if person_id != "ove" else 0.5)
                            })
                            allocations_count += 1

    print(f"Allocations seeded: {allocations_count}")

    print("Seeding reality trees...")
    # 8. Seed Trees (CRT and FRT)
    # Current Reality Tree
    crt_nodes = [
        {"id": "crt_r1", "code": "RC1", "label": "July Norwegian Holiday halts all delivery", "type": "root_cause", "x": 100, "y": 600},
        {"id": "crt_r2", "code": "RC2", "label": "Only 2.4 FTE active delivery capacity on Salesforce Core", "type": "root_cause", "x": 350, "y": 600},
        {"id": "crt_r3", "code": "RC3", "label": "No dedicated Data Engineer on CRM team", "type": "root_cause", "x": 600, "y": 600},
        
        {"id": "crt_c1", "code": "C1", "label": "H2 compressed timeline", "type": "contributing_effect", "x": 100, "y": 450},
        {"id": "crt_c2", "code": "C2", "label": "ARM ownership split between Core & CRM", "type": "contributing_effect", "x": 350, "y": 450},
        
        {"id": "crt_u1", "code": "UDE1", "label": "Booking Solutions overloaded in Sep (-2 FTE)", "type": "undesirable_effect", "x": 100, "y": 250},
        {"id": "crt_u2", "code": "UDE2", "label": "My Account (H2-30) blocked by Dedupe (H2-25) delay", "type": "undesirable_effect", "x": 350, "y": 250},
        {"id": "crt_u3", "code": "UDE3", "label": "CRM PO role displaced due to resourcing gaps", "type": "undesirable_effect", "x": 600, "y": 250},
        
        {"id": "crt_p1", "code": "P1", "label": "SteerCo plan is scoping doc rather than execution plan", "type": "core_problem", "x": 350, "y": 100}
    ]
    crt_edges = [
        {"id": "crt_e1", "source": "crt_r1", "target": "crt_c1"},
        {"id": "crt_e2", "source": "crt_r2", "target": "crt_c2"},
        {"id": "crt_e3", "source": "crt_c1", "target": "crt_u1"},
        {"id": "crt_e4", "source": "crt_c2", "target": "crt_u2"},
        {"id": "crt_e5", "source": "crt_r3", "target": "crt_u3"},
        {"id": "crt_e6", "source": "crt_u1", "target": "crt_p1"},
        {"id": "crt_e7", "source": "crt_u2", "target": "crt_p1"},
        {"id": "crt_e8", "source": "crt_u3", "target": "crt_p1"}
    ]
    db.collection("trees").document("CRT").set({
        "cycleId": cycle_id,
        "kind": "CRT",
        "nodes": crt_nodes,
        "edges": crt_edges
    })

    # Future Reality Tree
    frt_nodes = [
        {"id": "frt_i1", "code": "INJ1", "label": "Approve and hire dedicated CRM Data Engineer", "type": "injection", "x": 100, "y": 600},
        {"id": "frt_i2", "code": "INJ2", "label": "Shift flexible work (Swiss, Commission) to Nov/Dec", "type": "injection", "x": 350, "y": 600},
        {"id": "frt_i3", "code": "INJ3", "label": "Establish single owner for ARM integration", "type": "injection", "x": 600, "y": 600},
        
        {"id": "frt_e1", "code": "E1", "label": "CRM PO is freed from delivery tasks", "type": "effect", "x": 100, "y": 450},
        {"id": "frt_e2", "code": "E2", "label": "Booking Solutions September load under capacity limit", "type": "effect", "x": 350, "y": 450},
        {"id": "frt_e3", "code": "E3", "label": "ARM resolves on time, unblocking Dedupe", "type": "effect", "x": 600, "y": 450},
        
        {"id": "frt_d1", "code": "DE1", "label": "Roadmap commitments fully resourced", "type": "desired_effect", "x": 350, "y": 250},
        {"id": "frt_d2", "code": "DE2", "label": "Active capacity headroom in all streams", "type": "desired_effect", "x": 600, "y": 250},
        
        {"id": "frt_o1", "code": "OUT1", "label": "Successful, stress-free H2 2026 delivery", "type": "desired_effect", "x": 350, "y": 100}
    ]
    frt_edges = [
        {"id": "frt_e1", "source": "frt_i1", "target": "frt_e1"},
        {"id": "frt_e2", "source": "frt_i2", "target": "frt_e2"},
        {"id": "frt_e3", "source": "frt_i3", "target": "frt_e3"},
        {"id": "frt_e4", "source": "frt_e1", "target": "frt_d1"},
        {"id": "frt_e5", "source": "frt_e2", "target": "frt_d1"},
        {"id": "frt_e6", "source": "frt_e3", "target": "frt_d2"},
        {"id": "frt_e7", "source": "frt_d1", "target": "frt_o1"},
        {"id": "frt_e8", "source": "frt_d2", "target": "frt_o1"}
    ]
    db.collection("trees").document("FRT").set({
        "cycleId": cycle_id,
        "kind": "FRT",
        "nodes": frt_nodes,
        "edges": frt_edges
    })
    
    print("Done seeding Firestore!")

if __name__ == "__main__":
    seed_db()
