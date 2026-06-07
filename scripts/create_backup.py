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

def create_backup():
    db_id = "28494165-72f7-800c-b1af-e98a49f6efa2"
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    notion_backup_data = {}
    has_more = True
    start_cursor = None
    
    print("Fetching and saving current properties from Notion...")
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
                notion_backup_data[pid] = props
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")
        else:
            print(f"Error: Failed to fetch database pages: {res.status_code} - {res.text}")
            has_more = False
            
    backup_path = "scripts/notion_backup.json"
    with open(backup_path, "w") as f:
        json.dump(notion_backup_data, f, indent=2)
    print(f"Successfully created backup at {backup_path}")

if __name__ == "__main__":
    create_backup()
