import os
import json
import requests
from dotenv import load_dotenv

# Load env variables from root .env
load_dotenv()

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
if not NOTION_API_KEY:
    raise ValueError("NOTION_API_KEY not found in environment or .env file.")

# Headers for Notion API
headers = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def rollback(backup_path="scripts/notion_backup.json", dry_run=False):
    if not os.path.exists(backup_path):
        print(f"Error: Backup file {backup_path} not found.")
        return
        
    print(f"Loading backup from {backup_path}...")
    with open(backup_path, "r") as f:
        backup_data = json.load(f)
        
    print(f"Loaded {len(backup_data)} pages from backup.")
    
    # Load mappings to identify which pages were actually in scope
    mapping_path = "scripts/notion_mappings.json"
    with open(mapping_path, "r") as f:
        mappings = json.load(f)
        
    # Load critical path IDs to filter rollback to the in-scope critical path pages
    # so we don't accidentally modify other pages that weren't synced.
    import re
    tab_path = "src/components/CriticalPathTab.tsx"
    critical_ids = set()
    if os.path.exists(tab_path):
        with open(tab_path, "r") as f:
            content = f.read()
        critical_ids = set(re.findall(r"id:\s*['\"]([^'\"]+)['\"]", content))
        print(f"Loaded {len(critical_ids)} IDs from CriticalPathTab.tsx.")
    
    updated_count = 0
    for page_id, props in backup_data.items():
        # Check if the page is mapped and in critical path
        # Normalise mapping keys to match backup page_ids
        norm_page_id = page_id.replace("-", "")
        fs_init_id = None
        orig_page_key = None
        for mk, mv in mappings.items():
            if mk.replace("-", "") == norm_page_id:
                fs_init_id = mv
                orig_page_key = mk
                break
                
        if not fs_init_id:
            # Page was not mapped in our sync
            continue
            
        if critical_ids and fs_init_id not in critical_ids:
            # Page was out of critical path scope
            continue
            
        print(f"Restoring Page {page_id} (Initiative {fs_init_id}):")
        
        # Build clean patch payload from backup properties
        properties = {}
        
        # 1. RAG
        rag_prop = props.get("RAG", {})
        if rag_prop.get("select"):
            properties["RAG"] = {"select": {"name": rag_prop["select"]["name"]}}
        else:
            properties["RAG"] = {"select": None}
            
        # 2. Timeline
        time_prop = props.get("Timeline", {})
        if time_prop.get("date"):
            properties["Timeline"] = {
                "date": {
                    "start": time_prop["date"]["start"],
                    "end": time_prop["date"]["end"]
                }
            }
        else:
            properties["Timeline"] = {"date": None}
            
        # 3. Quarter
        q_prop = props.get("Quarter", {})
        if q_prop.get("multi_select"):
            properties["Quarter"] = {
                "multi_select": [{"name": item["name"]} for item in q_prop["multi_select"]]
            }
        else:
            properties["Quarter"] = {"multi_select": []}
            
        # 4. New / Existing
        ne_prop = props.get("New / Existing", {})
        if ne_prop.get("select"):
            properties["New / Existing"] = {"select": {"name": ne_prop["select"]["name"]}}
        else:
            properties["New / Existing"] = {"select": None}
            
        # 5. Description
        desc_prop = props.get("Description", {})
        if desc_prop.get("rich_text"):
            properties["Description"] = {
                "rich_text": [{"text": {"content": item["text"]["content"]}} for item in desc_prop["rich_text"] if item.get("text")]
            }
        else:
            properties["Description"] = {"rich_text": []}
            
        # 6. Delivery
        deliv_prop = props.get("Delivery", {})
        if deliv_prop.get("rich_text"):
            properties["Delivery"] = {
                "rich_text": [{"text": {"content": item["text"]["content"]}} for item in deliv_prop["rich_text"] if item.get("text")]
            }
        else:
            properties["Delivery"] = {"rich_text": []}
            
        # 7. Expected impact
        impact_prop = props.get("Expected impact", {})
        if impact_prop.get("rich_text"):
            properties["Expected impact"] = {
                "rich_text": [{"text": {"content": item["text"]["content"]}} for item in impact_prop["rich_text"] if item.get("text")]
            }
        else:
            properties["Expected impact"] = {"rich_text": []}
            
        # 8. Teams Involved
        teams_prop = props.get("Teams Involved", {})
        if teams_prop.get("multi_select"):
            properties["Teams Involved"] = {
                "multi_select": [{"name": item["name"]} for item in teams_prop["multi_select"]]
            }
        else:
            properties["Teams Involved"] = {"multi_select": []}
            
        # 9. Accountable
        acc_prop = props.get("Accountable", {})
        if acc_prop.get("people"):
            properties["Accountable"] = {
                "people": [{"object": "user", "id": item["id"]} for item in acc_prop["people"]]
            }
        else:
            properties["Accountable"] = {"people": []}
            
        # 10. 2026 Priority
        prio_prop = props.get("2026 Priority", {})
        if prio_prop.get("select"):
            properties["2026 Priority"] = {
                "select": {"name": prio_prop["select"]["name"]}
            }
        else:
            properties["2026 Priority"] = {"select": None}
            
        print(f"  RAG: {properties['RAG']['select']}")
        print(f"  Timeline: {properties['Timeline']['date']}")
        print(f"  Quarter: {properties['Quarter']['multi_select']}")
        print(f"  Teams Involved: {properties['Teams Involved']['multi_select']}")
        print(f"  New / Existing: {properties['New / Existing']['select']}")
        print(f"  Accountable: {properties['Accountable']['people']}")
        print(f"  2026 Priority: {properties['2026 Priority']['select']}")
        
        if not dry_run:
            url = f"https://api.notion.com/v1/pages/{orig_page_key}"
            res = requests.patch(url, headers=headers, json={"properties": properties})
            if res.status_code == 200:
                print("  Success!")
                updated_count += 1
            else:
                print(f"  Error patching Notion page: {res.status_code} - {res.text}")
        else:
            print("  [Dry Run] Would patch page to restore original properties.")
            updated_count += 1
            
    print(f"Rollback completed. Restored {updated_count} pages.")

if __name__ == "__main__":
    import sys
    dry = "--live" not in sys.argv
    rollback(dry_run=dry)
