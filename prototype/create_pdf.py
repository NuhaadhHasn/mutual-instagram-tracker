import json
import sys

# The Instagram export folder, e.g. instagram-<handle>-<date>-<id>.
# Pass it as the first argument: python find_unfollowers.py <export-folder>
EXPORT_DIR = sys.argv[1] if len(sys.argv) > 1 else 'instagram-export'
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime

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
    profile_link = href.replace('/_u/', '/')
    following[username] = profile_link

# Find unfollowers
unfollowers = []
for username, profile_link in following.items():
    if username not in followers:
        unfollowers.append({
            'username': username,
            'profile_link': profile_link
        })

# Sort by username
unfollowers.sort(key=lambda x: x['username'].lower())

# Create PDF
pdf_filename = 'Instagram_Unfollowers_Report.pdf'
doc = SimpleDocTemplate(pdf_filename, pagesize=letter,
                        rightMargin=30, leftMargin=30,
                        topMargin=30, bottomMargin=18)

# Container for the 'Flowable' objects
elements = []

# Define styles
styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=24,
    textColor=colors.HexColor('#1a1a1a'),
    spaceAfter=30,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold'
)

subtitle_style = ParagraphStyle(
    'CustomSubtitle',
    parent=styles['Normal'],
    fontSize=12,
    textColor=colors.HexColor('#666666'),
    spaceAfter=20,
    alignment=TA_CENTER
)

# Add title
title = Paragraph("Instagram Unfollowers Report", title_style)
elements.append(title)

# Add date
date_text = f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
date_para = Paragraph(date_text, subtitle_style)
elements.append(date_para)

# Add summary
summary_text = f"""
<b>Summary:</b><br/>
Total people you follow: {len(following)}<br/>
Total people who follow you: {len(followers)}<br/>
<b>People who DON'T follow you back: {len(unfollowers)}</b>
"""
summary_para = Paragraph(summary_text, styles['Normal'])
elements.append(summary_para)
elements.append(Spacer(1, 20))

# Create table data
table_data = [['#', 'Username', 'Profile URL']]

for i, user in enumerate(unfollowers, 1):
    # Create clickable link
    username_link = Paragraph(f'<link href="{user["profile_link"]}">{user["username"]}</link>',
                              styles['Normal'])
    url_link = Paragraph(f'<link href="{user["profile_link"]}">View Profile</link>',
                        styles['Normal'])
    table_data.append([str(i), username_link, url_link])

# Create table with better styling
table = Table(table_data, colWidths=[0.5*inch, 2.5*inch, 1.5*inch])

# Add style to table
table.setStyle(TableStyle([
    # Header row
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E1306C')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 12),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
    ('TOPPADDING', (0, 0), (-1, 0), 12),

    # Data rows
    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
    ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # Center align the # column
    ('ALIGN', (1, 1), (-1, -1), 'LEFT'),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 1), (-1, -1), 9),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),

    # Grid
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 1), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
]))

elements.append(table)

# Build PDF
doc.build(elements)

print("\n" + "="*80)
print("PDF GENERATED SUCCESSFULLY!")
print("="*80)
print(f"\nFilename: {pdf_filename}")
print(f"Total unfollowers listed: {len(unfollowers)}")
print(f"\nThe PDF includes:")
print("  - Summary statistics")
print("  - Complete table with all unfollowers")
print("  - Clickable profile links")
print("="*80 + "\n")
