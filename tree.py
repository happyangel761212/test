#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
터미널 크리스마스트리 코드 아트 (tree.py)

  실행:   python3 tree.py          (윈도우: python tree.py)
  끝내기: Ctrl+C

- 필요한 것: 파이썬 3.8 이상 + numpy  (설치: pip install numpy)
- 터미널 창을 가로 96칸 × 세로 55줄 이상으로 키워 주세요.
- 트루컬러(24비트 색)를 쓰기 때문에 맥은 기본 「터미널」 앱보다
  iTerm2 나 VS Code 터미널을 권해요. (기본 터미널은 색이 다르게 나올 수 있어요)
  윈도우는 「Windows Terminal」(PowerShell 기본 창)에서 잘 나와요.

간단 원리
- 트리·땅·장식·선물을 3D 점들로 만들고, 화면에 비춰서(투영)
  밝기에 따라 " .,:;-=+*#%@" 중 한 글자를 찍어요.
- 가까운 점이 먼 점을 가리도록 깊이(z-buffer)를 계산하고,
  전구·별빛·회오리 같은 빛나는 것은 겹칠수록 더해져서 아주 밝으면 하얗게 보여요.
"""

import math
import os
import sys
import time

import numpy as np

# =====================================================================
#  색 팔레트 — 여기 숫자(R, G, B: 0~255)만 바꾸면 색이 바뀌어요
# =====================================================================
STAR_WHITE    = (235, 240, 255)  # 배경 별: 하얀 별빛
STAR_BLUE     = (165, 195, 255)  # 배경 별: 푸른 별빛
STAR_YELLOW   = (255, 232, 175)  # 배경 별: 노란 별빛
MILKY         = (125, 110, 185)  # 은하수 띠: 옅은 보랏빛
PLANET_SILVER = (205, 210, 222)  # 왼쪽 위 고리 행성: 은빛
RING          = (220, 200, 165)  # 고리 행성의 고리: 연한 베이지
PLANET_BLUE   = (70, 145, 255)   # 오른쪽 위 행성: 푸른빛
PLANET_PURPLE = (175, 110, 235)  # 왼쪽 중간 작은 행성: 보랏빛

GROUND_SNOW   = (190, 205, 235)  # 눈 쌓인 둥근 땅
TREE_DARK     = (16, 82, 40)     # 트리: 진한 초록
TREE_MID      = (30, 130, 55)    # 트리: 중간 초록
TREE_LIGHT    = (95, 205, 95)    # 트리: 밝은 초록
TREE_SNOW     = (240, 248, 255)  # 가지 끝에 묻은 눈
TRUNK         = (125, 78, 40)    # 트리 기둥: 갈색

SWIRL         = (230, 242, 255)  # 감아 올라가는 회오리 빛: 흰색
FLASH         = (255, 255, 255)  # 꼭대기 8방향 번쩍임: 흰색

RED           = (232, 32, 45)    # 장식 볼: 빨강
GOLD          = (255, 192, 45)   # 장식 볼: 금색
SILVER        = (200, 212, 230)  # 장식 볼: 은색

WARM_WHITE    = (255, 222, 165)  # 전구: 따뜻한 흰색
BULB_RED      = (255, 60, 60)    # 전구: 빨강
BULB_GOLD     = (255, 190, 40)   # 전구: 금색
BULB_GREEN    = (80, 255, 120)   # 전구: 초록

STAR_GOLD     = (255, 200, 55)   # 꼭대기 별: 금색
PINK          = (255, 100, 175)  # 하트: 분홍
WHITE         = (255, 255, 255)  # 흰색

GIFT_WHITE    = (238, 240, 248)  # 선물 상자: 흰색
GIFT_RED      = (215, 35, 50)    # 선물 상자: 빨강
GIFT_GREEN    = (35, 160, 75)    # 선물 상자: 초록
GIFT_GOLD     = (240, 185, 50)   # 선물 상자: 금색
GIFT_BLUE     = (55, 105, 235)   # 선물 상자: 파랑

SNOW_FLAKE    = (240, 245, 255)  # 내리는 눈

# =====================================================================
#  개수·크기 — 「하트 더 많이」, 「전구 더 많이」 같은 건 여기 숫자를 바꿔요
# =====================================================================
NUM_STARS       = 500    # 배경 별 개수
NUM_BALLS       = 34     # 장식 볼 개수
NUM_LIGHTS      = 170    # 전구 개수
LIGHT_TURNS     = 5.5    # 전구 줄이 트리를 감는 바퀴 수
NUM_HEARTS      = 5      # 트리에 달리는 하트 개수
NUM_SNOW        = 170    # 내리는 눈송이 개수
SNOW_HEART_RATE = 0.06   # 눈 사이 분홍 하트 비율 (0.06 = 6%)
BALL_COLORS     = [RED, GOLD, SILVER]                       # 볼 색 순서(번갈아)
LIGHT_COLORS    = [WARM_WHITE, BULB_RED, BULB_GOLD, BULB_GREEN]  # 전구 색 순서

# 선물 상자: (트리 중심에서 거리, 놓이는 각도, 가로, 세로(깊이), 높이, 상자색, 리본색)
GIFTS = [
    (1.36, -1.55, 0.30, 0.28, 0.26, GIFT_WHITE, RED),
    (1.40, -0.95, 0.36, 0.34, 0.34, GIFT_RED,   GOLD),
    (1.32, -0.35, 0.28, 0.28, 0.42, GIFT_GREEN, RED),
    (1.38,  0.25, 0.42, 0.34, 0.24, GIFT_GOLD,  RED),
    (1.36,  0.85, 0.32, 0.32, 0.36, GIFT_BLUE,  SILVER),
    (1.40,  1.45, 0.26, 0.26, 0.22, GIFT_RED,   WHITE),
]

# =====================================================================
#  화면·카메라 설정
# =====================================================================
W, H = 96, 54             # 화면 크기 (가로 칸, 세로 줄)
FPS = 30                  # 1초에 다시 그리는 횟수
SPIN_PERIOD = 17.0        # 트리가 한 바퀴 도는 시간(초)
RAMP = np.array(list(" .,:;-=+*#%@"))  # 밝기 → 글자
NR = len(RAMP) - 1

CAM_DIST = 10.0           # 카메라 거리
TILT = math.radians(14)   # 카메라가 위에서 내려다보는 각도
KY = 11.0                 # 세로 확대 (줄 / 단위길이)
KX = KY * 2.0             # 글자 칸은 세로로 길쭉해서 가로를 2배로
YC = 1.42                 # 화면 가운데에 오는 높이
V0 = H * 0.5 + 3.0

# =====================================================================
#  생기는 순서(초) — 전체 약 13.5초 + 3초 감상 후 처음부터
# =====================================================================
T_GROUND = (0.0, 1.0)     # 1. 눈 쌓인 땅이 퍼짐
T_SWIRL  = (1.0, 4.0)     # 2. 회오리가 감아 올라가며 트리 생성
T_FLASH  = (4.0, 4.8)     # 3. 꼭대기 8방향 번쩍
T_BALLS  = (4.5, 6.6)     # 4. 장식 볼
T_LIGHTS = (6.5, 8.6)     # 5. 전구
T_STAR   = (8.6, 9.3)     # 6. 꼭대기 별
T_HEARTS = (9.3, 10.5)    # 7. 하트
T_GIFTS  = (10.5, 12.3)   # 8. 선물 상자
T_SNOW   = 12.1           # 9. 눈 내리기 시작
T_CHASE  = 13.4           # 10. 전구 빛 달리기 시작
T_LOOP   = 16.6           # 이 시간이 지나면 처음부터 다시

# 트리 모양: 원뿔 4층 (아래 높이, 위 높이, 아래 반지름)
LAYERS = [
    (0.50, 1.65, 1.30),
    (1.10, 2.20, 1.02),
    (1.62, 2.70, 0.76),
    (2.12, 3.15, 0.50),
]
TREE_TOP = LAYERS[-1][1]
STAR_Y = TREE_TOP + 0.14
GROUND_R = 1.6

RNG = np.random.default_rng(1225)


def rgb(c):
    return np.array(c, dtype=np.float64) / 255.0


def normalize(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


LIGHT_DIR = normalize([-0.5, 0.62, -0.6])          # 빛: 왼쪽 위 앞에서
HALF_DIR = normalize(LIGHT_DIR + np.array([0.0, 0.0, -1.0]))


def ease_out_back(x):
    x = np.clip(x, 0.0, 1.0)
    c1 = 1.9
    return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_out_cubic(x):
    x = np.clip(x, 0.0, 1.0)
    return 1 - (1 - x) ** 3


def spin_angle(t):
    return 2 * math.pi * t / SPIN_PERIOD


def front_theta(t, offset):
    """t초에 화면 정면(offset 만큼 옆)에 오도록 하는 월드 각도."""
    return spin_angle(t) - math.pi / 2 + offset


def r_env(y):
    """높이 y에서 트리 바깥 표면의 반지름."""
    y = np.asarray(y, dtype=np.float64)
    r = np.zeros_like(y)
    for yb, yt, R in LAYERS:
        m = (y >= yb) & (y <= yt)
        r = np.where(m, np.maximum(r, R * (yt - y) / (yt - yb)), r)
    r = np.where(y < LAYERS[0][0], LAYERS[0][2], r)
    return r


def exposed_heights(n, spread=0.75):
    """층마다 겉으로 드러난 띠에 고르게 높이를 나눠 줌(아래→위 정렬)."""
    bands = []
    for i, (yb, yt, R) in enumerate(LAYERS):
        top = LAYERS[i + 1][0] - 0.06 if i + 1 < len(LAYERS) else yt - 0.25
        bands.append((yb, top - yb, R))
    w = np.array([b[1] * b[2] for b in bands])
    w = w / w.sum()
    counts = np.floor(w * n).astype(int)
    while counts.sum() < n:
        counts[np.argmax(w * n - counts)] += 1
    ys = []
    for (yb, band, _), c in zip(bands, counts):
        if c == 0:
            continue
        k = (np.arange(c) + 0.5) / c
        k = k + (RNG.random(c) - 0.5) * (0.6 / c)
        ys.append(yb + band * (0.05 + spread * np.clip(k, 0, 1)))
    return np.sort(np.concatenate(ys))


def fib_sphere(n):
    i = np.arange(n) + 0.5
    ph = np.arccos(1 - 2 * i / n)
    th = math.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(ph), np.cos(ph), np.sin(th) * np.sin(ph)], 1)


# =====================================================================
#  3D 모델 만들기
# =====================================================================
def build_tree():
    Ps, Ns, Cs = [], [], []
    for yb, yt, R in LAYERS:
        h = yt - yb
        n = int(6500 * R * math.hypot(R, h))
        th = RNG.random(n) * 2 * math.pi
        frac = np.sqrt(RNG.random(n))            # 0=꼭대기, 1=아래 가장자리
        y = yt - h * frac
        rim = np.clip((frac - 0.8) / 0.2, 0, 1)
        y = y - 0.07 * rim * (1 + 0.6 * np.sin(13 * th))   # 가장자리가 살짝 처짐
        r = R * frac * (1 + 0.07 * np.sin(11 * th + 6 * y) * frac
                        + 0.035 * RNG.standard_normal(n))
        P = np.stack([r * np.cos(th), y, r * np.sin(th)], 1)
        N = np.stack([h * np.cos(th), np.full(n, R), h * np.sin(th)], 1)
        N = normalize(normalize(N) + 0.32 * RNG.standard_normal((n, 3)))
        k = RNG.random(n) ** 1.2
        C = rgb(TREE_DARK) * (1 - k[:, None]) + rgb(TREE_LIGHT) * k[:, None]
        mid = RNG.random(n) < 0.3
        C[mid] = rgb(TREE_MID) * (0.85 + 0.3 * RNG.random((mid.sum(), 1)))
        snow = RNG.random(n) < 0.55 * rim ** 1.5 + 0.015
        C[snow] = rgb(TREE_SNOW) * (0.9 + 0.1 * RNG.random((snow.sum(), 1)))
        N[snow] = normalize(N[snow] + np.array([0, 0.8, 0]))
        Ps.append(P); Ns.append(N); Cs.append(C)
    P = np.concatenate(Ps); N = np.concatenate(Ns); C = np.concatenate(Cs)
    B = T_SWIRL[0] + (T_SWIRL[1] - T_SWIRL[0]) * np.clip(P[:, 1] / TREE_TOP, 0, 1)
    return P, N, C, B


def build_trunk():
    n = 1600
    th = RNG.random(n) * 2 * math.pi
    y = RNG.random(n) * 0.62
    r = 0.2 * (1 + 0.04 * RNG.standard_normal(n))
    P = np.stack([r * np.cos(th), y, r * np.sin(th)], 1)
    N = np.stack([np.cos(th), np.zeros(n), np.sin(th)], 1)
    stripe = 0.78 + 0.22 * np.sin(th * 15 + RNG.standard_normal(n) * 0.4)
    C = rgb(TRUNK) * stripe[:, None]
    B = np.full(n, T_SWIRL[0] + 0.05)
    return P, N, C, B


def build_ground():
    n = 6000
    rr = GROUND_R * np.sqrt(RNG.random(n))
    th = RNG.random(n) * 2 * math.pi
    y = 0.08 * (1 - (rr / GROUND_R) ** 2)
    P = np.stack([rr * np.cos(th), y, rr * np.sin(th)], 1)
    g = 0.16 * rr / GROUND_R ** 2
    N = normalize(np.stack([g * np.cos(th), np.ones(n), g * np.sin(th)], 1)
                  + 0.12 * RNG.standard_normal((n, 3)))
    C = rgb(GROUND_SNOW) * (0.88 + 0.12 * RNG.random((n, 1)))
    B = T_GROUND[0] + (T_GROUND[1] - T_GROUND[0]) * rr / GROUND_R
    return P, N, C, B


def build_gifts():
    Ps, Ns, Cs, Ids = [], [], [], []
    births, heights = [], []
    nG = len(GIFTS)
    dens = 1300.0
    for gi, (rc, off, wx, wz, h, body, ribbon) in enumerate(GIFTS):
        b = T_GIFTS[0] + (T_GIFTS[1] - T_GIFTS[0] - 0.5) * gi / max(1, nG - 1)
        births.append(b); heights.append(h)
        theta = front_theta(b + 0.25, off)
        yaw = theta + RNG.uniform(-0.35, 0.35)
        ax = np.array([-math.sin(yaw), 0, math.cos(yaw)])   # 상자 가로축
        az = np.array([math.cos(yaw), 0, math.sin(yaw)])    # 상자 깊이축
        up = np.array([0.0, 1.0, 0.0])
        center = np.array([rc * math.cos(theta), 0.02, rc * math.sin(theta)])
        hx, hz = wx / 2, wz / 2
        rw = 0.032
        loc, nrm = [], []

        def face(n, lx, ly, lz, nl):
            loc.append(np.stack([lx, ly, lz], 1))
            nrm.append(np.tile(nl, (n, 1)))

        n = int(wx * wz * dens)                        # 윗면
        face(n, RNG.uniform(-hx, hx, n), np.full(n, h), RNG.uniform(-hz, hz, n), [0, 1, 0])
        for s in (-1, 1):                               # 옆면 4개
            n = int(wz * h * dens)
            face(n, np.full(n, s * hx), RNG.uniform(0, h, n), RNG.uniform(-hz, hz, n), [s, 0, 0])
            n = int(wx * h * dens)
            face(n, RNG.uniform(-hx, hx, n), RNG.uniform(0, h, n), np.full(n, s * hz), [0, 0, s])
        L = np.concatenate(loc); NL = np.concatenate(nrm).astype(float)
        is_rib = (np.abs(L[:, 0]) < rw) | (np.abs(L[:, 2]) < rw)
        C = np.tile(rgb(body), (len(L), 1)) * (0.93 + 0.07 * RNG.random((len(L), 1)))
        C[is_rib] = rgb(ribbon) * 1.05
        # 리본 매듭: 고리 두 개 + 가운데 매듭
        a = RNG.random(160) * 2 * math.pi
        side = np.where(np.arange(160) % 2 == 0, -1.0, 1.0)
        lr = 0.055
        bx = side * (0.06 + lr * np.cos(a))
        by = h + 0.045 + lr * 0.85 * np.sin(a)
        bz = RNG.uniform(-0.012, 0.012, 160)
        knot = fib_sphere(30) * 0.03
        BL = np.concatenate([np.stack([bx, by, bz], 1), knot + [0, h + 0.03, 0]])
        BN = np.concatenate([normalize(np.stack([np.cos(a) * side, np.sin(a), -np.ones(160) * 0.5], 1)),
                             fib_sphere(30)])
        L = np.concatenate([L, BL]); NL = np.concatenate([NL, BN])
        C = np.concatenate([C, np.tile(rgb(ribbon) * 1.1, (len(BL), 1))])
        P = center + L[:, :1] * ax + L[:, 1:2] * up + L[:, 2:3] * az
        N = NL[:, :1] * ax + NL[:, 1:2] * up + NL[:, 2:3] * az
        Ps.append(P); Ns.append(normalize(N)); Cs.append(C); Ids.append(np.full(len(P), gi))
    return (np.concatenate(Ps), np.concatenate(Ns), np.concatenate(Cs),
            np.concatenate(Ids), np.array(births), np.array(heights))


# ---------- 정적인 몸통(땅·트리·기둥) ----------
_parts = [build_ground(), build_tree(), build_trunk()]
S_P = np.concatenate([p[0] for p in _parts])
S_N = np.concatenate([p[1] for p in _parts])
S_C = np.concatenate([p[2] for p in _parts])
S_B = np.concatenate([p[3] for p in _parts])
del _parts

# ---------- 장식 볼 ----------
BALL_R = 0.088
BALL_TMPL = fib_sphere(80)
_by = exposed_heights(NUM_BALLS)
BALL_BIRTH = T_BALLS[0] + (T_BALLS[1] - T_BALLS[0] - 0.25) * np.arange(NUM_BALLS) / max(1, NUM_BALLS - 1)
_off = ((np.arange(NUM_BALLS) * 0.618034) % 1.0 * 2 - 1) * 1.15
_bth = np.array([front_theta(b, o) for b, o in zip(BALL_BIRTH, _off)])
_br = r_env(_by) + 0.035
BALL_CENTER = np.stack([_br * np.cos(_bth), _by, _br * np.sin(_bth)], 1)
BALL_COLOR = np.array([rgb(BALL_COLORS[i % len(BALL_COLORS)]) for i in range(NUM_BALLS)])

# ---------- 전구 ----------
_s = np.linspace(0, 1, NUM_LIGHTS)
_ly = 0.58 + (TREE_TOP - 0.2 - 0.58) * _s
_lth = _s * LIGHT_TURNS * 2 * math.pi
_lr = r_env(_ly) + 0.04
LIGHT_POS = np.stack([_lr * np.cos(_lth), _ly, _lr * np.sin(_lth)], 1)
LIGHT_COLOR = np.array([rgb(LIGHT_COLORS[i % len(LIGHT_COLORS)]) for i in range(NUM_LIGHTS)])
LIGHT_BIRTH = T_LIGHTS[0] + (T_LIGHTS[1] - T_LIGHTS[0] - 0.1) * _s
LIGHT_FREQ = RNG.uniform(2.0, 6.0, NUM_LIGHTS)
LIGHT_PHASE = RNG.uniform(0, 2 * math.pi, NUM_LIGHTS)

# ---------- 하트 ----------
_hy = np.linspace(0.85, 2.75, NUM_HEARTS) if NUM_HEARTS > 1 else np.array([1.8])
HEART_BIRTH = T_HEARTS[0] + (T_HEARTS[1] - T_HEARTS[0] - 0.2) * np.arange(NUM_HEARTS) / max(1, NUM_HEARTS - 1)
_hoff = np.array([(-1) ** i * (0.25 + 0.45 * ((i * 0.37) % 1)) for i in range(NUM_HEARTS)])
_hth = np.array([front_theta(b, o) for b, o in zip(HEART_BIRTH, _hoff)])
_hr = r_env(_hy) + 0.06
HEART_POS = np.stack([_hr * np.cos(_hth), _hy, _hr * np.sin(_hth)], 1)

# ---------- 선물 ----------
G_P, G_N, G_C, G_ID, GIFT_BIRTH, GIFT_H = build_gifts()

# ---------- 땅 반짝이 ----------
_gs = RNG.choice(np.where(S_B <= T_GROUND[1])[0], 70, replace=False)
SPARK_POS = S_P[_gs] + np.array([0, 0.02, 0])
SPARK_FREQ = RNG.uniform(1.0, 3.0, 70)
SPARK_PHASE = RNG.uniform(0, 2 * math.pi, 70)

# ---------- 회오리 반짝 가루 ----------
SW_DUST_S = RNG.random(500)
SW_DUST_OFF = RNG.standard_normal((500, 3)) * 0.07
SW_DUST_SIDE = RNG.integers(0, 2, 500)

# ---------- 꼭대기 별 모양 (화면을 바라보는 평면 별) ----------
def _star_shape():
    outer, inner = 1.0, 0.42
    ang = np.pi / 2 + np.arange(10) * np.pi / 5
    rad = np.where(np.arange(10) % 2 == 0, outer, inner)
    poly = np.stack([rad * np.cos(ang), rad * np.sin(ang)], 1)
    a = np.linspace(0, 2 * np.pi, 720, endpoint=False)
    d = np.stack([np.cos(a), np.sin(a)], 1)
    best = np.full(len(a), np.inf)
    for i in range(10):
        p1, p2 = poly[i], poly[(i + 1) % 10]
        e = p2 - p1
        den = d[:, 0] * e[1] - d[:, 1] * e[0]
        with np.errstate(divide="ignore", invalid="ignore"):
            tt = (p1[0] * e[1] - p1[1] * e[0]) / den
            uu = (p1[0] * d[:, 1] - p1[1] * d[:, 0]) / den
        ok = (tt > 0) & (uu >= -1e-9) & (uu <= 1 + 1e-9)
        best = np.where(ok, np.minimum(best, tt), best)
    n = 900
    pa = RNG.random(n) * 2 * np.pi
    pr = np.sqrt(RNG.random(n))
    lim = best[(pa / (2 * np.pi) * 720).astype(int) % 720]
    rr = pr * lim
    return np.stack([rr * np.cos(pa), rr * np.sin(pa)], 1), pr


STAR_PTS, STAR_PR = _star_shape()
STAR_SIZE = 0.33

# ---------- 배경: 별 · 은하수 ----------
BG_SX = RNG.integers(0, W, NUM_STARS)
BG_SY = RNG.integers(0, H, NUM_STARS)
BG_BASE = RNG.uniform(0.35, 1.0, NUM_STARS)
BG_FREQ = RNG.uniform(0.4, 2.8, NUM_STARS)
BG_PHASE = RNG.uniform(0, 2 * math.pi, NUM_STARS)
_sc = [rgb(STAR_WHITE), rgb(STAR_BLUE), rgb(STAR_YELLOW)]
BG_SCOL = np.array([_sc[i] for i in RNG.choice(3, NUM_STARS, p=[0.6, 0.25, 0.15])])


def _milky():
    rr, cc = np.mgrid[0:H, 0:W]
    x = (cc - W / 2) / 2.0
    y = rr - H / 2
    a = math.radians(-28)
    d = -x * math.sin(a) + y * math.cos(a) + 3          # 띠까지 거리
    along = x * math.cos(a) + y * math.sin(a)
    band = np.exp(-(d / 5.5) ** 2) * (0.75 + 0.25 * np.sin(along * 0.35))
    noise = RNG.random((H, W))
    v = band * noise
    ch = np.full((H, W), " ", dtype="<U1")
    ch[v > 0.30] = "."
    ch[v > 0.62] = ","
    ch[v > 0.80] = ":"
    col = rgb(MILKY)[None, None, :] * (0.25 + 0.6 * v[..., None])
    col[ch == " "] = 0
    return ch, col


MILKY_CH, MILKY_COL = _milky()


# =====================================================================
#  3D → 화면
# =====================================================================
def to_view(P, phi):
    c, s = math.cos(phi), math.sin(phi)
    x = P[:, 0] * c + P[:, 2] * s
    z = -P[:, 0] * s + P[:, 2] * c
    y = P[:, 1]
    ct, st = math.cos(TILT), math.sin(TILT)
    return np.stack([x, y * ct + z * st, -y * st + z * ct], 1)


def project(V):
    zc = V[:, 2] + CAM_DIST
    k = CAM_DIST / zc
    u = W * 0.5 + KX * V[:, 0] * k
    v = V0 - KY * (V[:, 1] - YC) * k
    return np.floor(u).astype(np.int64), np.floor(v).astype(np.int64), zc


def add_glow(G, zbuf, V, color, inten, halo=0.0, bias=0.12):
    """빛나는 점: 겹칠수록 밝기를 더함. 트리 뒤에 숨은 건 안 보임."""
    if len(V) == 0:
        return
    u, v, zc = project(V)
    color = np.broadcast_to(color, (len(V), 3))
    inten = np.broadcast_to(inten, (len(V),))
    ok = (u >= 0) & (u < W) & (v >= 0) & (v < H) & (inten > 0.003)
    u, v, zc, color, inten = u[ok], v[ok], zc[ok], color[ok], inten[ok]
    idx = v * W + u
    vis = zc <= zbuf[idx] + bias
    u, v, idx, color, inten = u[vis], v[vis], idx[vis], color[vis], inten[vis]
    np.add.at(G, idx, color * inten[:, None])
    if halo > 0:
        for du, dv, f in ((-1, 0, 1.0), (1, 0, 1.0), (0, -1, 0.6), (0, 1, 0.6)):
            uu, vv = u + du, v + dv
            m = (uu >= 0) & (uu < W) & (vv >= 0) & (vv < H)
            np.add.at(G, vv[m] * W + uu[m], color[m] * (inten[m] * halo * f)[:, None])


# =====================================================================
#  배경 그리기 (별 · 은하수 · 행성)
# =====================================================================
def draw_planet(ch, col, cx, cy, R, base, t, kind):
    rpad = 2.2 * R if kind == "ring" else 1.1 * R
    r0, r1 = max(0, int(cy - rpad) - 1), min(H, int(cy + rpad) + 2)
    c0, c1 = max(0, int(cx - 2 * rpad) - 1), min(W, int(cx + 2 * rpad) + 2)
    if r0 >= r1 or c0 >= c1:
        return
    rr, cc = np.mgrid[r0:r1, c0:c1]
    ex = (cc + 0.5 - cx) / 2.0
    ey = rr + 0.5 - cy
    nx, ny = ex / R, -ey / R
    d2 = nx ** 2 + ny ** 2
    inside = d2 < 1.0
    nz = -np.sqrt(np.clip(1 - d2, 0, 1))
    lam = np.clip(nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1] + nz * LIGHT_DIR[2], 0, 1)
    if kind == "blue":
        pat = 0.82 + 0.18 * np.sin(ny * 9 + 1.5 * np.sin(nx * 3 + t * 0.2))
    elif kind == "purple":
        pat = 0.85 + 0.15 * np.sin(nx * 7 + 1) * np.sin(ny * 6)
    else:
        pat = 0.9 + 0.1 * np.sin(ny * 15)
    b = 0.07 + 0.93 * lam ** 1.1 * pat
    pcol = rgb(base) * (0.1 + 0.95 * lam * pat)[..., None]
    sub_ch = ch[r0:r1, c0:c1]
    sub_col = col[r0:r1, c0:c1]
    idx = np.clip(np.round(b * NR), 1, NR).astype(int)
    if kind == "ring":
        a = -0.32
        u = ex * math.cos(a) + ey * math.sin(a)
        w = -ex * math.sin(a) + ey * math.cos(a)
        q = np.sqrt(u ** 2 + (w / 0.34) ** 2) / R
        ring = (q > 1.3) & (q < 2.05) & ~((q > 1.62) & (q < 1.70))
        front = w > 0
        draw_ring = ring & (~inside | front)
        rb = (0.35 + 0.35 * np.clip(-u / (2 * R) + 0.5, 0, 1)) * (0.85 + 0.15 * np.sin(q * 20))
        sub_ch[inside & ~draw_ring] = RAMP[idx][inside & ~draw_ring]
        sub_col[inside & ~draw_ring] = pcol[inside & ~draw_ring]
        ridx = np.clip(np.round(rb * NR), 1, NR).astype(int)
        sub_ch[draw_ring] = RAMP[ridx][draw_ring]
        sub_col[draw_ring] = (rgb(RING) * rb[..., None] * 1.2)[draw_ring]
    else:
        sub_ch[inside] = RAMP[idx][inside]
        sub_col[inside] = pcol[inside]


def draw_background(t):
    ch = MILKY_CH.copy()
    col = MILKY_COL.copy()
    tw = 0.5 + 0.5 * np.sin(BG_FREQ * t + BG_PHASE)
    v = BG_BASE * (0.25 + 0.75 * tw ** 3)
    sch = np.select([v < 0.22, v < 0.4, v < 0.58, v < 0.78], [".", ",", ":", "+"], "*")
    ch[BG_SY, BG_SX] = sch
    col[BG_SY, BG_SX] = BG_SCOL * (0.3 + 0.7 * v)[:, None]
    draw_planet(ch, col, 15 + 0.4 * math.sin(t * 0.5), 10 + 0.6 * math.sin(t * 0.8), 4.0,
                PLANET_SILVER, t, "ring")
    draw_planet(ch, col, 84 + 0.4 * math.sin(t * 0.6 + 1), 11 + 0.7 * math.sin(t * 0.7 + 2), 5.0,
                PLANET_BLUE, t, "blue")
    draw_planet(ch, col, 9 + 0.3 * math.sin(t * 0.9 + 3), 31 + 0.5 * math.sin(t * 1.0 + 4), 2.6,
                PLANET_PURPLE, t, "purple")
    return ch, col


# =====================================================================
#  한 장면 그리기
# =====================================================================
def render(t):
    phi = spin_angle(t)

    # ---------- 단단한 물체(트리·땅·볼·선물) ----------
    m = S_B <= t
    Ps, Ns, Cs = [S_P[m]], [S_N[m]], [S_C[m]]
    ages = [t - S_B[m]]
    specs = [np.zeros(m.sum())]

    vb = np.where(BALL_BIRTH <= t)[0]
    if len(vb):
        sc = ease_out_back((t - BALL_BIRTH[vb]) / 0.28)
        bp = BALL_CENTER[vb][:, None, :] + BALL_TMPL[None] * (BALL_R * sc)[:, None, None]
        Ps.append(bp.reshape(-1, 3))
        Ns.append(np.tile(BALL_TMPL, (len(vb), 1)))
        Cs.append(np.repeat(BALL_COLOR[vb], len(BALL_TMPL), 0))
        ages.append(np.full(len(vb) * len(BALL_TMPL), 9.0))
        specs.append(np.full(len(vb) * len(BALL_TMPL), 1.0))

    gm = GIFT_BIRTH[G_ID] <= t
    if gm.any():
        rise = ease_out_cubic((t - GIFT_BIRTH[G_ID[gm]]) / 0.55)
        gp = G_P[gm].copy()
        gp[:, 1] -= (GIFT_H[G_ID[gm]] + 0.2) * (1 - rise)
        keep = gp[:, 1] >= 0.0
        Ps.append(gp[keep]); Ns.append(G_N[gm][keep]); Cs.append(G_C[gm][keep])
        ages.append(np.full(keep.sum(), 9.0)); specs.append(np.full(keep.sum(), 0.25))

    P = np.concatenate(Ps); N = np.concatenate(Ns); C = np.concatenate(Cs)
    age = np.concatenate(ages); spk = np.concatenate(specs)

    zbuf = np.full(W * H, np.inf)
    scol = np.zeros((W * H, 3))
    sbr = np.zeros(W * H)
    if len(P):
        V = to_view(P, phi)
        NV = to_view(N, phi)
        u, v, zc = project(V)
        ok = (u >= 0) & (u < W) & (v >= 0) & (v < H)
        u, v, zc, NV, C, age, spk = u[ok], v[ok], zc[ok], NV[ok], C[ok], age[ok], spk[ok]
        diff = np.clip(NV @ LIGHT_DIR, 0, 1)
        spec = np.clip(NV @ HALF_DIR, 0, 1) ** 22 * spk
        colr = C * (0.22 + 0.95 * diff)[:, None] + spec[:, None] * 1.1
        bright = 0.16 + 0.84 * diff + spec * 0.8
        fw = np.clip(1 - age / 0.4, 0, 1)                 # 방금 생긴 부분: 하얗게 빛남
        colr = colr * (1 - fw[:, None]) + fw[:, None] * 1.15
        bright = np.maximum(bright, fw)
        idx = v * W + u
        order = np.lexsort((zc, idx))
        ids = idx[order]
        first = np.ones(len(ids), bool)
        first[1:] = ids[1:] != ids[:-1]
        sel = order[first]
        zbuf[idx[sel]] = zc[sel]
        scol[idx[sel]] = colr[sel]
        sbr[idx[sel]] = bright[sel]

    # ---------- 빛나는 것들 ----------
    G = np.zeros((W * H, 3))

    # 회오리 두 줄기
    if T_SWIRL[0] <= t < T_FLASH[0] + 0.45:
        p = min(1.0, (t - T_SWIRL[0]) / (T_SWIRL[1] - T_SWIRL[0]))
        fade = 1.0 if t < T_SWIRL[1] else max(0.0, 1 - (t - T_SWIRL[1]) / 0.45)
        j = np.arange(90)
        pts, inten = [], []
        for side in (0, 1):
            s = p - j * 0.0032
            s = s[s >= 0]
            jj = j[:len(s)]
            y = s * (TREE_TOP + 0.1)
            th = s * 3.5 * 2 * math.pi + side * math.pi
            r = np.maximum(r_env(y), 0.12) + 0.24
            base = np.stack([r * np.cos(th), y, r * np.sin(th)], 1)
            for k in range(3):
                pts.append(base + RNG.standard_normal(base.shape) * 0.025)
                inten.append((1 - jj / 90) ** 1.6 * (1.4 if k == 0 else 0.7) * fade)
        # 꼬리에서 흩날리는 반짝 가루
        lag = p - SW_DUST_S
        dm = (lag > 0) & (lag < 0.18)
        if dm.any():
            s = SW_DUST_S[dm]
            y = s * (TREE_TOP + 0.1)
            th = s * 3.5 * 2 * math.pi + SW_DUST_SIDE[dm] * math.pi
            r = np.maximum(r_env(y), 0.12) + 0.24 + lag[dm] * 0.8
            pts.append(np.stack([r * np.cos(th), y, r * np.sin(th)], 1) + SW_DUST_OFF[dm])
            inten.append((1 - lag[dm] / 0.18) * 0.7 * fade)
        if pts:
            add_glow(G, zbuf, to_view(np.concatenate(pts), phi), rgb(SWIRL),
                     np.concatenate(inten), halo=0.25)

    apex_v = to_view(np.array([[0.0, STAR_Y, 0.0]]), phi)[0]

    # 꼭대기 8방향 번쩍
    if T_FLASH[0] <= t < T_FLASH[1]:
        tau = (t - T_FLASH[0]) / (T_FLASH[1] - T_FLASH[0])
        Ln = 1.6 * ease_out_cubic(tau / 0.45)
        k = np.linspace(0, 1, 40)
        pts, inten = [], []
        for i in range(8):
            a = i * math.pi / 4
            d = k * Ln
            pts.append(np.stack([apex_v[0] + d * math.cos(a), apex_v[1] + d * math.sin(a),
                                 np.full(40, apex_v[2] - 0.3)], 1))
            inten.append((1 - k) ** 1.2 * 1.6 * (1 - tau) ** 1.5)
        disk = fib_sphere(60) * 0.22 * (1 - tau)
        pts.append(apex_v + disk - [0, 0, 0.3])
        inten.append(np.full(60, 2.0 * (1 - tau) ** 2))
        add_glow(G, zbuf, np.concatenate(pts), rgb(FLASH), np.concatenate(inten), halo=0.35, bias=1.0)

    # 장식 볼 반짝 하이라이트
    if len(vb):
        cv = to_view(BALL_CENTER[vb], phi) + np.array([-0.4, 0.45, -0.75]) * BALL_R
        tw = 0.2 + 0.6 * (0.5 + 0.5 * np.sin(t * 3.0 + vb * 1.7)) ** 6
        add_glow(G, zbuf, cv, np.array([1.0, 1.0, 1.0]), tw, bias=0.05)

    # 전구
    vl = np.where(LIGHT_BIRTH <= t)[0]
    if len(vl):
        a = t - LIGHT_BIRTH[vl]
        inten = 0.55 + 0.45 * np.sin(t * LIGHT_FREQ[vl] + LIGHT_PHASE[vl])
        inten = inten + np.clip(1 - a / 0.25, 0, 1) * 0.9               # 켜질 때 번쩍
        if t >= T_CHASE:                                               # 빛이 줄줄이 달려감
            pos = (vl - (t - T_CHASE) * 45.0) % 28.0
            inten = inten * 0.65 + np.exp(-(pos / 2.2) ** 2) * 1.3
        add_glow(G, zbuf, to_view(LIGHT_POS[vl], phi), LIGHT_COLOR[vl], inten * 0.95, halo=0.22)

    # 꼭대기 별
    if t >= T_STAR[0]:
        sa = t - T_STAR[0]
        sc = ease_out_back(sa / 0.6)
        size = STAR_SIZE * sc
        sp = np.stack([apex_v[0] + STAR_PTS[:, 0] * size, apex_v[1] + STAR_PTS[:, 1] * size,
                       np.full(len(STAR_PTS), apex_v[2] - 0.2)], 1)
        si = (0.55 + 0.9 * (1 - STAR_PR) ** 2) * (1 + 0.15 * math.sin(t * 4))
        si = si + max(0.0, 1 - sa / 0.4) * 1.2
        # 별 한 칸에 점이 여러 개 겹치므로 칸당 점 수로 나눠 밝기를 맞춤
        per_cell = max(1.0, len(STAR_PTS) / max(1.0, 0.9 * (size * KX) * (size * KY)))
        add_glow(G, zbuf, sp, rgb(STAR_GOLD), si * 1.8 / per_cell, halo=0.12, bias=1.0)
        # 반짝이는 빛살
        k = np.linspace(0.3, 1, 18)
        pts, inten = [], []
        for i in range(8):
            ang = i * math.pi / 4 + math.pi / 8
            ln = size * (2.2 + 1.0 * math.sin(t * 5 + i * 1.9)) * (1.35 if i % 2 else 1.0)
            pts.append(np.stack([apex_v[0] + k * ln * math.cos(ang), apex_v[1] + k * ln * math.sin(ang),
                                 np.full(18, apex_v[2] - 0.2)], 1))
            inten.append((1 - k) * (0.4 + 0.5 * (0.5 + 0.5 * math.sin(t * 7 + i)) ** 3))
        add_glow(G, zbuf, np.concatenate(pts), rgb(STAR_GOLD) * 0.6 + 0.4, np.concatenate(inten),
                 bias=1.0)

    # 땅 반짝이
    if t >= T_GROUND[1]:
        tw = (0.5 + 0.5 * np.sin(t * SPARK_FREQ + SPARK_PHASE)) ** 10 * 0.6
        add_glow(G, zbuf, to_view(SPARK_POS, phi), np.array([0.9, 0.95, 1.0]), tw, bias=0.08)

    # 하트(♥): 글자로 찍고, 주변에 분홍빛
    hearts = []
    vh = np.where(HEART_BIRTH <= t)[0]
    if len(vh):
        hv = to_view(HEART_POS[vh], phi)
        hu, hvv, hz = project(hv)
        for k_, i in enumerate(vh):
            ph = (t * 1.15 + i * 0.23) % 1.0
            beat = max(math.exp(-((ph - 0.05) / 0.07) ** 2), 0.75 * math.exp(-((ph - 0.27) / 0.07) ** 2))
            pop = max(0.0, 1 - (t - HEART_BIRTH[i]) / 0.35)
            c = rgb(PINK) * (0.5 + 0.55 * beat) + pop * 0.8
            if 0 <= hu[k_] < W and 0 <= hvv[k_] < H:
                cell = hvv[k_] * W + hu[k_]
                if hz[k_] <= zbuf[cell] + 0.15:
                    hearts.append((hvv[k_], hu[k_], c))
                    for du, dv in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        uu, vv = hu[k_] + du, hvv[k_] + dv
                        if 0 <= uu < W and 0 <= vv < H:
                            G[vv * W + uu] += rgb(PINK) * (0.12 + 0.25 * beat + pop * 0.4)

    # ---------- 합치기 ----------
    bg_ch, bg_col = draw_background(t)
    zb = zbuf.reshape(H, W)
    solid = np.isfinite(zb)
    G = G.reshape(H, W, 3)
    gmax = G.max(-1)
    scol = scol.reshape(H, W, 3)
    sbr = sbr.reshape(H, W)

    fade = 1.0
    if t > T_LOOP - 0.5:                                    # 다시 시작 직전에 살짝 어두워짐
        fade = max(0.0, (T_LOOP - t) / 0.5)

    col = (np.where(solid[..., None], scol, 0) + G) * fade
    bright = (np.where(solid, sbr, 0) + gmax * 0.9) * fade
    lit = solid | (gmax * fade > 0.05)
    idx = np.clip(np.round(bright * NR), 0, NR).astype(int)
    idx = np.where(lit, np.maximum(idx, 1), idx)
    chars = RAMP[idx]
    empty = ~lit
    chars[empty] = bg_ch[empty]
    col[empty] = bg_col[empty] + G[empty] * fade

    mx = col.max(-1, keepdims=True)                         # 아주 밝으면 하얗게
    over = mx > 1.0
    wgt = np.clip((mx - 1.0) * 0.7, 0, 1)
    col = np.where(over, col / np.maximum(mx, 1e-9) * (1 - wgt) + wgt, col)

    for (r, c, hc) in hearts:
        chars[r, c] = "♥"
        col[r, c] = np.clip(hc * fade, 0, 1)

    # 내리는 눈
    if t >= T_SNOW:
        st = t - T_SNOW
        sy = SNOW_Y0 + SNOW_SPEED * st
        sy = np.where(sy > H + 1, (sy + 2) % (H + 3) - 2, sy)
        sx = SNOW_X0 + SNOW_AMP * np.sin(st * SNOW_FREQ + SNOW_PHASE)
        ri = np.floor(sy).astype(int)
        ci = np.floor(sx).astype(int) % W
        ok = (ri >= 0) & (ri < H)
        for i in np.where(ok)[0]:
            r, c = ri[i], ci[i]
            if SNOW_BEHIND[i] and lit[r, c]:
                continue
            if SNOW_HEART[i]:
                chars[r, c] = "♥"
                col[r, c] = rgb(PINK) * 0.85 * fade
            else:
                chars[r, c] = SNOW_CHARS[i]
                col[r, c] = rgb(SNOW_FLAKE) * SNOW_BRIGHT[i] * fade

    return chars, np.clip(col * 255, 0, 255).astype(np.uint8)


# ---------- 내리는 눈 준비 ----------
SNOW_X0 = RNG.uniform(0, W, NUM_SNOW)
SNOW_Y0 = -RNG.uniform(0, H * 1.1, NUM_SNOW)
SNOW_SPEED = RNG.uniform(2.5, 6.5, NUM_SNOW)
SNOW_AMP = RNG.uniform(0.5, 1.8, NUM_SNOW)
SNOW_FREQ = RNG.uniform(0.8, 2.2, NUM_SNOW)
SNOW_PHASE = RNG.uniform(0, 2 * math.pi, NUM_SNOW)
SNOW_BEHIND = RNG.random(NUM_SNOW) < 0.4
SNOW_HEART = RNG.random(NUM_SNOW) < SNOW_HEART_RATE
SNOW_CHARS = np.where(SNOW_SPEED > 5.2, "*", np.where(SNOW_SPEED > 3.8, "+", "."))
SNOW_BRIGHT = 0.55 + 0.45 * (SNOW_SPEED - 2.5) / 4.0


# =====================================================================
#  터미널 출력
# =====================================================================
def to_ansi(chars, cols, home=True):
    cols = (cols // 4) * 4
    out = ["\x1b[H" if home else "", "\x1b[48;2;0;0;0m"]
    cl = cols.tolist()
    chl = chars.tolist()
    for r in range(H):
        parts = []
        prev = None
        rc, rch = cl[r], chl[r]
        for c in range(W):
            s = rch[c]
            if s == " ":
                parts.append(" ")
                continue
            k = rc[c]
            if k != prev:
                parts.append("\x1b[38;2;%d;%d;%dm" % (k[0], k[1], k[2]))
                prev = k
            parts.append(s)
        out.append("".join(parts))
        if r < H - 1:
            out.append("\n")
    return "".join(out)


def setup_terminal():
    if os.name == "nt":
        os.system("")                     # 윈도우에서 색 코드 켜기
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def main():
    setup_terminal()

    if len(sys.argv) >= 3 and sys.argv[1] == "--snapshot":   # 한 장면만 찍어 보기
        ch, co = render(float(sys.argv[2]))
        sys.stdout.write(to_ansi(ch, co, home=False) + "\x1b[0m\n")
        return

    try:
        size = os.get_terminal_size()
        if size.columns < W or size.lines < H + 1:
            print(f"터미널 창이 작아요 (지금 {size.columns}x{size.lines}). "
                  f"가로 {W}칸 x 세로 {H + 1}줄 이상으로 키우면 더 예쁘게 보여요.")
            time.sleep(2.5)
    except OSError:
        pass

    out = sys.stdout
    out.write("\x1b[?25l\x1b[48;2;0;0;0m\x1b[2J")
    out.flush()
    start = time.perf_counter()
    try:
        while True:
            t0 = time.perf_counter()
            t = (t0 - start) % T_LOOP
            ch, co = render(t)
            out.write(to_ansi(ch, co))
            out.flush()
            dt = time.perf_counter() - t0
            time.sleep(max(0.0, 1.0 / FPS - dt))
    except KeyboardInterrupt:
        pass
    finally:
        out.write("\x1b[0m\x1b[2J\x1b[H\x1b[?25h")
        out.write("메리 크리스마스! 🎄\n")
        out.flush()


if __name__ == "__main__":
    main()
