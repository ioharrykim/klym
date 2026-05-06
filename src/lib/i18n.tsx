import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type {
  AttemptResult,
  ClimbEnvironment,
  MotionCompletionStatus,
  MotionProcessingState,
  MotionProblemStyle,
  MotionSignatureSource,
  MotionSignatureStyle,
  MotionTrackingMode,
  ProjectStatus,
  SendCardBackgroundMode,
  SendCardFormat,
  SendCardLayout,
  SendCardTextTone,
} from '../types/klym';
import { readJson, storageKeys, writeJson } from './storage';

export type Language = 'ko' | 'en';

type Tokens = Record<string, string | number>;

const translations = {
  en: {
    'app.tagline': 'CLIMB. TRACE. SHARE.',
    'stage.version': 'MVP · v0.1',
    'stage.localFirst': 'LOCAL-FIRST',
    'language.label': 'LANGUAGE',
    'language.korean': 'Korean',
    'language.english': 'English',
    'tab.home': 'HOME',
    'tab.projects': 'PROJECTS',
    'tab.send': 'CARDS',
    'tab.sessions': 'SESSIONS',
    'tab.me': 'ME',
    'common.back': 'BACK',
    'common.close': 'CLOSE',
    'common.skip': 'SKIP',
    'common.start': 'START',
    'common.project': 'PROJECT',
    'common.projects': 'PROJECTS',
    'common.signature': 'SIGNATURE',
    'common.style': 'STYLE',
    'common.grade': 'GRADE',
    'common.status': 'STATUS',
    'common.notes': 'NOTES',
    'common.date': 'DATE',
    'common.result': 'RESULT',
    'common.attempts': 'ATTEMPTS',
    'common.days': 'DAYS',
    'common.tries': 'TRIES',
    'common.open': 'OPEN',
    'common.sent': 'SENT',
    'common.cards': 'CARDS',
    'common.export': 'Export',
    'common.persistence': 'Persistence',
    'common.videoFiles': 'Video files',
    'common.notStored': 'Not stored',
    'common.localData': 'LOCAL DATA',
    'common.viewAll': 'VIEW ALL',
    'common.createProject': 'START A LINE',
    'common.newProject': 'NEW LINE',
    'common.saveProject': 'SAVE LINE',
    'common.delete': 'DELETE',
    'common.archiveProject': 'ARCHIVE PROJECT',
    'common.manual': 'MANUAL',
    'common.manualFix': 'MANUAL FIX',
    'common.manualCorrection': 'MANUAL CORRECTION',
    'common.buildCard': 'MAKE CARD',
    'common.sendVideo': 'SEND VIDEO',
    'common.frames': '{count} FRAMES',
    'placeholder.projectName': 'CONCRETE TRAVERSE',
    'placeholder.localName': '콘크리트 트래버스',
    'placeholder.gym': 'GYM NAME',
    'placeholder.wall': 'WALL 03',
    'placeholder.grade': 'V6',
    'dashboard.firstRunKicker': 'KLYM // SEND TO CARD',
    'dashboard.firstRunTitle': 'DRAW THE SEND.',
    'dashboard.firstRunBody': 'Choose a clip. See the move. Export the card. No login, no upload.',
    'dashboard.quickSend': 'QUICK SEND',
    'dashboard.fullProjectLog': 'TRACK A PROJECT',
    'dashboard.step1Title': 'LOAD CLIP',
    'dashboard.step1Body': 'Pick MP4 or MOV.',
    'dashboard.step2Title': 'TRACE MOVE',
    'dashboard.step2Body': 'Find the line.',
    'dashboard.step3Title': 'NAME LINE',
    'dashboard.step3Body': 'Add grade or color.',
    'dashboard.step4Title': 'SHARE CARD',
    'dashboard.step4Body': 'Export PNG or video.',
    'dashboard.title': 'WHAT DID YOU SEND?',
    'dashboard.localSummary': '{projects} lines stored locally · {attempts} attempt logs',
    'dashboard.quickHeroTitle': 'MAKE THE CARD.',
    'dashboard.quickHeroBody': 'Pick the clip. Name the line. Share the send.',
    'dashboard.focus': 'TODAY\'S FOCUS',
    'dashboard.betaAttempts': 'BETA · {count} ATTEMPTS',
    'dashboard.continueProject': 'CONTINUE PROJECT',
    'dashboard.noProjectsTitle': 'START WITH ONE LINE',
    'dashboard.noProjectsBody': 'Log the climb. Build the card when it goes.',
    'dashboard.uploadToProject': 'ADD CLIP',
    'dashboard.attachSignature': 'TRACE THIS LINE',
    'dashboard.addProject': 'START LINE',
    'dashboard.newLine': 'NEW LINE',
    'dashboard.recentSends': 'RECENT SENDS',
    'dashboard.recentActivity': 'RECENT ACTIVITY',
    'dashboard.attemptsLogged': '{count} attempts logged',
    'projects.firstLine': 'FIRST LINE',
    'projects.title': 'PROJECTS',
    'projects.noLocalData': 'NO LOCAL DATA YET',
    'projects.summary': '{filtered} LINES · {sent} SENT',
    'projects.gridView': 'Grid view',
    'projects.listView': 'List view',
    'projects.create': 'Create project',
    'projects.allGyms': 'ALL GYMS',
    'projects.allGrades': 'ALL GRADES',
    'projects.emptyFirstTitle': 'START YOUR FIRST LINE',
    'projects.emptyFirstBody': 'Add the wall, grade, and beta. Bring the clip when it goes.',
    'projects.emptyFilteredTitle': 'NO LINES FOUND',
    'projects.emptyFilteredBody': 'Clear a filter or start a new line.',
    'projectForm.editLine': 'EDIT LINE',
    'projectForm.newLine': 'NEW LINE',
    'projectForm.createProject': 'CREATE PROJECT',
    'projectForm.projectName': 'PROJECT NAME',
    'projectForm.localName': 'KOREAN / LOCAL NAME',
    'projectForm.gym': 'GYM',
    'projectForm.environment': 'CLIMB TYPE',
    'projectForm.wall': 'WALL',
    'projectForm.betaNotes': 'BETA NOTES',
    'projectForm.nextStrategy': 'NEXT ATTEMPT STRATEGY',
    'projectForm.attemptLog': 'ATTEMPT LOG',
    'projectForm.addTry': 'ADD TRY',
    'projectForm.addAttempt': 'ADD ATTEMPT',
    'grade.type': 'Grade type',
    'grade.vScale': 'V SCALE',
    'grade.color': 'COLOR',
    'grade.pickColor': 'Pick {color}',
    'grade.pickNamedColor': 'Pick {name}',
    'grade.pickCustom': 'Pick custom color',
    'environment.indoor': 'INDOOR',
    'environment.outdoor': 'OUTDOOR',
    'projectDetail.back': 'Back',
    'projectDetail.edit': 'Edit project',
    'projectDetail.betaNext': 'BETA · NEXT TRY',
    'projectDetail.noBeta': 'No beta stored yet.',
    'projectDetail.projectNotes': 'PROJECT NOTES',
    'projectDetail.noNotes': 'No notes yet.',
    'projectDetail.attemptLog': 'ATTEMPT LOG',
    'projectDetail.noAttempts': 'No attempts logged yet.',
    'projectDetail.noAttemptNotes': 'No notes on this attempt.',
    'projectDetail.try': 'TRY',
    'projectDetail.markSentUpload': 'UPLOAD CLIP',
    'projectDetail.uploadSend': 'UPLOAD SEND',
    'motion.header': 'MOTION SIGNATURE / {state}',
    'motion.createFirstTitle': 'START A LINE FIRST',
    'motion.createFirstBody': 'Add the wall and grade. Then trace the send clip.',
    'motion.quickBannerBody': 'Go straight from clip to card.',
    'motion.quickUploadTitle': 'LOAD THE SEND.',
    'motion.uploadTitle': 'LOAD THE CLIP.',
    'motion.quickUploadBody': 'Pick the climb. KLYM traces it. You name it.',
    'motion.uploadBody': 'KLYM reads the move, marks the crux, and keeps manual fixes close.',
    'motion.selectVideoAria': 'Select a send video from your photo library',
    'motion.selectGallery': 'SELECT FROM GALLERY',
    'motion.videoHint': 'MP4 / MOV · sampled in-browser',
    'motion.generateSignature': 'TRACE LINE',
    'motion.howItWorks': 'WHAT HAPPENS',
    'motion.howItWorksBody': 'KLYM samples the clip, compares body, hand, foot, and wrist routes, then draws the cleanest line.',
    'motion.sourceVideo': '[ SOURCE VIDEO ]',
    'motion.manualError': 'TRACE NEEDS A FIX',
    'motion.manualHelp': 'Tap the climber on three frames. KLYM will rebuild the line.',
    'motion.sampleFrame': 'Sample frame {index}',
    'motion.generateFromPoints': 'BUILD FROM {count} POINTS',
    'motion.readyKicker': 'LINE READY · {source} · {score}%',
    'motion.readyTitle': 'LINE LOCKED.',
    'motion.finishCard': 'FINISH STRONG',
    'motion.nameSend': 'NAME THE SEND.',
    'motion.gymOptional': 'GYM (OPTIONAL)',
    'motion.wallOptional': 'WALL (OPTIONAL)',
    'motion.topHold': 'TOP HOLD',
    'motion.fallAt': 'FALL · {progress}%',
    'motion.labelTop': 'TOP',
    'motion.labelMotion': 'MOTION',
    'motion.saveBuildCard': 'SAVE · MAKE CARD',
    'motion.autoFailed': 'The trace needs your touch.',
    'motion.videoFailed': 'Clip failed to load.',
    'motion.manualNote': 'Line built from your selected frame points.',
    'send.header': 'SEND CARD / EXPORT',
    'send.title': 'SEND CARD',
    'send.body': 'Set the look. Export the proof.',
    'send.noProjectTitle': 'NO SENDS YET',
    'send.noProjectBody': 'Trace a clip first. Then make the card.',
    'send.noSignatureTitle': 'NO LINE TRACE',
    'send.noSignatureBody': 'Add a traced send before export.',
    'send.generateSignature': 'TRACE CLIP',
    'send.reflection': 'REFLECTION',
    'send.defaultReflection': 'Committed to the move. Finished the line.',
    'send.defaultReflectionKo': '무브에 걸고, 라인을 끝냈다.',
    'send.photoLoaded': 'PHOTO BACKGROUND LOADED',
    'send.selectAlbumPhoto': 'SELECT ALBUM PHOTO',
    'send.textWhite': 'TEXT WHITE',
    'send.textBlack': 'TEXT BLACK',
    'send.exporting': 'EXPORTING',
    'send.exportPng': 'EXPORT PNG',
    'send.capturing': 'CAPTURING',
    'send.saveVideo': 'SAVE VIDEO',
    'send.preparing': 'PREPARING',
    'send.recording': 'RECORDING',
    'send.encoding': 'ENCODING',
    'send.shared': 'SHARED',
    'send.shareCancelled': 'SHARE CANCELLED',
    'send.saved': 'SAVED {type}',
    'send.exportFailed': 'EXPORT FAILED',
    'send.colorGradeAria': 'Color grade: {color}',
    'sessions.title': 'SESSIONS',
    'sessions.subtitle': '{count} LOGGED EVENTS',
    'sessions.recentAttempts': 'RECENT ATTEMPTS',
    'sessions.emptyTitle': 'NO ATTEMPTS YET',
    'sessions.emptyBody': 'Log an attempt from a project to see the session timeline here.',
    'profile.title': 'PROFILE',
    'profile.subtitle': '@klym.local · THE CLIMB · SEONGSU',
    'profile.name': 'KLYM LOCAL',
    'profile.tagline': 'Climb. Trace. Share.',
    'profile.projects': 'PROJECTS',
    'profile.sends': 'SENDS',
    'profile.language': 'Language',
    'profile.videoFilesValue': 'Original clips stay on device',
    'onboarding.skip': 'SKIP',
    'onboarding.kicker': 'KLYM // 003',
    'onboarding.title': 'DRAW EVERY SEND.',
    'onboarding.body': 'Trace the climb. Keep the line. Share the card.',
    'onboarding.ready': 'MOTION SIGNATURE READY',
    'onboarding.sampleProject': 'CONCRETE TRAVERSE',
    'onboarding.start': 'GET STARTED',
  },
  ko: {
    'app.tagline': '오르고, 그리고, 공유하세요',
    'stage.version': 'MVP · v0.1',
    'stage.localFirst': '로컬 우선',
    'language.label': '언어',
    'language.korean': '한국어',
    'language.english': 'English',
    'tab.home': '홈',
    'tab.projects': '프로젝트',
    'tab.send': '카드',
    'tab.sessions': '세션',
    'tab.me': '내 정보',
    'common.back': '뒤로',
    'common.close': '닫기',
    'common.skip': '건너뛰기',
    'common.start': '시작',
    'common.project': '프로젝트',
    'common.projects': '프로젝트',
    'common.signature': '시그니처',
    'common.style': '스타일',
    'common.grade': '난이도',
    'common.status': '상태',
    'common.notes': '메모',
    'common.date': '날짜',
    'common.result': '결과',
    'common.attempts': '시도',
    'common.days': '일수',
    'common.tries': '시도',
    'common.open': '진행',
    'common.sent': '완등',
    'common.cards': '카드',
    'common.export': '내보내기',
    'common.persistence': '저장 방식',
    'common.videoFiles': '영상 파일',
    'common.notStored': '저장 안 함',
    'common.localData': '로컬 데이터',
    'common.viewAll': '전체 보기',
    'common.createProject': '라인 시작',
    'common.newProject': '새 라인',
    'common.saveProject': '라인 저장',
    'common.delete': '삭제',
    'common.archiveProject': '프로젝트 보관',
    'common.manual': '수동',
    'common.manualFix': '수동 보정',
    'common.manualCorrection': '수동 보정',
    'common.buildCard': '카드 만들기',
    'common.sendVideo': '센드 영상',
    'common.frames': '{count} 프레임',
    'placeholder.projectName': '예: 콘크리트 트래버스',
    'placeholder.localName': '콘크리트 트래버스',
    'placeholder.gym': '클라이밍장 이름',
    'placeholder.wall': '예: 3번 벽',
    'placeholder.grade': '예: V6',
    'dashboard.firstRunKicker': 'KLYM // SEND TO CARD',
    'dashboard.firstRunTitle': '완등을 그리세요.',
    'dashboard.firstRunBody': '영상을 고르고, 움직임을 확인하고, 기기 안에서 바로 저장하세요.',
    'dashboard.quickSend': '바로 만들기',
    'dashboard.fullProjectLog': '프로젝트 기록',
    'dashboard.step1Title': '영상 선택',
    'dashboard.step1Body': 'MP4나 MOV를 고릅니다.',
    'dashboard.step2Title': '움직임 추적',
    'dashboard.step2Body': '가장 정확한 라인을 찾습니다.',
    'dashboard.step3Title': '라인 이름',
    'dashboard.step3Body': '난이도와 컬러를 더합니다.',
    'dashboard.step4Title': '카드 공유',
    'dashboard.step4Body': '이미지나 영상으로 저장합니다.',
    'dashboard.title': '무엇을 완등했나요?',
    'dashboard.localSummary': '로컬에 {projects}개 라인 · {attempts}개 시도 기록',
    'dashboard.quickHeroTitle': '바로 카드로.',
    'dashboard.quickHeroBody': '영상을 고르고, 라인을 이름 붙이고, 바로 공유하세요.',
    'dashboard.focus': '오늘의 포커스',
    'dashboard.betaAttempts': '베타 · {count}번 시도',
    'dashboard.continueProject': '프로젝트 계속하기',
    'dashboard.noProjectsTitle': '첫 라인을 시작하세요',
    'dashboard.noProjectsBody': '문제를 기록하고, 완등하면 카드로 남기세요.',
    'dashboard.uploadToProject': '영상 추가',
    'dashboard.attachSignature': '라인 추적',
    'dashboard.addProject': '라인 시작',
    'dashboard.newLine': '새 라인',
    'dashboard.recentSends': '최근 센드',
    'dashboard.recentActivity': '최근 활동',
    'dashboard.attemptsLogged': '{count}번 시도 기록',
    'projects.firstLine': '첫 라인',
    'projects.title': '프로젝트',
    'projects.noLocalData': '아직 로컬 데이터 없음',
    'projects.summary': '{filtered}개 라인 · {sent}개 완등',
    'projects.gridView': '그리드 보기',
    'projects.listView': '리스트 보기',
    'projects.create': '프로젝트 만들기',
    'projects.allGyms': '전체 클라이밍장',
    'projects.allGrades': '전체 난이도',
    'projects.emptyFirstTitle': '첫 라인을 시작하세요',
    'projects.emptyFirstBody': '벽, 난이도, 베타를 적어두세요. 완등 영상은 나중에 붙이면 됩니다.',
    'projects.emptyFilteredTitle': '라인이 없습니다',
    'projects.emptyFilteredBody': '필터를 지우거나 새 라인을 시작하세요.',
    'projectForm.editLine': '라인 수정',
    'projectForm.newLine': '새 라인',
    'projectForm.createProject': '프로젝트 만들기',
    'projectForm.projectName': '프로젝트 이름',
    'projectForm.localName': '한글 / 로컬 이름',
    'projectForm.gym': '클라이밍장',
    'projectForm.environment': '등반 타입',
    'projectForm.wall': '벽',
    'projectForm.betaNotes': '베타 메모',
    'projectForm.nextStrategy': '다음 시도 전략',
    'projectForm.attemptLog': '시도 기록',
    'projectForm.addTry': '시도 추가',
    'projectForm.addAttempt': '시도 저장',
    'grade.type': '난이도 타입',
    'grade.vScale': 'V스케일',
    'grade.color': '컬러',
    'grade.pickColor': '{color} 선택',
    'grade.pickNamedColor': '{name} 홀드 선택',
    'grade.pickCustom': '직접 색상 선택',
    'environment.indoor': '실내',
    'environment.outdoor': '자연바위',
    'projectDetail.back': '뒤로',
    'projectDetail.edit': '프로젝트 수정',
    'projectDetail.betaNext': '베타 · 다음 시도',
    'projectDetail.noBeta': '아직 저장된 베타가 없어요.',
    'projectDetail.projectNotes': '프로젝트 메모',
    'projectDetail.noNotes': '아직 메모가 없어요.',
    'projectDetail.attemptLog': '시도 기록',
    'projectDetail.noAttempts': '아직 시도 기록이 없어요.',
    'projectDetail.noAttemptNotes': '이 시도에는 메모가 없어요.',
    'projectDetail.try': '시도',
    'projectDetail.markSentUpload': '영상 업로드',
    'projectDetail.uploadSend': '완등 영상 업로드',
    'motion.header': '모션 시그니처 / {state}',
    'motion.createFirstTitle': '라인부터 시작하세요',
    'motion.createFirstBody': '벽과 난이도를 먼저 적고, 완등 영상을 추적하세요.',
    'motion.quickBannerBody': '영상에서 카드까지 바로 갑니다.',
    'motion.quickUploadTitle': '완등 영상을 고르세요.',
    'motion.uploadTitle': '영상을 고르세요.',
    'motion.quickUploadBody': 'KLYM이 움직임을 읽고, 당신이 이름을 붙입니다.',
    'motion.uploadBody': 'KLYM이 움직임을 읽고, 크럭스를 표시하고, 필요하면 직접 고칠 수 있게 합니다.',
    'motion.selectVideoAria': '사진첩에서 클라이밍 영상 선택',
    'motion.selectGallery': '영상 선택',
    'motion.videoHint': '사진첩에서 MP4 / MOV 가져오기',
    'motion.generateSignature': '라인 추적',
    'motion.howItWorks': '이렇게 읽습니다',
    'motion.howItWorksBody': '프레임을 샘플링하고 몸, 손, 발, 손목 경로를 비교해 가장 깨끗한 라인을 그립니다.',
    'motion.sourceVideo': '[ 원본 영상 ]',
    'motion.manualError': '라인을 다듬어주세요',
    'motion.manualHelp': '프레임 3개에서 클라이머를 탭하세요. KLYM이 라인을 다시 만듭니다.',
    'motion.sampleFrame': '샘플 프레임 {index}',
    'motion.generateFromPoints': '{count}개 포인트로 만들기',
    'motion.readyKicker': '라인 준비 · {source} · {score}%',
    'motion.readyTitle': '라인이 잡혔습니다.',
    'motion.finishCard': '마무리까지',
    'motion.nameSend': '완등에 이름을 붙이세요.',
    'motion.gymOptional': '클라이밍장 (선택)',
    'motion.wallOptional': '벽 (선택)',
    'motion.topHold': '탑 홀드',
    'motion.fallAt': '추락 · {progress}%',
    'motion.labelTop': '탑',
    'motion.labelMotion': '모션',
    'motion.saveBuildCard': '저장 · 카드 만들기',
    'motion.autoFailed': '라인에 손길이 필요합니다.',
    'motion.videoFailed': '영상을 불러오지 못했습니다.',
    'motion.manualNote': '선택한 프레임 포인트로 라인을 만들었습니다.',
    'send.header': '센드 카드 / 내보내기',
    'send.title': '센드 카드',
    'send.body': '룩을 고르고, 완등을 내보내세요.',
    'send.noProjectTitle': '아직 완등이 없습니다',
    'send.noProjectBody': '먼저 영상을 추적하고 카드를 만드세요.',
    'send.noSignatureTitle': '추적된 라인이 없습니다',
    'send.noSignatureBody': '내보내기 전에 완등 영상을 추적하세요.',
    'send.generateSignature': '영상 추적',
    'send.reflection': '리플렉션',
    'send.defaultReflection': 'Committed to the move. Finished the line.',
    'send.defaultReflectionKo': '무브에 걸고, 라인을 끝냈다.',
    'send.photoLoaded': '사진 배경 불러옴',
    'send.selectAlbumPhoto': '앨범 사진 선택',
    'send.textWhite': '흰색 텍스트',
    'send.textBlack': '검은색 텍스트',
    'send.exporting': '내보내는 중',
    'send.exportPng': 'PNG 내보내기',
    'send.capturing': '캡처 중',
    'send.saveVideo': '영상 저장',
    'send.preparing': '준비 중',
    'send.recording': '녹화 중',
    'send.encoding': '인코딩 중',
    'send.shared': '공유됨',
    'send.shareCancelled': '공유 취소됨',
    'send.saved': '{type} 저장됨',
    'send.exportFailed': '내보내기 실패',
    'send.colorGradeAria': '컬러 난이도: {color}',
    'sessions.title': '세션',
    'sessions.subtitle': '{count}개 기록',
    'sessions.recentAttempts': '최근 시도',
    'sessions.emptyTitle': '아직 시도 기록이 없어요',
    'sessions.emptyBody': '프로젝트에서 시도를 저장하면 이곳에 세션 흐름이 쌓입니다.',
    'profile.title': '내 정보',
    'profile.subtitle': '@klym.local · 더클라임 · 성수',
    'profile.name': 'KLYM 로컬',
    'profile.tagline': '오르고, 그리고, 공유하세요.',
    'profile.projects': '프로젝트',
    'profile.sends': '완등',
    'profile.language': '언어',
    'profile.videoFilesValue': '원본 영상은 기기에만 보관',
    'onboarding.skip': '건너뛰기',
    'onboarding.kicker': 'KLYM // 003',
    'onboarding.title': '완등마다 라인을 남기세요.',
    'onboarding.body': '등반을 추적하고, 라인을 저장하고, 카드로 공유하세요.',
    'onboarding.ready': '모션 시그니처 준비 완료',
    'onboarding.sampleProject': '콘크리트 트래버스',
    'onboarding.start': '시작하기',
  },
} as const satisfies Record<Language, Record<string, string>>;

export type TranslationKey = keyof typeof translations.en;

const statusLabels: Record<Language, Record<ProjectStatus | 'all', string>> = {
  en: {
    all: 'ALL',
    projecting: 'PROJECTING',
    close: 'CLOSE',
    sent: 'SENT',
    archived: 'ARCHIVED',
  },
  ko: {
    all: '전체',
    projecting: '진행 중',
    close: '거의 됨',
    sent: '완등',
    archived: '보관됨',
  },
};

const attemptResultLabels: Record<Language, Record<AttemptResult, string>> = {
  en: {
    attempt: 'ATTEMPT',
    highpoint: 'HIGHPOINT',
    beta: 'BETA',
    close: 'CLOSE',
    send: 'SEND',
    dnf: 'DNF',
  },
  ko: {
    attempt: '시도',
    highpoint: '최고 지점',
    beta: '베타',
    close: '거의 성공',
    send: '완등',
    dnf: '중단',
  },
};

const styleLabels: Record<Language, Record<MotionSignatureStyle, string>> = {
  en: {
    dynamic: 'DYNAMIC',
    refined: 'REFINED',
    editorial: 'EDITORIAL',
    data: 'DATA',
  },
  ko: {
    dynamic: '다이내믹',
    refined: '정제형',
    editorial: '에디토리얼',
    data: '데이터',
  },
};

const sourceLabels: Record<Language, Record<MotionSignatureSource, string>> = {
  en: {
    auto: 'AUTO',
    assisted: 'ASSISTED',
    manual: 'MANUAL',
  },
  ko: {
    auto: '자동',
    assisted: '보정',
    manual: '수동',
  },
};

const trackingModeLabels: Record<Language, Record<MotionTrackingMode, string>> = {
  en: {
    'body-center': 'BODY CENTER',
    hands: 'HAND ROUTE',
    feet: 'FOOT ROUTE',
    'crux-wrist': 'CRUX WRIST',
  },
  ko: {
    'body-center': '몸 중심',
    hands: '손 루트',
    feet: '발 루트',
    'crux-wrist': '크럭스 손목',
  },
};

const problemStyleLabels: Record<Language, Record<MotionProblemStyle, string>> = {
  en: {
    slab: 'SLAB',
    vertical: 'VERTICAL',
    overhang: 'OVERHANG',
    coordination: 'COORDINATION',
    unknown: 'UNKNOWN',
  },
  ko: {
    slab: '슬랩',
    vertical: '버티컬',
    overhang: '오버행',
    coordination: '코디네이션',
    unknown: '미확인',
  },
};

const environmentLabels: Record<Language, Record<ClimbEnvironment, string>> = {
  en: {
    indoor: 'INDOOR',
    outdoor: 'OUTDOOR',
  },
  ko: {
    indoor: '실내',
    outdoor: '자연바위',
  },
};

const completionStatusLabels: Record<Language, Record<MotionCompletionStatus, string>> = {
  en: {
    send: 'SEND',
    fall: 'FALL',
    attempt: 'ATTEMPT',
    topout: 'TOP OUT',
    unknown: 'CHECK NEEDED',
  },
  ko: {
    send: '완등',
    fall: '추락',
    attempt: '시도',
    topout: '탑아웃',
    unknown: '확인 필요',
  },
};

const formatLabels: Record<Language, Record<SendCardFormat, string>> = {
  en: {
    square: 'FEED 1:1',
    'feed-tall': 'FEED 4:5',
    story: 'STORY 9:16',
  },
  ko: {
    square: '피드 1:1',
    'feed-tall': '피드 4:5',
    story: '스토리 9:16',
  },
};

const backgroundLabels: Record<Language, Record<SendCardBackgroundMode, string>> = {
  en: {
    video: 'MOTION VIDEO',
    'video-frames': 'VIDEO CUTS',
    signature: 'GRAPHIC BG',
    photo: 'PHOTO BG',
  },
  ko: {
    video: '모션 영상',
    'video-frames': '영상 컷',
    signature: '그래픽 배경',
    photo: '사진 배경',
  },
};

const layoutLabels: Record<Language, Record<SendCardLayout, string>> = {
  en: {
    hero: 'HERO',
    blueprint: 'BLUEPRINT',
    poster: 'POSTER',
  },
  ko: {
    hero: '히어로',
    blueprint: '블루프린트',
    poster: '포스터',
  },
};

const textToneLabels: Record<Language, Record<SendCardTextTone, string>> = {
  en: {
    light: 'TEXT WHITE',
    dark: 'TEXT BLACK',
  },
  ko: {
    light: '흰색 텍스트',
    dark: '검은색 텍스트',
  },
};

const processingLabels: Record<Language, Record<MotionProcessingState, string>> = {
  en: {
    idle: '01·UPLOAD',
    'video-selected': '01·VIDEO SELECTED',
    'extracting-frames': '02·FRAMES',
    'detecting-motion': '03·DETECT',
    'generating-signature': '04·GENERATE',
    'signature-ready': '05·READY',
    failed: 'MANUAL',
  },
  ko: {
    idle: '01·업로드',
    'video-selected': '01·영상 선택됨',
    'extracting-frames': '02·프레임',
    'detecting-motion': '03·감지',
    'generating-signature': '04·생성',
    'signature-ready': '05·준비 완료',
    failed: '수동',
  },
};

const processingTitles: Record<Language, Record<Extract<MotionProcessingState, 'extracting-frames' | 'detecting-motion' | 'generating-signature'>, string>> = {
  en: {
    'extracting-frames': 'EXTRACTING FRAMES',
    'detecting-motion': 'DETECTING MOTION',
    'generating-signature': 'GENERATING SIGNATURE',
  },
  ko: {
    'extracting-frames': '프레임 추출 중',
    'detecting-motion': '움직임 감지 중',
    'generating-signature': '시그니처 생성 중',
  },
};

const processStepLabels: Record<Language, string[]> = {
  en: ['VIDEO SELECTED', 'EXTRACTING FRAMES', 'DETECTING MOTION', 'GENERATING SIGNATURE'],
  ko: ['영상 선택됨', '프레임 추출', '움직임 감지', '시그니처 생성'],
};

const motionEventLabels: Record<Language, Record<string, string>> = {
  en: {
    start: 'START',
    dyno: 'DYNO / POWER MOVE',
    crux: 'CRUX',
    match: 'MATCH',
    topout: 'TOP OUT',
    fall: 'FALL',
  },
  ko: {
    start: '시작',
    dyno: '다이노 / 파워 무브',
    crux: '핵심 구간',
    match: '합손',
    topout: '탑아웃',
    fall: '추락',
  },
};

interface I18nValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, tokens?: Tokens) => string;
  status: (status: ProjectStatus | 'all') => string;
  attemptResult: (result: AttemptResult) => string;
  style: (style: MotionSignatureStyle) => string;
  source: (source: MotionSignatureSource) => string;
  trackingMode: (mode: MotionTrackingMode) => string;
  problemStyle: (style: MotionProblemStyle) => string;
  environment: (environment: ClimbEnvironment) => string;
  completionStatus: (status: MotionCompletionStatus) => string;
  format: (format: SendCardFormat) => string;
  background: (mode: SendCardBackgroundMode) => string;
  layout: (layout: SendCardLayout) => string;
  textTone: (tone: SendCardTextTone) => string;
  processingState: (state: MotionProcessingState) => string;
  processingTitle: (state: Extract<MotionProcessingState, 'extracting-frames' | 'detecting-motion' | 'generating-signature'>) => string;
  processSteps: string[];
  motionEvent: (type: string, fallback: string) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(() =>
    readJson<Language | null>(storageKeys.language, null, isStoredLanguage) || detectLanguage(),
  );

  useEffect(() => {
    writeJson(storageKeys.language, language);
    document.documentElement.lang = language;
    document.documentElement.dataset.lang = language;
  }, [language]);

  const value = useMemo<I18nValue>(() => {
    const t = (key: TranslationKey, tokens?: Tokens) => {
      let phrase: string = translations[language][key] || translations.en[key] || key;
      if (!tokens) return phrase;
      Object.entries(tokens).forEach(([token, value]) => {
        phrase = phrase.split(`{${token}}`).join(String(value));
      });
      return phrase;
    };

    return {
      language,
      locale: language === 'ko' ? 'ko-KR' : 'en-US',
      setLanguage: setLanguageState,
      t,
      status: (status) => statusLabels[language][status],
      attemptResult: (result) => attemptResultLabels[language][result],
      style: (style) => styleLabels[language][style],
      source: (source) => sourceLabels[language][source],
      trackingMode: (mode) => trackingModeLabels[language][mode],
      problemStyle: (style) => problemStyleLabels[language][style],
      environment: (environment) => environmentLabels[language][environment],
      completionStatus: (status) => completionStatusLabels[language][status],
      format: (format) => formatLabels[language][format],
      background: (mode) => backgroundLabels[language][mode],
      layout: (layout) => layoutLabels[language][layout],
      textTone: (tone) => textToneLabels[language][tone],
      processingState: (state) => processingLabels[language][state],
      processingTitle: (state) => processingTitles[language][state],
      processSteps: processStepLabels[language],
      motionEvent: (type, fallback) => motionEventLabels[language][type] || fallback,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider.');
  return value;
}

function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
  const normalized = languages.map((language) => language.toLowerCase());
  if (normalized.some((language) => language.startsWith('ko') || language.includes('-kr'))) return 'ko';

  try {
    const region = new Intl.Locale(languages[0] || 'en').region;
    if (region?.toUpperCase() === 'KR') return 'ko';
  } catch {
    // Locale parsing is best-effort only.
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone === 'Asia/Seoul') return 'ko';
  return 'en';
}

function isStoredLanguage(value: unknown): value is Language | null {
  return value === null || value === 'ko' || value === 'en';
}
