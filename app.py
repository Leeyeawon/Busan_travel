from flask import Flask, render_template
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

app = Flask("Busan_travel")

# =========================
# ✅ 너가 수정해야 할 부분 (필수)
# =========================
SERVICE_KEY = "여기에_너_서비스키(디코딩키)_넣기"   # TODO
NX = 98   # TODO: 부산 지역 격자 X
NY = 76   # TODO: 부산 지역 격자 Y

KMA_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"

# 간단 캐시(요청 너무 자주 보내지 않게)
_cache = {"ts": None, "data": None}

def _pick_base_datetime(now_kst: datetime):
    """
    단기예보 발표시각(하루 8회)을 고려해서 base_date/base_time 결정
    - 너무 최근이면 데이터가 아직 안 올라왔을 수 있어서 45분 정도 여유를 줌
    """
    now_kst = now_kst - timedelta(minutes=45)

    times = ["2300","2000","1700","1400","1100","0800","0500","0200"]
    hhmm = now_kst.strftime("%H%M")

    for t in times:
        if hhmm >= t:
            return now_kst.strftime("%Y%m%d"), t

    # 02:00 이전이면 전날 23:00 사용
    prev = now_kst - timedelta(days=1)
    return prev.strftime("%Y%m%d"), "2300"


def get_today_temps(nx: int, ny: int):
    """
    return: (avg, tmax, tmin)  -> 문자열(표시용)
    - avg: 오늘 TMP(시간별 기온) 평균
    - tmax/tmin: TMX/TMN 있으면 사용, 없으면 TMP로 대체
    """
    now = datetime.now(ZoneInfo("Asia/Seoul"))

    # ✅ 10분 캐시
    if _cache["ts"] and (now - _cache["ts"]).total_seconds() < 600:
        return _cache["data"]

    base_date, base_time = _pick_base_datetime(now)
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

    r = requests.get(KMA_URL, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()

    items = data["response"]["body"]["items"]["item"]

    tmps = []
    tmin = None
    tmax = None

    for it in items:
        if it.get("fcstDate") != today:
            continue

        cat = it.get("category")
        val = it.get("fcstValue")

        if cat == "TMP":      # 시간별 기온
            try:
                tmps.append(float(val))
            except:
                pass
        elif cat == "TMN":    # 오늘 최저(제공되면 1개)
            try:
                tmin = float(val)
            except:
                pass
        elif cat == "TMX":    # 오늘 최고(제공되면 1개)
            try:
                tmax = float(val)
            except:
                pass

    # fallback
    if tmps:
        avg = sum(tmps) / len(tmps)
        if tmin is None:
            tmin = min(tmps)
        if tmax is None:
            tmax = max(tmps)
    else:
        # 데이터가 비는 경우(좌표/키/발표시각 문제 가능)
        avg, tmin, tmax = None, None, None

    def fmt(x):
        return "--" if x is None else f"{x:.1f}"

    result = (fmt(avg), fmt(tmax), fmt(tmin))
    _cache["ts"] = now
    _cache["data"] = result
    return result


@app.route("/")
@app.route("/index")
def indexhtml():
    avg_temp, tmax, tmin = get_today_temps(NX, NY)
    return render_template("index.html", avg_temp=avg_temp, tmax=tmax, tmin=tmin)

# (다른 페이지들도 필요하면 이런 식으로)
@app.route("/festivities")
def festivitieshtml():
    return render_template("festivities.html")

@app.route("/tourist-attraction")
def tourist_attractionhtml():
    return render_template("tourist_attraction.html")


if __name__ == "__main__":
    app.run(debug=True)