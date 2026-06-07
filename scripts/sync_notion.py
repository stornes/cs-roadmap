import os
import json
import re
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
# Parse horizon string into concrete dates
def parse_horizon(horizon):
    h = horizon.lower().replace("–", "-") # normalize dashes
    
    # 2027 or deferred/unscheduled
    if "2027" in h or "unscheduled" in h or "tbd" in h:
        return None, None
        
    start, end = None, None
    
    # Check for spans across Q3 and Q4
    if "q3-q4" in h or "q3 to q4" in h:
        start = "2026-07-01"
        if "nov" in h:
            end = "2026-11-30"
        else:
            end = "2026-12-31"
    elif "jul-dec" in h or "jul - dec" in h:
        start = "2026-07-01"
        end = "2026-12-31"
    elif "aug-dec" in h:
        start = "2026-08-01"
        end = "2026-12-31"
    elif "sep-dec" in h:
        start = "2026-09-01"
        end = "2026-12-31"
    elif "jul + oct" in h:
        start = "2026-07-01"
        end = "2026-10-31"
    elif "jul-oct" in h or "q3 (jul-oct)" in h:
        start = "2026-07-01"
        end = "2026-10-31"
    elif "jul-nov" in h:
        start = "2026-07-01"
        end = "2026-11-30"
    elif "sep-oct" in h:
        start = "2026-09-01"
        end = "2026-10-31"
    elif "h2" in h:
        start = "2026-07-01"
        end = "2026-12-31"
    elif "q3 scope" in h:
        start = "2026-07-01"
        end = "2026-12-31" # "Q3 scope -> Q4 full" spans both
    elif "q3" in h:
        # Check if there is an oct or nov inside the parenthesis
        if "oct" in h:
            start = "2026-07-01"
            if "nov" in h:
                end = "2026-11-30"
            else:
                end = "2026-10-31"
        elif "nov" in h:
            start = "2026-07-01"
            end = "2026-11-30"
        else:
            start = "2026-07-01"
            end = "2026-09-30"
    elif "q4" in h:
        if "nov" in h:
            start = "2026-11-01"
            end = "2026-12-31"
        else:
            start = "2026-10-01"
            end = "2026-12-31"
    elif "jul" in h and "sep" in h:
        start = "2026-07-01"
        end = "2026-09-30"
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

# Determine quarters from start and end dates
def get_quarters_from_dates(start_date, end_date):
    if not start_date or not end_date:
        return []
    quarters = []
    # Q3 2026: 2026-07-01 to 2026-09-30
    if start_date <= "2026-09-30" and end_date >= "2026-07-01":
        quarters.append("Q3 2026")
    # Q4 2026: 2026-10-01 to 2026-12-31
    if start_date <= "2026-12-31" and end_date >= "2026-10-01":
        quarters.append("Q4 2026")
    return quarters

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

# Load and parse Confluence page rows
def get_confluence_rows():
    cache_path = "scripts/confluence_backlog.json"
    if not os.path.exists(cache_path):
        print(f"Warning: Confluence cache file {cache_path} not found.")
        return []
        
    with open(cache_path, "r") as f:
        data = json.load(f)
        
    body_content = data.get("body", "")
    raw_rows = []
    current_row = []
    
    for line in body_content.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        if trimmed.startswith("|") and ("---" in trimmed or "ID" in trimmed):
            continue
        if trimmed.startswith("|") and re.match(r'^\|\s*CS-', trimmed):
            if current_row:
                raw_rows.append(" ".join(current_row))
            current_row = [trimmed]
        else:
            if current_row:
                current_row.append(trimmed)
                
    if current_row:
        raw_rows.append(" ".join(current_row))
        
    parsed_rows = []
    for r in raw_rows:
        parts = [p.strip() for p in r.split("|")]
        if parts[0] == '':
            parts = parts[1:]
        if parts[-1] == '':
            parts = parts[:-1]
        if len(parts) >= 10:
            parsed_rows.append(parts)
    return parsed_rows

# Parse Confluence description column
def parse_confluence_desc_col(text):
    text = re.sub(r'\s+', ' ', text)
    
    # Description
    desc_match = re.search(r'\*\*Description:\*\*(.*?)(?=\*\*Deliveries:\*\*|\*\*Teams:\*\*|\*\*Goal:\*\*|\*\*Success:\*\*|$)', text)
    description = desc_match.group(1).strip() if desc_match else ""
    
    # Deliveries
    deliveries_match = re.search(r'\*\*Deliveries:\*\*(.*?)(?=\*\*Teams:\*\*|\*\*Goal:\*\*|\*\*Success:\*\*|$)', text)
    deliveries = deliveries_match.group(1).strip() if deliveries_match else ""
    
    # Success (OKRs)
    success_match = re.search(r'\*\*Success:\*\*(.*?)$', text)
    success = success_match.group(1).strip() if success_match else ""
    
    # Format success as 3 Key Results
    key_results = []
    if success:
        delimiters = [";", ","]
        parts = []
        for delim in delimiters:
            temp_parts = [p.strip() for p in success.split(delim) if p.strip()]
            if len(temp_parts) >= 2:
                parts = temp_parts
                break
        if not parts:
            parts = [success]
            
        for i, part in enumerate(parts[:3]):
            clean_part = re.sub(r'^\d+[\.\)\s\-]+', '', part).strip()
            if clean_part:
                clean_part = clean_part[0].upper() + clean_part[1:]
                key_results.append(f"{i+1}. {clean_part}")
                
    formatted_success = "\n".join(key_results) if key_results else success
    
    return {
        "description": description,
        "deliveries": deliveries,
        "success": formatted_success
    }

# Match Firestore ID/Name to Confluence Row
def match_firestore_to_confluence(fs_id, fs_name, confluence_rows):
    # Try numeric match (e.g. H2-30 -> 30, CS-26-H2-30 -> 30)
    fs_num_match = re.search(r'\d+$', fs_id)
    if fs_num_match:
        fs_num = int(fs_num_match.group(0))
        for row in confluence_rows:
            c_id = row[0]
            c_num_match = re.search(r'\d+$', c_id)
            if c_num_match:
                c_num = int(c_num_match.group(0))
                if c_num == fs_num:
                    return row
                    
    # Fallback: String similarity
    from difflib import SequenceMatcher
    best_row = None
    best_ratio = 0.0
    for row in confluence_rows:
        c_name = row[1]
        ratio = SequenceMatcher(None, fs_name.lower(), c_name.lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_row = row
            
    if best_ratio > 0.6:
        return best_row
        
    return None
# Load critical path IDs from src/components/CriticalPathTab.tsx
def get_critical_path_ids():
    tab_path = "src/components/CriticalPathTab.tsx"
    if not os.path.exists(tab_path):
        tab_path = "../src/components/CriticalPathTab.tsx"
    if not os.path.exists(tab_path):
        print("Warning: CriticalPathTab.tsx not found, not filtering by critical path.")
        return None
    with open(tab_path, "r") as f:
        content = f.read()
    ids = re.findall(r"id:\s*['\"]([^'\"]+)['\"]", content)
    return set(ids)

def run_sync(dry_run=False, only_id=None):
    print(f"Starting Notion Roadmap sync (Dry run = {dry_run})...")
    
    # 1. Load mappings
    mapping_path = "scripts/notion_mappings.json"
    with open(mapping_path, "r") as f:
        mappings = json.load(f)
        
    # 1.5. Fetch current page properties from Notion database to preserve existing New / Existing values
    db_id = "28494165-72f7-800c-b1af-e98a49f6efa2"
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    current_new_existing = {}
    has_more = True
    start_cursor = None
    
    print("Fetching current page properties from Notion...")
    while has_more:
        payload = {}
        if start_cursor:
            payload["start_cursor"] = start_cursor
        res = requests.post(url, headers=headers, json=payload)
        if res.status_code == 200:
            data = res.json()
            for page in data.get("results", []):
                pid = page["id"]
                props = page.get("properties", {})
                ne_prop = props.get("New / Existing", {}).get("select")
                ne_name = ne_prop.get("name") if ne_prop else None
                if ne_name:
                    current_new_existing[pid] = ne_name
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")
        else:
            print(f"Warning: Failed to fetch database pages from Notion: {res.status_code} - {res.text}")
            has_more = False
    print(f"Loaded {len(current_new_existing)} pages with New / Existing values from Notion.")

    # Fallback classifications for New / Existing
    init_new_or_existing = {
        "H2-11": "New",
        "H2-25": "New",
        "H2-01": "New",
        "H2-20": "New",
        "H2-30": "Existing",
        "H2-27": "Existing",
        "H2-18": "Existing",
        "H2-17": "New",
        "H2-16": "New",
        "H2-12": "Existing",
        "H2-07": "Existing",
        "H2-10": "New",
        "H2-09": "Existing",
        "H2-22": "Existing",
        "H2-24": "New",
    }
    
    # 2. Fetch Firestore initiatives and conflicts
    fs_inits = {}
    init_docs = db.collection("initiatives").where("cycleId", "==", cycle_id).stream()
    for doc in init_docs:
        fs_inits[doc.id] = doc.to_dict()
        fs_inits[doc.id]["id"] = doc.id
    
    conflicts_docs = db.collection("conflicts").where("cycleId", "==", cycle_id).stream()
    conflict_inits = set()
    for doc in conflicts_docs:
        c = doc.to_dict()
        if c.get("status") == "active":
            title = c.get("title", "").lower()
            if "my account" in title or "h2-30" in title:
                conflict_inits.add("H2-30")
            if "dedupe" in title or "h2-25" in title:
                conflict_inits.add("H2-25")
    
    print(f"Loaded {len(fs_inits)} initiatives from Firestore.")
    
    # 3. Load Confluence rows
    confluence_rows = get_confluence_rows()
    print(f"Loaded {len(confluence_rows)} rows from Confluence cache.")
    
    # Load critical path IDs
    critical_ids = get_critical_path_ids()
    if critical_ids:
        print(f"Loaded {len(critical_ids)} IDs from CriticalPathTab.tsx.")
    
    # 4. Synchronize mapped pages
    updated_count = 0
    for notion_page_id, fs_init_id in mappings.items():
        if only_id and fs_init_id != only_id:
            continue
            
        if critical_ids and fs_init_id not in critical_ids:
            print(f"Skipping {fs_init_id} - not in Critical Path scope.")
            continue
            
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
        
        # Add Quarter multi_select based on computed dates
        quarters = get_quarters_from_dates(start_date, end_date)
        properties["Quarter"] = {
            "multi_select": [{"name": q} for q in quarters]
        }
        
        # Determine New / Existing value (preserve if already set on Notion, else use fallback map)
        norm_page_id = notion_page_id.replace("-", "")
        existing_val = None
        for pid, pval in current_new_existing.items():
            if pid.replace("-", "") == norm_page_id:
                existing_val = pval
                break
        
        new_existing_val = existing_val if existing_val else init_new_or_existing.get(fs_init_id, "New")
        properties["New / Existing"] = {
            "select": {
                "name": new_existing_val
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
            properties["Timeline"] = {
                "date": None
            }
            
        # Match with Confluence row to populate description/deliveries/OKRs
        conf_row = match_firestore_to_confluence(fs_init_id, fs_init.get("name", ""), confluence_rows)
        if conf_row:
            parsed_conf = parse_confluence_desc_col(conf_row[5])
            
            # Add to Notion update payload
            if parsed_conf["description"]:
                properties["Description"] = {
                    "rich_text": [{ "text": { "content": parsed_conf["description"] } }]
                }
            if parsed_conf["deliveries"]:
                properties["Delivery"] = {
                    "rich_text": [{ "text": { "content": parsed_conf["deliveries"] } }]
                }
            if parsed_conf["success"]:
                properties["Expected impact"] = {
                    "rich_text": [{ "text": { "content": parsed_conf["success"] } }]
                }
                
            print(f"Syncing local {fs_init_id} ({fs_init['name']}) -> Notion Page {notion_page_id}:")
            print(f"  RAG: {notion_rag}")
            print(f"  Timeline: {start_date} to {end_date}")
            print(f"  Quarter: {', '.join(quarters)}")
            print(f"  New / Existing: {new_existing_val}")
            print(f"  Description: {parsed_conf['description'][:60]}...")
            print(f"  Delivery (Deliveries): {parsed_conf['deliveries'][:60]}...")
            print(f"  Expected impact (OKRs):\n{parsed_conf['success']}")
        else:
            print(f"Syncing local {fs_init_id} ({fs_init['name']}) -> Notion Page {notion_page_id} (No Confluence match found):")
            print(f"  RAG: {notion_rag}")
            print(f"  Timeline: {start_date} to {end_date}")
            print(f"  Quarter: {', '.join(quarters)}")
            print(f"  New / Existing: {new_existing_val}")
            
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
    only_id = None
    for arg in sys.argv:
        if arg.startswith("--only="):
            only_id = arg.split("=")[1]
        elif arg == "--only" and sys.argv.index(arg) + 1 < len(sys.argv):
            only_id = sys.argv[sys.argv.index(arg) + 1]
    run_sync(dry_run=dry, only_id=only_id)
