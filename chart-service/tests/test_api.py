import asyncio
import importlib.util
import os
from pathlib import Path
import pytest
import httpx
os.environ['CHART_API_KEY'] = 'test-key-only'
spec = importlib.util.spec_from_file_location('chart_api',Path(__file__).parents[1]/'api.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
BASE = dict(name='Development case A',gender='other',year=1990,month=5,day=12,hour=10,minute=30,second=0,place='Mumbai',latitude=19.076,longitude=72.8777,timezone=5.5,timezone_name='Asia/Kolkata',include_sookshma=False)

@pytest.mark.parametrize('changes',[
 {'year':1991,'month':2,'day':29},
 {'year':2020,'month':3,'day':8,'hour':2,'minute':30,'timezone':-5,'timezone_name':'America/New_York'},
 {'year':2020,'month':11,'day':1,'hour':1,'minute':30,'timezone':-4,'timezone_name':'America/New_York'},
 {'timezone':4}, {'timezone_name':'UTC+04:00'}, {'latitude':91},
 {'latitude':float('nan')}, {'include_sookshma':False,'dasha_path':['Sun','Moon','Mars']},
])
def test_validation(changes):
 with pytest.raises(Exception): api.Birth(**(BASE|changes))

def test_historical_offsets_and_zero():
 assert api.Birth(**(BASE|dict(timezone=5.75,timezone_name='Asia/Kathmandu'))).timezone==5.75
 assert api.Birth(**(BASE|dict(year=1900,timezone=5+21/60+10/3600))).timezone>5
 assert api.Birth(**(BASE|dict(timezone_name='UTC',timezone=0,latitude=0,longitude=0))).longitude==0

async def request_tests():
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app),base_url='http://test') as client:
  assert (await client.get('/health')).json()['isolation']=='fresh-process-per-job'
  assert (await client.post('/chart',json=BASE)).status_code==401
  assert (await client.post('/chart',content='x'*9000,headers={'x-api-key':'test-key-only'})).status_code==413
  async def calculate(body):
   r=await client.post('/chart',json=body,headers={'x-api-key':'test-key-only'})
   assert r.status_code==200, r.text[:200]
   assert r.headers['cache-control']=='no-store'
   return r.json()
  a,b=await asyncio.gather(calculate(BASE),calculate(BASE|dict(name='Development case B',year=2001,month=1,day=23,hour=22,place='London',latitude=51.5074,longitude=-.1278,timezone=0,timezone_name='Europe/London')))
  repeat=await calculate(BASE)
  zero=await calculate(BASE|dict(name='Development zero meridian',latitude=0,longitude=0,timezone=0,timezone_name='UTC'))
  assert zero['calculation_settings']['utc_offset_hours']==0
  import swisseph as swe
  from datetime import datetime
  instant=datetime.fromisoformat(a['calculation_settings']['utc'])
  jd=swe.julday(instant.year,instant.month,instant.day,instant.hour+instant.minute/60)
  swe.set_sid_mode(swe.SIDM_LAHIRI)
  position,_=swe.calc_ut(jd,swe.SUN,swe.FLG_SWIEPH|swe.FLG_SIDEREAL)
  signs=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
  sun=a['D1']['planets']['Sun']
  actual=signs.index(sun['sign'])*30+sun['pos']['dec_deg']
  assert abs(actual-position[0])<0.00001
  rahu=a['D1']['planets']['Rahu'];ketu=a['D1']['planets']['Ketu']
  assert abs(abs(((signs.index(rahu['sign'])*30+rahu['pos']['dec_deg'])-(signs.index(ketu['sign'])*30+ketu['pos']['dec_deg']))%360)-180)<0.00001
  assert a['D1']==repeat['D1']
  assert a['AshtakaVarga']==repeat['AshtakaVarga']
  assert a['D1']!=b['D1']
  for chart in (a,b):
   for d in ['D1','D2','D3','D4','D7','D9','D10','D12','D16','D20','D24','D27','D30','D40','D45','D60']:
    assert len(chart[d]['houses'])==12
    assert chart[d]['houses'][0]['sign']==chart[d]['ascendant']['sign']
   assert 'sookshmadashas' not in chart['Dashas']['Vimshottari']
   assert all(sum(chart['AshtakaVarga'][p][i] for p in ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'])==chart['AshtakaVarga']['Total'][i] for i in range(12))
  path=next(iter(a['Dashas']['Vimshottari']['paryantardashas'])).split('-')
  fine=await calculate(BASE|dict(include_sookshma=True,dasha_path=path))
  assert len(fine['Dashas']['Vimshottari']['sookshmadashas'])>=1
  assert all(k.startswith('-'.join(path)+'-') for k in fine['Dashas']['Vimshottari']['sookshmadashas'])
  assert a['D1']==fine['D1']

def test_real_api_isolation_and_fine_periods(): asyncio.run(request_tests())

async def source_tests():
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app),base_url='http://test') as client:
  for path in ['/', '/source']:
   response=await client.get(path)
   assert response.status_code==200
   assert 'kundli-agpl-v1.tar.gz' in response.text
   assert 'rel="source"' in response.headers['link']
  response=await client.get('/license')
  assert response.status_code==200
  assert 'GNU AFFERO GENERAL PUBLIC LICENSE' in response.text
  assert 'Version 3' in response.text

def test_public_corresponding_source_offer(): asyncio.run(source_tests())
