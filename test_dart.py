import requests
import json

API_KEY = 'e43a1e83b4a45fd8a97cdcb83d55e3321caacd9e'


params = {
    'crtfc_key': API_KEY,
    'corp_code': '01190568',
    'bsns_year': '2024',
    'reprt_code': '11014',
    'fs_div': 'CFS'
}

print('[START] DART 데이터 요청 중...')
response = requests.get('https://opendart.fsc.go.kr/api/fnltt/SummaryFS.json', params=params, timeout=10)
data = response.json()

print('[RESULT]')
print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])

if 'list' in data:
    print('\n[SUCCESS]')
    for i, item in enumerate(data['list'][:3], 1):
        print(str(i) + '. ' + item.get('account_nm') + ': ' + str(item.get('thstrm_amount')))
