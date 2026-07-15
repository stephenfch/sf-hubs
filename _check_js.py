import re
with open('hubs/travel/index.html','r',encoding='utf-8') as f:
    txt=f.read()
s=txt.find('// =============================================================================')
e=txt.find('</script>',s)
js=txt[s:e]
o=js.count('{')
c=js.count('}')
op=js.count('(')
cp=js.count(')')
print(f'{{ = {o}, }} = {c}, diff = {o-c}')
print(f'( = {op}, ) = {cp}, diff = {op-cp}')
if o==c and op==cp:
    print('✅ Balanced')
else:
    print('❌ Unbalanced')
