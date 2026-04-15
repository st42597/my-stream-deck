# RAM Usage Monitor

## 개요

Apple Silicon Mac의 메모리 압력(Memory Pressure)을 area chart + 퍼센트로 표시.  
Activity Monitor의 메모리 압력 그래프와 동일한 값.

## 표시 내용

```
┌─────────────────────────┐
│ RAM                      │  ← 레이블 (17px)
│         ___              │
│   _____/   \___          │  ← area chart
│  /                       │
│                          │
│          41%             │  ← 메모리 압력 %
└─────────────────────────┘
```

- 액센트 컬러: `#ff9500` (주황)
- 85% 이상: `#ff3b30` (빨강)

## 데이터 수집 — Memory Pressure 방식

**명령어**: `memory_pressure`

```
System-wide memory free percentage: 59%
→ 메모리 압력(used) = 100 - 59 = 41%
```

### 왜 이 방식인가

macOS는 inactive 메모리를 캐시로 활용하므로 단순히 `(total - free) / total`로 계산하면 97% 같은 과도한 수치가 나옴.

`memory_pressure`는 XNU 커널의 `memorystatus_available_pages`를 기반으로 계산되며, Activity Monitor 메모리 압력 그래프와 동일한 데이터 소스.

| 방식 | 수치 | 문제 |
|------|------|------|
| `(total - free - speculative) / total` | 97% | inactive 포함으로 과도하게 높음 |
| `memory_pressure` (채택) | 41% | Activity Monitor와 동일, 정확 |

## 설정 (Property Inspector)

CPU와 동일한 `inspector/system.html` 공용 사용.

| 항목 | 값 |
|------|----|
| Chart Window | **30s** / **1m** / **2m** |

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/actions/ramAction.ts` | 액션 로직 |
| `src/utils/systemStats.ts` | CPU/RAM 샘플링 공유 (`getRamPercent`) |
| `src/utils/renderChart.ts` | area chart SVG 렌더링 (CPU와 공용) |
| `inspector/system.html` | Chart Window 선택 UI |
