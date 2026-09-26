"""Local research ingestion. Public snapshots are preserved; no automated verdicts."""
import csv,io,json,hashlib,sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import Request,urlopen
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
SOURCES={'UN':('https://scsanctions.un.org/resources/xml/en/consolidated.xml','xml'),'UK':('https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv','csv'),'OFAC':('https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML','xml')}
def vals(el,path):return [x.text.strip() for x in el.findall(path) if x.text and x.text.strip()]
def text(el,path):return ' '.join(vals(el,path))
def flatten(el):
    d={}
    for x in el.iter():
        if len(x)==0 and x.text and x.text.strip():d.setdefault(x.tag,[]).append(x.text.strip())
    return {k:list(dict.fromkeys(v)) for k,v in d.items()}
def parse_xml(code,payload):
    if b'<!DOCTYPE' in payload.upper():raise ValueError('DTD rejected')
    root=ET.fromstring(payload)
    for e in root.iter():e.tag=e.tag.split('}')[-1]
    if root.tag!=('CONSOLIDATED_LIST' if code=='UN' else 'sdnList'):raise ValueError('Unknown XML schema')
    records=[]
    for e in list(root.iter()):
        if code=='UN' and e.tag in ('INDIVIDUAL','ENTITY'):
            name=' '.join(filter(None,[text(e,k) for k in ['FIRST_NAME','SECOND_NAME','THIRD_NAME','FOURTH_NAME']]))
            aliases=vals(e,'.//ALIAS_NAME')+vals(e,'NAME_ORIGINAL_SCRIPT')
            key=text(e,'DATAID');kind='individual' if e.tag=='INDIVIDUAL' else 'company'
        elif code=='OFAC' and e.tag=='sdnEntry':
            name=' '.join(filter(None,[text(e,'firstName'),text(e,'lastName')]))
            aliases=[' '.join(filter(None,[text(a,'firstName'),text(a,'lastName')])) for a in e.findall('.//aka')]
            key=text(e,'uid');kind={'Individual':'individual','Entity':'company','Vessel':'vessel','Aircraft':'aircraft'}.get(text(e,'sdnType'),'other')
        else:continue
        if not key or not name:raise ValueError('Missing source ID/name')
        records.append(dict(id=key,name=name,aliases=list(dict.fromkeys(aliases)),kind=kind,details=flatten(e)))
    if not records:raise ValueError('Empty source')
    return records
def parse_uk(payload):
    reader=csv.reader(io.StringIO(payload.decode('utf-8-sig')));header=None
    for _ in range(8):
        row=next(reader,[])
        if 'Unique ID' in row:header=row;break
    if not header or 'Name 6' not in header:raise ValueError('Unknown UK schema')
    result={}
    for row in reader:
        if not any(row):continue
        if len(row)!=len(header):raise ValueError('Malformed CSV row')
        d=dict(zip(header,row));key=d['Unique ID'].strip();name=' '.join(d.get('Name '+str(i),'').strip() for i in range(1,7)).strip();name=' '.join(name.split())
        if not key:raise ValueError('Missing ID')
        if key not in result:result[key]=dict(id=key,name=name,aliases=[],kind={'Individual':'individual','Entity':'company','Ship':'vessel'}.get(d.get('Designation Type'),'other'),details={})
        r=result[key]
        if not r['name'] and name:r['name']=name
        for alias in [name,d.get('Name non-latin script','').strip()]:
            if alias and alias!=r['name'] and alias not in r['aliases']:r['aliases'].append(alias)
        for k,v in d.items():
            if v.strip() and v.strip() not in r['details'].get(k,[]):r['details'].setdefault(k,[]).append(v.strip())
    if not result or any(not r['name'] for r in result.values()):raise ValueError('Empty UK source or unnamed record')
    return list(result.values())
def sync(code):
    url,fmt=SOURCES[code];out=Path('.local/sources')/code;out.mkdir(parents=True,exist_ok=True)
    with urlopen(Request(url,headers={'User-Agent':'MizanLocalResearch/0.2'}),timeout=45) as r:payload=r.read(64*1024*1024+1)
    if len(payload)>64*1024*1024:raise ValueError('Source exceeds limit')
    sha=hashlib.sha256(payload).hexdigest();raw=out/(sha+'.'+fmt)
    if not raw.exists():raw.write_bytes(payload)
    records=parse_uk(payload) if code=='UK' else parse_xml(code,payload)
    meta=dict(code=code,url=url,sha256=sha,retrievedAt=datetime.now(timezone.utc).isoformat(),parserVersion='0.2',records=records)
    temp=out/'parsed.tmp';temp.write_text(json.dumps(meta,ensure_ascii=False));temp.replace(out/'parsed.json')
    return code,len(records)
if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=3) as ex:
        for code,count in ex.map(sync,sys.argv[1:] or SOURCES):print(code,count)
