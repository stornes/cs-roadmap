import os
import json
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load env variables from root .env
load_dotenv()

# Initialize Firebase Admin using Application Default Credentials
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': 'cs-roadmap-p-940d50'})
db = firestore.client()

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
if not NOTION_API_KEY:
    raise ValueError("NOTION_API_KEY not found in environment or .env file.")

# Headers for Notion API
headers = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

cycle_id = "2026-H2"

# Parse horizon string into concrete dates
def parse_horizon(horizon):
    h = horizon.lower()
    start, end = None, None
    if "q3" in h:
        start = "2026-07-01"
        end = "2026-09-30"
    elif "q4" in h:
        start = "2026-10-01"
        end = "2026-12-31"
    elif "h2" in h:
        start = "2026-07-01"
        end = "2026-12-31"
    elif "jul" in h:
        start = "2026-07-01"
        end = "2026-07-31"
    elif "aug" in h:
        start = "2026-08-01"
        end = "2026-08-31"
    elif "sep" in h:
        start = "2026-09-01"
        end = "2026-09-30"
    elif "oct" in h:
        start = "2026-10-01"
        end = "2026-10-31"
    elif "nov" in h:
        start = "2026-11-01"
        end = "2026-11-30"
    elif "dec" in h:
        start = "2026-12-01"
        end = "2026-12-31"
    
    # combinations
    if "jul" in h and "sep" in h:
        start = "2026-07-01"
        end = "2026-09-30"
    if "sep" in h and "oct" in h:
        start = "2026-09-01"
        end = "2026-10-31"
    if "nov" in h and "dec" in h:
        start = "2026-11-01"
        end = "2026-12-31"
    if "jul" in h and "oct" in h:
        start = "2026-07-01"
        end = "2026-10-31"
        
    return start, end

# Map Firestore status to Notion RAG status
def map_rag_status(fs_status, has_conflict=False):
    st = fs_status.lower()
    if "deferred" in st or "unscheduled" in st or "backlog" in st or "negotiable" in st:
        return "Not Started"
    
    if has_conflict:
        return "Blocked"
    
    if "committed" in st or "in h2" in st:
        return "On track"
    
    return "Not Started"

# Check if a capacity sync comment already exists on the Notion page
def check_comment_exists(page_id, headers):
    url = f"https://api.notion.com/v1/comments?block_id={page_id}"
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            comments = res.json().get("results", [])
            for comment in comments:
                rich_text_list = comment.get("rich_text", [])
                text_content = "".join([t.get("plain_text", "") for t in rich_text_list])
                if "Capacity Planner Sync Notice" in text_content:
                    return True
        else:
            print(f"  Warning: Failed to fetch comments: {res.status_code}")
    except Exception as e:
        print(f"  Warning: Error fetching comments: {e}")
    return False

# Generate the warning comment if there is a conflict or capacity issue
def get_sync_comment(fs_init_id, fs_init, has_conflict):
    if fs_init_id == "H2-30":
        return (
            "⚠️ **Capacity Planner Sync Notice**: Sille's team (*SF Sales & Service Operations*) is fully "
            "committed to *ARM*, *Dedupe*, and *Lighthouse Phase 2* during H2 2026 (with July as a holiday month). "
            "There is currently **0 FTE headroom** for *My Account MVP* in H2. Sille's team is scheduled to "
            "become available for this in **2027**.\n\n"
            f"**Local Status**: {fs_init.get('status')} | **Notes**: {fs_init.get('notes')}"
        )
    elif fs_init_id == "H2-25" and has_conflict:
        return (
            "⚠️ **Capacity Planner Sync Notice**: *Dedupe* is committed for Q3 (Sep–Oct) but faces capacity constraints "
            "due to October absences, which may slip implementation to November.\n\n"
            f"**Local Status**: {fs_init.get('status')} | **Notes**: {fs_init.get('notes')}"
        )
    elif has_conflict:
        return (
            "⚠️ **Capacity Planner Sync Notice**: This initiative has an active resource or timeline conflict "
            "in the local capacity planner.\n\n"
            f"**Local Status**: {fs_init.get('status')} | **Notes**: {fs_init.get('notes')}"
        )
    elif "deferred" in fs_init.get("status", "").lower() or "unscheduled" in fs_init.get("status", "").lower():
        return (
            "⚠️ **Capacity Planner Sync Notice**: This initiative has been deferred or unscheduled for H2 2026 due to resource allocation constraints.\n\n"
            f"**Local Status**: {fs_init.get('status')} | **Notes**: {fs_init.get('notes')}"
        )
    return None

def run_sync(dry_run=False):
    print(f"Starting Notion Roadmap sync (Dry run = {dry_run})...")
    
    # 1. Load mappings
    mapping_path = "scripts/notion_mappings.json"
    with open(mapping_path, "r") as f:
        mappings = json.load(f)
    
    # 2. Fetch Firestore initiatives and conflicts
    fs_inits = {}
    init_docs = db.collection("initiatives").where("cycleId", "==", cycle_id).stream()
    for doc in init_docs:
        fs_inits[doc.id] = doc.to_dict()
        fs_inits[doc.id]["id"] = doc.id
    
    # Check conflicts
    conflicts_docs = db.collection("conflicts").where("cycleId", "==", cycle_id).stream()
    conflict_inits = set()
    for doc in conflicts_docs:
        c = doc.to_dict()
        if c.get("status") == "active":
            # If title or description contains conflict indicator
            title = c.get("title", "").lower()
            if "my account" in title or "h2-30" in title:
                conflict_inits.add("H2-30")
            if "dedupe" in title or "h2-25" in title:
                conflict_inits.add("H2-25")
    
    print(f"Loaded {len(fs_inits)} initiatives from Firestore.")
    
    # 3. Synchronize mapped pages
    updated_count = 0
    for notion_page_id, fs_init_id in mappings.items():
        if fs_init_id not in fs_inits:
            print(f"Warning: Mapped Firestore ID {fs_init_id} not found in Firestore.")
            continue
            
        fs_init = fs_inits[fs_init_id]
        
        # Calculate RAG and Dates
        has_conflict = fs_init_id in conflict_inits
        notion_rag = map_rag_status(fs_init.get("status", ""), has_conflict)
        start_date, end_date = parse_horizon(fs_init.get("horizon", ""))
        
        # Build update payload
        properties = {
            "RAG": {
                "select": {
                    "name": notion_rag
                }
            }
        }
        
        if start_date:
            properties["Timeline"] = {
                "date": {
                    "start": start_date,
                    "end": end_date
                }
            }
        else:
            properties["Timeline"] = None
            
        print(f"Syncing local {fs_init_id} ({fs_init['name']}) -> Notion Page {notion_page_id}:")
        print(f"  RAG: {notion_rag}")
        print(f"  Timeline: {start_date} to {end_date}")
        
        # Handle Warning Comment
        comment_text = get_sync_comment(fs_init_id, fs_init, has_conflict)
        if comment_text:
            print(f"  Proposed Comment: {comment_text.splitlines()[0]}")
            if not dry_run:
                # Check if comment already exists to avoid spamming
                if not check_comment_exists(notion_page_id, headers):
                    comment_url = "https://api.notion.com/v1/comments"
                    comment_payload = {
                        "parent": { "page_id": notion_page_id },
                        "rich_text": [
                            {
                                "text": { "content": comment_text }
                            }
                        ]
                    }
                    comment_res = requests.post(comment_url, headers=headers, json=comment_payload)
                    if comment_res.status_code == 200:
                        print("  Comment posted successfully!")
                    else:
                        print(f"  Error posting comment: {comment_res.status_code} - {comment_res.text}")
                else:
                    print("  Sync comment already exists. Skipping comment post.")
        
        if not dry_run:
            url = f"https://api.notion.com/v1/pages/{notion_page_id}"
            res = requests.patch(url, headers=headers, json={"properties": properties})
            if res.status_code == 200:
                print("  Success!")
                updated_count += 1
            else:
                print(f"  Error patching Notion page: {res.status_code} - {res.text}")
        else:
            updated_count += 1

    print(f"Sync completed. Updated {updated_count} pages.")

if __name__ == "__main__":
    import sys
    dry = "--live" not in sys.argv
    run_sync(dry_run=dry)
