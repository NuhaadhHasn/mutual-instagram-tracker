import json
import sys

# The Instagram export folder, e.g. instagram-<handle>-<date>-<id>.
# Pass it as the first argument: python find_unfollowers.py <export-folder>
EXPORT_DIR = sys.argv[1] if len(sys.argv) > 1 else 'instagram-export'

# Load followers
with open(f'{EXPORT_DIR}/connections/followers_and_following/followers_1.json', 'r', encoding='utf-8') as f:
    followers_data = json.load(f)

# Load following
with open(f'{EXPORT_DIR}/connections/followers_and_following/following.json', 'r', encoding='utf-8') as f:
    following_data = json.load(f)

# Extract followers usernames
followers = set()
for item in followers_data:
    if 'string_list_data' in item and len(item['string_list_data']) > 0:
        username = item['string_list_data'][0]['value']
        followers.add(username)

# Extract following usernames
following = {}
for item in following_data.get('relationships_following', []):
    username = item['title']
    href = item['string_list_data'][0]['href'] if item['string_list_data'] else ''
    # Convert the _u/ format to regular profile link
    profile_link = href.replace('/_u/', '/')
    following[username] = profile_link

# Find unfollowers (people you follow who don't follow you back)
unfollowers = []
for username, profile_link in following.items():
    if username not in followers:
        unfollowers.append({
            'username': username,
            'profile_link': profile_link
        })

# Sort by username
unfollowers.sort(key=lambda x: x['username'].lower())

# Display results
print(f"\n{'='*80}")
print(f"INSTAGRAM UNFOLLOWERS ANALYSIS")
print(f"{'='*80}\n")
print(f"Total people you follow: {len(following)}")
print(f"Total people who follow you: {len(followers)}")
print(f"People who DON'T follow you back: {len(unfollowers)}")
print(f"\n{'='*80}\n")

if unfollowers:
    print("LIST OF PEOPLE WHO DON'T FOLLOW YOU BACK:\n")
    for i, user in enumerate(unfollowers, 1):
        print(f"{i}. {user['username']}")
        print(f"   Profile: {user['profile_link']}\n")

    # Save to file
    with open('unfollowers_list.txt', 'w', encoding='utf-8') as f:
        f.write("="*80 + "\n")
        f.write("INSTAGRAM UNFOLLOWERS - PEOPLE WHO DON'T FOLLOW YOU BACK\n")
        f.write("="*80 + "\n\n")
        f.write(f"Total people you follow: {len(following)}\n")
        f.write(f"Total people who follow you: {len(followers)}\n")
        f.write(f"People who DON'T follow you back: {len(unfollowers)}\n\n")
        f.write("="*80 + "\n\n")

        for i, user in enumerate(unfollowers, 1):
            f.write(f"{i}. {user['username']}\n")
            f.write(f"   Profile: {user['profile_link']}\n\n")

    print(f"\n{'='*80}")
    print(f"Results saved to: unfollowers_list.txt")
    print(f"{'='*80}\n")
else:
    print("Great news! Everyone you follow also follows you back!")
