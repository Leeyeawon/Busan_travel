# app.py
from flask import Flask, request, render_template
import requests
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from urllib.parse import unquote
import os, re
from flask import jsonify

app = Flask("Busan_travel")

# =========================
# ✅ 너가 수정해야 할 부분 (필수)
# =========================
# 보통 "Decoding" 키를 그대로 넣으면 됨.
# (혹시 Encoding 키를 넣었어도 unquote로 한 번 풀어줌)
SERVICE_KEY = unquote("5965bcfda7048244920e4a9bd1a93580ec52a88a1ff1a752e329c1f546fd1bdf").strip()

# 부산 격자 (예시)
NX = 98
NY = 76

# =========================
# 기상청 API URL
# =========================
# 동네예보(단기예보)
VILAGE_FCST_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
# 초단기실황(현재기온)
ULTRA_NCST_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"

# 간단 캐시(요청 너무 자주 보내지 않게)
_cache_vilage = {"ts": None, "data": None}   # (avg, tmax, tmin)
_cache_ncst = {"ts": None, "data": None}     # current_temp


# =========================
# 시간 유틸 (tzdata 없어도 KST fallback)
# =========================
def now_kst() -> datetime:
    try:
        return datetime.now(ZoneInfo("Asia/Seoul"))
    except Exception:
        return datetime.now(timezone(timedelta(hours=9)))  # tzdata 없을 때 KST 고정


def _pick_vilage_base_datetime(now_: datetime):
    """
    단기예보 발표시각(하루 8회)을 고려해서 base_date/base_time 결정
    - 너무 최근이면 데이터가 아직 안 올라왔을 수 있어서 45분 정도 여유를 둠
    """
    now_ = now_ - timedelta(minutes=45)

    # 발표 시각(보통 02,05,08,11,14,17,20,23)
    times = ["2300", "2000", "1700", "1400", "1100", "0800", "0500", "0200"]
    hhmm = now_.strftime("%H%M")

    for t in times:
        if hhmm >= t:
            return now_.strftime("%Y%m%d"), t

    # 02:00 이전이면 전날 23:00 사용
    prev = now_ - timedelta(days=1)
    return prev.strftime("%Y%m%d"), "2300"


def _pick_ncst_base_datetime(now_: datetime):
    """
    초단기실황은 보통 정시 단위로 갱신되는데 지연이 있을 수 있어 여유를 둠
    """
    now_ = now_ - timedelta(minutes=40)
    return now_.strftime("%Y%m%d"), now_.strftime("%H00")


# =========================
# 기상청: 오늘 평균/최고/최저 (동네예보)
# =========================
def get_today_temps(nx: int, ny: int):
    """
    return: (avg, tmax, tmin) -> 문자열(표시용)
    - avg: 오늘 TMP(시간별 기온) 평균
    - tmax/tmin: TMX/TMN 있으면 사용, 없으면 TMP로 대체
    """
    if (not SERVICE_KEY) or ("여기에" in SERVICE_KEY):
        return ("--", "--", "--")

    now = now_kst()

    # ✅ 10분 캐시
    if _cache_vilage["ts"] and (now - _cache_vilage["ts"]).total_seconds() < 600:
        return _cache_vilage["data"]

    base_date, base_time = _pick_vilage_base_datetime(now)
    today = now.strftime("%Y%m%d")

    params = {
        "serviceKey": SERVICE_KEY,
        "pageNo": 1,
        "numOfRows": 2000,
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
    }

    avg = tmin = tmax = None

    try:
        r = requests.get(VILAGE_FCST_URL, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()

        body = data.get("response", {}).get("body", {})
        items = body.get("items", {}).get("item", [])
        if not isinstance(items, list):
            items = []

        tmps = []
        tmin_val = None
        tmax_val = None

        for it in items:
            if it.get("fcstDate") != today:
                continue

            cat = it.get("category")
            val = it.get("fcstValue")

            if cat == "TMP":
                try:
                    tmps.append(float(val))
                except Exception:
                    pass
            elif cat == "TMN":
                try:
                    tmin_val = float(val)
                except Exception:
                    pass
            elif cat == "TMX":
                try:
                    tmax_val = float(val)
                except Exception:
                    pass

        if tmps:
            avg = sum(tmps) / len(tmps)
            if tmin_val is None:
                tmin_val = min(tmps)
            if tmax_val is None:
                tmax_val = max(tmps)

        tmin, tmax = tmin_val, tmax_val

    except Exception:
        avg, tmin, tmax = None, None, None

    def fmt(x):
        return "--" if x is None else f"{x:.1f}"

    result = (fmt(avg), fmt(tmax), fmt(tmin))
    _cache_vilage["ts"] = now
    _cache_vilage["data"] = result
    return result


# =========================
# 기상청: 현재기온 (초단기실황)
# =========================
def get_current_temp(nx: int, ny: int):
    """
    return: current_temp 문자열
    - 초단기실황 T1H(기온) 사용
    """
    if (not SERVICE_KEY) or ("여기에" in SERVICE_KEY):
        return "--"

    now = now_kst()

    # ✅ 5분 캐시(현재기온은 더 자주 보게 됨)
    if _cache_ncst["ts"] and (now - _cache_ncst["ts"]).total_seconds() < 300:
        return _cache_ncst["data"]

    base_date, base_time = _pick_ncst_base_datetime(now)

    params = {
        "serviceKey": SERVICE_KEY,
        "pageNo": 1,
        "numOfRows": 100,
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
    }

    temp = "--"

    try:
        r = requests.get(ULTRA_NCST_URL, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()

        items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
        if not isinstance(items, list):
            items = []

        for it in items:
            if it.get("category") == "T1H":  # 현재기온
                temp = str(it.get("obsrValue", "--"))
                break

    except Exception:
        temp = "--"

    _cache_ncst["ts"] = now
    _cache_ncst["data"] = temp
    return temp

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")

def _strip_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "")

# app.py (수정된 부분)
# ... (기존 코드 유지) ...

@app.get("/api/naver-walk")
@app.route("/api/naver-photo")
@app.route("/api/naver-sea")
@app.route("/api/naver-hotplace")
def api_naver_walk():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"items": []})

    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        return jsonify({"items": [], "error": "NAVER API 키가 없습니다."}), 400

    # 🚨 수정: 검색어 뒤에 '산책'을 추가
    suffix = {
    "/api/naver-walk": "산책",
    "/api/naver-photo": "포토 스팟",
    "/api/naver-sea": "바다 포토 스팟",
    "/api/naver-hotplace": "핫플",
    }.get(request.path, "포토 스팟")

    search_query = f"{q} {suffix}"

    try:
        # 🚨 수정: 지역 검색 API -> 블로그 검색 API URL로 변경
        url = "https://openapi.naver.com/v1/search/blog.json"
        
        headers = {
            "X-Naver-Client-Id": NAVER_CLIENT_ID,
            "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        }
        
        params = {
            "query": search_query, 
            "display": 6,  # 🚨 수정: 결과 개수를 6개로 제한
            "start": 1, 
            "sort": "sim"   # 정확도순 (블로그 검색의 기본)
        }

        r = requests.get(url, headers=headers, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        # 블로그 검색 API의 결과 필드명은 지역 검색과 다릅니다.
        items = [{
            "title": _strip_tags(it.get("title", "")),
            "link": it.get("link", ""),
            # 블로그 API는 'category' 대신 'bloggername' 또는 'description'을 사용
            "description": _strip_tags(it.get("description", "")), # 본문 내용 1줄
            "bloggername": it.get("bloggername", ""),
        } for it in data.get("items", [])]

        return jsonify({"items": items})

    except Exception as e:
        # ... (기존 오류 처리 유지) ...
        return jsonify({"items": [], "error": str(e)}), 500
    
# =========================
# Routes
# =========================
@app.route("/")
@app.route("/index")
def indexhtml():
    current_temp = get_current_temp(NX, NY)          # ✅ 현재기온(실황)
    avg_temp, tmax, tmin = get_today_temps(NX, NY)   # ✅ 평균/최고/최저(예보)

    return render_template(
        "index.html",
        current_temp=current_temp,
        avg_temp=avg_temp,
        tmax=tmax,
        tmin=tmin
    )


@app.route("/festivities")
def festivitieshtml():
    return render_template("festivities.html")


@app.route("/tourist-attraction")
def tourist_attractionhtml():
    return render_template("tourist_attraction.html")


@app.route("/traffic")
def traffichtml():
    return render_template("traffic.html")


@app.route("/login")
def loginhtml():
    return render_template("login.html")


@app.route("/travel-course")
def travel_coursehtml():
    return render_template("travel_course.html")


@app.route("/travel-course/walk")
def course_walkhtml():
    return render_template("course_walk.html")


@app.route("/travel-course/sea")
def course_seahtml():
    return render_template("course_sea.html")


@app.route("/travel-course/photo")
def course_photohtml():
    return render_template("course_photo.html")


@app.route("/travel-course/hotplace")
def course_hotplacehtml():
    return render_template("course_hotplace.html")


@app.route("/method", methods=["GET", "POST"])
def method():
    if request.method == "GET":
        num = request.args.get("num")
        name = request.args.get("name")
        return f"GET으로 전달된 데이터({num}, {name})"
    else:
        num = request.form.get("num")
        name = request.form.get("name")
        return f"POST로 전달된 데이터({num}, {name})"

if __name__ == "__main__":
    app.run(debug=True, port=5001)
