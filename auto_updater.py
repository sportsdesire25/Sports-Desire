import os
import re
import json
import logging
from datetime import datetime
from scraper_engine import TournamentScraperEngine

try:
    from sources_config import BASE_MANUAL_LISTINGS
except ImportError:
    from .sources_config import BASE_MANUAL_LISTINGS

# Locate the frontend tournaments database file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_JS_FILE = os.path.join(BASE_DIR, "tournamentsData.js")

def parse_existing_js_data(filepath):
    """Safely reads the existing javascript file and converts JS objects to standard JSON."""
    if not os.path.exists(filepath):
        logging.error(f"Cannot find database file at {filepath}")
        return []

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Match INITIAL_TOURNAMENTS = [ ... ]; block
    match = re.search(r'const\s+INITIAL_TOURNAMENTS\s*=\s*(\[[^\;]+\]);', content, re.DOTALL)
    if not match:
        logging.warning("Could not cleanly extract INITIAL_TOURNAMENTS block from JS file.")
        return []

    raw_json = match.group(1)
    
    # Automatically convert unquoted JavaScript keys (e.g. id: "...") to double-quoted valid JSON ("id": "...")
    # Matches words followed by colon that aren't inside strings
    normalized_json = re.sub(r'(\b[a-zA-Z_]\w*\b)\s*:', r'"\1":', raw_json)
    # Prevent double quoting if already quoted (e.g., ""id"": "...")
    normalized_json = re.sub(r'""(\w+)""\s*:', r'"\1":', normalized_json)

    try:
        data = json.loads(normalized_json)
        logging.info(f"Successfully evaluated and extracted {len(data)} existing tournament cards from live JS file.")
        return data
    except json.JSONDecodeError as err:
        logging.warning(f"Could not parse live JS string ({err}). Will seamlessly restore from guaranteed baseline dataset.")
        return []

def merge_and_deduplicate(base_items, existing_items, incoming_items):
    """Merges baseline entries, existing entries, and incoming scrapes without duplicates."""
    seen_keys = set()
    merged_list = []

    # 1. Guarantee core baseline tournaments exist first
    for item in base_items:
        key = f"{item.get('sport')}_{item.get('title')}".lower().strip()
        if key not in seen_keys:
            seen_keys.add(key)
            merged_list.append(item)

    # 2. Add any manually added or custom existing items from the frontend file
    for item in existing_items:
        key = f"{item.get('sport')}_{item.get('title')}".lower().strip()
        if key not in seen_keys:
            seen_keys.add(key)
            merged_list.append(item)

    added_count = 0
    # 3. Append freshly harvested tournaments
    for new_item in incoming_items:
        key = f"{new_item.get('sport')}_{new_item.get('title')}".lower().strip()
        if key not in seen_keys:
            seen_keys.add(key)
            if "totalPrizeMoney:" in new_item:
                new_item["totalPrizeMoney"] = new_item.pop("totalPrizeMoney:")
            merged_list.append(new_item)
            added_count += 1

    logging.info(f"Deduplication finished! Total consolidated platform catalogue: {len(merged_list)} tournaments ({added_count} brand new scraped schedules included).")
    return merged_list, added_count

def write_updated_javascript(filepath, new_tournament_list):
    """Reconstructs tournamentsData.js with pristine styling, preserving helper constants."""
    formatted_json = json.dumps(new_tournament_list, indent=2, ensure_ascii=False)

    js_template = f"""// Sports Desire - Tournaments Database (National, State, Local)
// AUTOMATICALLY UPDATED BY PYTHON SCRAPER ENGINE
// Last Ingest: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

const INITIAL_TOURNAMENTS = {formatted_json};

const NE_STATES = [
  "All Regions",
  "Maharashtra",
  "Delhi",
  "Karnataka",
  "Tamil Nadu",
  "West Bengal",
  "Gujarat",
  "Assam",
  "Kerala"
];

const SPORTS_LIST = [
  "All Sports",
  "Tennis",
  "Badminton",
  "Football",
  "Cricket",
  "Table Tennis",
  "Volleyball",
  "Basketball"
];

const AGE_GROUPS = [
  "All Ages",
  "U-10",
  "U-12",
  "U-14",
  "U-16",
  "U-18",
  "U-19",
  "Open Men's",
  "Open Women's",
  "Veterans 35+",
  "Veterans 45+"
];

const LEVEL_LIST = [
  "All Levels",
  "National Circuit",
  "State Championship",
  "District Open",
  "Local Prize Money"
];
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(js_template)
    logging.info(f"SUCCESSFULLY WRITTEN updated data to {filepath}. Frontend app is now fully synchronized!")

def run_update_pipeline():
    logging.info("--- TRIGGERING SPORTS DESIRE AUTOMATED DATABASE UPDATER ---")
    engine = TournamentScraperEngine()
    fresh_tournaments = engine.harvest_all_federations()
    
    existing_tournaments = parse_existing_js_data(TARGET_JS_FILE)
    merged_tournaments, added = merge_and_deduplicate(BASE_MANUAL_LISTINGS, existing_tournaments, fresh_tournaments)
    
    write_updated_javascript(TARGET_JS_FILE, merged_tournaments)
    logging.info(f"--- UPDATE PIPELINE FINISHED. (Total active tournaments: {len(merged_tournaments)}) ---")

if __name__ == "__main__":
    run_update_pipeline()
