#!/usr/bin/env python3
"""
Script to add start_date and end_date to pleiades-places-filtered-expanded.json
using data from pleiades_location_dates.csv
"""

import json
import csv
from pathlib import Path

def extract_pleiades_id_from_url(url):
    """
    Extract Pleiades ID from URL.
    Example: https://pleiades.stoa.org/places/100196697 -> 100196697
    """
    return url.strip().split('/')[-1]

def load_dates_from_csv(csv_path):
    """
    Load start_date and end_date from CSV file.
    Returns a dictionary mapping Pleiades ID to (start_date, end_date) tuple.
    """
    dates_dict = {}

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            pleiades_id = extract_pleiades_id_from_url(row['item'])
            start_date = int(row['start_date']) if row['start_date'] else None
            end_date = int(row['end_date']) if row['end_date'] else None
            dates_dict[pleiades_id] = (start_date, end_date)

    return dates_dict

def add_dates_to_places(json_path, dates_dict, output_path):
    """
    Add start_date and end_date fields to places in JSON file.
    """
    # Load JSON file
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Track statistics
    total_places = len(data['@graph'])
    places_with_dates = 0
    places_without_dates = 0

    # Add dates to each place
    for place in data['@graph']:
        pleiades_id = place.get('id')

        if pleiades_id and pleiades_id in dates_dict:
            start_date, end_date = dates_dict[pleiades_id]
            if start_date is not None:
                place['start_date'] = start_date
            if end_date is not None:
                place['end_date'] = end_date
            places_with_dates += 1
        else:
            places_without_dates += 1

    # Write updated JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

    # Print statistics
    print(f"Processing complete!")
    print(f"Total places: {total_places}")
    print(f"Places with dates added: {places_with_dates}")
    print(f"Places without dates: {places_without_dates}")
    print(f"Output written to: {output_path}")

def main():
    # Define file paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    csv_path = project_root / 'public' / 'pleiades_location_dates.csv'
    json_path = project_root / 'public' / 'pleiades-places-filtered-expanded.json'
    output_path = project_root / 'public' / 'pleiades-places-filtered-expanded-with-dates.json'

    # Check if input files exist
    if not csv_path.exists():
        print(f"Error: CSV file not found at {csv_path}")
        return

    if not json_path.exists():
        print(f"Error: JSON file not found at {json_path}")
        return

    print("Loading dates from CSV...")
    dates_dict = load_dates_from_csv(csv_path)
    print(f"Loaded dates for {len(dates_dict)} places")

    print("\nAdding dates to places JSON...")
    add_dates_to_places(json_path, dates_dict, output_path)

if __name__ == '__main__':
    main()
