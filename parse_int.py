import json
import glob

files = glob.glob('C:/Users/the1a/.lmstudio/conversations/LM site build/*.json')
target_file = None
for f in files:
    with open(f, encoding='utf-8') as file:
        data = json.load(file)
        if data.get('name') == 'INT' or 'INT' in data.get('name', ''):
            target_file = f
            break

if target_file:
    with open('C:/Users/the1a/Our Site/lm_chat_int.txt', 'w', encoding='utf-8') as out:
        with open(target_file, encoding='utf-8') as file:
            data = json.load(file)
            for m in data.get('messages', []):
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
    print(f"Parsed {target_file}")
else:
    print("Chat INT not found")
