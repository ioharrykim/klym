# KLYM

모션 시그니처 기반 크리에이티브 프로젝트 관리 앱.
카메라로 캡처한 동작(포즈)을 고유한 시그니처로 변환하고, 프로젝트 관리 및 디지털 카드 생성 기능을 제공합니다.

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **빌드**: Vite 5
- **모션 감지**: MediaPipe Pose Landmarker
- **스타일링**: CSS (커스텀)

## 시작하기

### 사전 요구사항

- Node.js 18+
- npm

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 프로젝트 구조

```
src/
├── components/     # UI 컴포넌트 (MotionSignature, ProjectForm, SendCardPreview 등)
├── hooks/          # 커스텀 훅 (useMotionSignature, useProjects, useSendCards)
├── lib/            # 유틸리티 및 비즈니스 로직
│   ├── motion/     # 포즈 감지, 프레임 추출, 정규화
│   ├── sendCard/   # 카드 이미지 생성
│   ├── data.ts     # 기본 데이터/스타일
│   ├── signature.ts
│   ├── storage.ts  # 로컬 스토리지 관리
│   └── tokens.ts   # 디자인 토큰
├── screens/        # 화면 컴포넌트 (Dashboard, MotionFlow, Projects 등)
├── types/          # TypeScript 타입 정의
├── App.tsx         # 메인 앱 컴포넌트
└── main.tsx        # 엔트리 포인트

public/
├── models/         # MediaPipe 포즈 모델 (.task)
└── mediapipe/wasm/ # MediaPipe WASM 바이너리
```

## 주요 기능

- **모션 시그니처**: 카메라로 신체 동작을 캡처하여 고유한 시각적 시그니처 생성
- **프로젝트 관리**: 프로젝트 생성, 편집, 시그니처 연결
- **Send Card**: 프로젝트 정보가 담긴 디지털 카드 생성 및 내보내기
- **대시보드**: 프로젝트 현황 및 세션 요약

## 라이선스

Private
