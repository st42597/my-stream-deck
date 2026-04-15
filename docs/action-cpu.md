# CPU Usage Monitor

## 개요

Apple Silicon Mac의 CPU 사용률을 area chart + 퍼센트로 표시.  
5초 간격 샘플링, 선택한 시간 범위(30s/1m/2m)의 히스토리를 배경 차트로 표시.

## 표시 내용

```
┌─────────────────────────┐
│ CPU                      │  ← 레이블 (17px)
│    ___                   │
│   /   \    area chart    │  ← 선택한 윈도우의 히스토리
│__/     \__/              │
│                          │
│          72%             │  ← 현재 CPU 사용률
└─────────────────────────┘
```

- 85% 이상: 차트/텍스트 색상이 `#ff3b30` (빨강)
- 액센트 컬러: `#00ff88` (터미널 그린)
- 배경: `#0a0a0a`

## 데이터 수집

**명령어**: `top -l 2 -n 0 -s 1`

`-l 2`로 두 번 샘플링해서 두 번째(더 정확한) 값 사용.

```
CPU usage: 3.42% user, 9.4% sys, 87.53% idle
→ CPU % = 100 - idle% = 12.82%
```

- 5초마다 CPU + RAM을 동시 수집 (`Promise.all`)
- 최대 24개 샘플 유지 (2분치)
- CPU/RAM 버튼이 각각 `startPolling()` / `stopPolling()` 호출 → refCount로 공유 관리

## 설정 (Property Inspector)

| 항목 | 값 |
|------|----|
| Chart Window | **30s** / **1m** / **2m** |

윈도우 변경 시 해당 범위의 샘플만 차트에 표시 (샘플 재수집 불필요).

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/actions/cpuAction.ts` | 액션 로직, 5초 디스플레이 갱신 |
| `src/utils/systemStats.ts` | CPU/RAM 샘플링 공유 모듈 |
| `src/utils/renderChart.ts` | area chart SVG 렌더링 |
| `inspector/system.html` | Chart Window 선택 UI (CPU/RAM 공용) |
