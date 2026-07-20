import json
with open('C:/Users/the1a/.lmstudio/conversations/1783220175162.conversation.json', encoding='utf-8') as f:
    data = json.load(f)

with open('C:/Users/the1a/Our Site/lm_chat.txt', 'w', encoding='utf-8') as out:
    for m in data['messages']:
        role = m['versions'][0]['role']
        text = ""
        content = m['versions'][0].get('content', [])
        for c in content:
            if c.get('type') == 'text':
                text += c.get('text', '')
        
        steps = m['versions'][0].get('steps', [])
        for s in steps:
            if s.get('type') == 'contentBlock':
                for c in s.get('content', []):
                    if c.get('type') == 'text':
                        text += c.get('text', '')
                        
        out.write(f"{role.upper()}:\n{text}\n---\n")
