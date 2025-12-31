import requests
import json

KRX_AUTH_KEY = "C872E0B526A146E784C2757A1C84DC5F2B3CFB1B"
headers = {"AUTH_KEY": KRX_AUTH_KEY}
url = "http://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd"
params = {"basDd": "20251230", "isuSrtCd": "00278470"}

print("[START] KRX API Test")
print(f"[DEBUG] URL: {url}")
print("-" * 60)

try:
    response = requests.get(url, headers=headers, params=params, timeout=10)
    print(f"[STATUS] {response.status_code}")
    
    if response.status_code == 200:
        print("[✅] SUCCESS - Data received:")
        print(response.text[:500])
    else:
        print(f"[❌] FAILED")
        print(response.text[:300])
        
except Exception as e:
    print(f"[ERROR] {type(e).__name__}: {e}")
