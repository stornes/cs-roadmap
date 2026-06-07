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
    raise ValueError("NOTION_API_KEY not found in environment.")

# Headers for Notion API
headers = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

# Import helpers from sync_notion.py
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from sync_notion import parse_horizon, map_rag_status, cycle_id, get_critical_path_ids

def generate_preview():
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
                
    # 3. Fetch current Notion pages
    db_id = "28494165-72f7-800c-b1af-e98a49f6efa2"
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    
    # Paginated database query to ensure we fetch all pages
    notion_pages = {}
    has_more = True
    start_cursor = None
    
    while has_more:
        payload = {}
        if start_cursor:
            payload["start_cursor"] = start_cursor
        res = requests.post(url, headers=headers, json=payload)
        if res.status_code != 200:
            print(f"Failed to query Notion database: {res.status_code} - {res.text}")
            return
        
        data = res.json()
        for page in data.get("results", []):
            notion_pages[page["id"]] = page
            
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")
        
    # 4. Generate comparison table
    markdown_lines = []
    markdown_lines.append("# Proposed Notion Roadmap Updates Preview\n")
    markdown_lines.append("This table shows exactly how the properties of the Notion database would be updated based on the local capacity planning data:\n")
    markdown_lines.append("| Notion Initiative | Mapped Local Initiative | Current RAG $\\rightarrow$ Proposed | Current Timeline $\\rightarrow$ Proposed |")
    markdown_lines.append("| :--- | :--- | :--- | :--- |")
    
    critical_ids = get_critical_path_ids()
    for notion_page_id, fs_init_id in mappings.items():
        if critical_ids and fs_init_id not in critical_ids:
            continue
        if fs_init_id not in fs_inits:
            continue
        fs_init = fs_inits[fs_init_id]
        
        # Look up matching page
        notion_page = notion_pages.get(notion_page_id)
        if not notion_page:
            # Match UUIDs ignoring hyphens
            for pid, pdata in notion_pages.items():
                if pid.replace("-", "") == notion_page_id.replace("-", ""):
                    notion_page = pdata
                    break
                    
        if not notion_page:
            print(f"Warning: Notion Page {notion_page_id} (for Firestore {fs_init_id}) not found in database results.")
            continue
            
        props = notion_page.get("properties", {})
        
        # Current Notion title
        title_prop = props.get("Initiative", {}).get("title", [])
        notion_title = "".join([t.get("plain_text", "") for t in title_prop])
        notion_url_id = notion_page["id"].replace("-", "")
        notion_link = f"[{notion_title}](https://www.notion.so/{notion_url_id})"
        
        # Current Notion RAG
        rag_select = props.get("RAG", {}).get("select")
        current_rag = rag_select.get("name") if rag_select else "None"
        
        # Current Notion Timeline
        timeline_date = props.get("Timeline", {}).get("date")
        if timeline_date:
            start = timeline_date.get('start', 'None')
            end = timeline_date.get('end', 'None')
            current_timeline = f"{start} to {end}" if end else f"{start} (single date)"
        else:
            current_timeline = "None"
            
        # Calculate proposed
        has_conflict = fs_init_id in conflict_inits
        proposed_rag = map_rag_status(fs_init.get("status", ""), has_conflict)
        start_date, end_date = parse_horizon(fs_init.get("horizon", ""))
        
        if start_date:
            proposed_timeline = f"{start_date} to {end_date}"
        else:
            proposed_timeline = "None"
            
        # Format comparison strings
        if current_rag == proposed_rag:
            rag_change = f"**{current_rag}** (No change)"
        else:
            rag_change = f"`{current_rag}` $\\rightarrow$ **`{proposed_rag}`**"
            
        if current_timeline == proposed_timeline:
            timeline_change = f"**{current_timeline}** (No change)"
        else:
            timeline_change = f"`{current_timeline}` $\\rightarrow$ **`{proposed_timeline}`**"
            
        markdown_lines.append(f"| {notion_link} | `{fs_init_id}`: {fs_init['name']} | {rag_change} | {timeline_change} |")
        
    markdown_content = "\n".join(markdown_lines)
    
    # Write to file
    output_path = "/Users/sst/.gemini/antigravity/brain/940d50c8-7747-444a-bb44-a4b96101588f/proposed_updates_preview.md"
    with open(output_path, "w") as f:
        f.write(markdown_content)
    print(f"Successfully generated comparison table.")

if __name__ == "__main__":
    generate_preview()
