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
    'app.tagline': 'KEEP LINES, YOUR MOVE',
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
    'common.createProject': 'CREATE PROJECT',
    'common.newProject': 'NEW PROJECT',
    'common.saveProject': 'SAVE PROJECT',
    'common.delete': 'DELETE',
    'common.archiveProject': 'ARCHIVE PROJECT',
    'common.manual': 'MANUAL',
    'common.manualFix': 'MANUAL FIX',
    'common.manualCorrection': 'MANUAL CORRECTION',
    'common.buildCard': 'BUILD CARD',
    'common.sendVideo': 'SEND VIDEO',
    'common.frames': '{count} FRAMES',
    'placeholder.projectName': 'CONCRETE TRAVERSE',
    'placeholder.localName': '콘크리트 트래버스',
    'placeholder.gym': 'GYM NAME',
    'placeholder.wall': 'WALL 03',
    'placeholder.grade': 'V6',
    'dashboard.firstRunKicker': 'KLYM // VIDEO → SEND CARD',
    'dashboard.firstRunTitle': 'TURN YOUR SEND INTO A CARD.',
    'dashboard.firstRunBody': 'Drop a clip, KLYM extracts the line as a Motion Signature, and you publish a premium card. No login, no upload — everything runs on your device.',
    'dashboard.quickSend': 'QUICK SEND',
    'dashboard.fullProjectLog': 'FULL PROJECT LOG',
    'dashboard.step1Title': 'DROP CLIP',
    'dashboard.step1Body': 'MP4 / MOV from your gallery.',
    'dashboard.step2Title': 'AUTO TRACE',
    'dashboard.step2Body': 'Pose-based Motion Signature.',
    'dashboard.step3Title': 'NAME & GRADE',
    'dashboard.step3Body': 'V scale or hold color.',
    'dashboard.step4Title': 'EXPORT',
    'dashboard.step4Body': 'PNG or 1440p video card.',
    'dashboard.title': 'WHAT LINE WILL YOU DRAW?',
    'dashboard.localSummary': '{projects} lines stored locally · {attempts} attempt logs',
    'dashboard.quickHeroTitle': 'VIDEO → CARD',
    'dashboard.quickHeroBody': 'Drop a clip, name the line, export a 1440p card. No project log needed.',
    'dashboard.focus': 'TODAY\'S FOCUS',
    'dashboard.betaAttempts': 'BETA · {count} ATTEMPTS',
    'dashboard.continueProject': 'CONTINUE PROJECT',
    'dashboard.noProjectsTitle': 'NO PROJECTS YET',
    'dashboard.noProjectsBody': 'Create your first line and KLYM will start tracking the work.',
    'dashboard.uploadToProject': 'UPLOAD TO PROJECT',
    'dashboard.attachSignature': 'ATTACH SIGNATURE',
    'dashboard.addProject': 'ADD PROJECT',
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
    'projects.emptyFirstTitle': 'CREATE YOUR FIRST PROJECT',
    'projects.emptyFirstBody': 'Start with the gym, grade, wall, and a short beta note. Video analysis unlocks after a project exists.',
    'projects.emptyFilteredTitle': 'NO MATCHING LINES',
    'projects.emptyFilteredBody': 'Change a filter or create a new project.',
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
    'motion.createFirstTitle': 'CREATE A PROJECT FIRST',
    'motion.createFirstBody': 'Motion Signatures attach to a real line. Add the gym, grade, and wall first, then upload the send video.',
    'motion.quickBannerBody': 'Drop a send clip and KLYM builds a Motion Signature card. No project log required.',
    'motion.quickUploadTitle': 'DROP YOUR SEND CLIP.',
    'motion.uploadTitle': 'UPLOAD YOUR SEND VIDEO.',
    'motion.quickUploadBody': 'Pick a clip from your gallery — KLYM extracts the line and lets you finalize the card with a name and grade.',
    'motion.uploadBody': 'Your movement becomes a unique continuous line. Automatic detection runs first; manual correction is available if confidence drops.',
    'motion.selectVideoAria': 'Select a send video from your photo library',
    'motion.selectGallery': 'SELECT FROM GALLERY',
    'motion.videoHint': 'MP4 / MOV · sampled in-browser',
    'motion.generateSignature': 'GENERATE SIGNATURE',
    'motion.howItWorks': 'HOW IT WORKS',
    'motion.howItWorksBody': 'KLYM samples key frames, compares body-center, hand, foot, and crux-wrist pose routes, then turns the best video-derived path into a normalized SVG Motion Signature.',
    'motion.sourceVideo': '[ SOURCE VIDEO ]',
    'motion.manualError': 'Automatic detection failed',
    'motion.manualHelp': 'Tap the climber\'s body center on at least three sampled frames. KLYM will generate the signature from those video-derived points.',
    'motion.sampleFrame': 'Sample frame {index}',
    'motion.generateFromPoints': 'GENERATE FROM {count} POINTS',
    'motion.readyKicker': 'SIGNATURE READY · {source} · {score}%',
    'motion.readyTitle': 'YOUR LINE IS READY.',
    'motion.finishCard': 'FINISH THE CARD',
    'motion.nameSend': 'NAME THIS SEND.',
    'motion.gymOptional': 'GYM (OPTIONAL)',
    'motion.wallOptional': 'WALL (OPTIONAL)',
    'motion.topHold': 'TOP HOLD',
    'motion.fallAt': 'FALL · {progress}%',
    'motion.labelTop': 'TOP',
    'motion.labelMotion': 'MOTION',
    'motion.saveBuildCard': 'SAVE · BUILD CARD',
    'motion.autoFailed': 'Automatic detection failed. Use manual correction.',
    'motion.videoFailed': 'Video processing failed.',
    'motion.manualNote': 'Signature generated from user-selected body-center points on sampled video frames.',
    'send.header': 'SEND CARD / EXPORT',
    'send.title': 'SEND CARD',
    'send.body': 'Built for feed covers, stories, and a premium send archive.',
    'send.noProjectTitle': 'NO SENT PROJECTS',
    'send.noProjectBody': 'Upload a clip and complete a Motion Signature first.',
    'send.noSignatureTitle': 'NO MOTION SIGNATURE',
    'send.noSignatureBody': 'This project needs a saved video-derived Motion Signature before export.',
    'send.generateSignature': 'GENERATE SIGNATURE',
    'send.reflection': 'REFLECTION',
    'send.defaultReflection': 'Held the swing. Kept the line.',
    'send.defaultReflectionKo': '스윙을 버티고, 라인을 이어갔다.',
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
    'profile.tagline': 'Keep Lines, Your Move.',
    'profile.projects': 'PROJECTS',
    'profile.sends': 'SENDS',
    'profile.language': 'Language',
    'profile.videoFilesValue': 'Original clips stay on device',
    'onboarding.skip': 'SKIP',
    'onboarding.kicker': 'KLYM // 003',
    'onboarding.title': 'KEEP LINES, YOUR MOVE.',
    'onboarding.body': 'Track projects, turn send video into a Motion Signature, and export a premium Send Card.',
    'onboarding.ready': 'MOTION SIGNATURE READY',
    'onboarding.sampleProject': 'CONCRETE TRAVERSE',
    'onboarding.start': 'GET STARTED',
  },
  ko: {
    'app.tagline': '선을 남기고, 무브를 기록',
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
    'common.createProject': '프로젝트 만들기',
    'common.newProject': '새 프로젝트',
    'common.saveProject': '프로젝트 저장',
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
    'dashboard.firstRunKicker': 'KLYM // CLIP TO CARD',
    'dashboard.firstRunTitle': '완등의 움직임을 카드로 남기세요.',
    'dashboard.firstRunBody': '내 클라이밍 영상을 가져오면 KLYM이 움직임을 읽고 라인을 그립니다. 업로드 없이, 내 기기 안에서 바로.',
    'dashboard.quickSend': '바로 만들기',
    'dashboard.fullProjectLog': '프로젝트로 기록하기',
    'dashboard.step1Title': '영상 가져오기',
    'dashboard.step1Body': '내 클라이밍 영상을 가져옵니다.',
    'dashboard.step2Title': '모션 분석',
    'dashboard.step2Body': '영상을 분석해서 모션을 선으로 그려냅니다.',
    'dashboard.step3Title': '라인 네이밍',
    'dashboard.step3Body': '문제 이름, 난이도, 홀드 컬러까지.',
    'dashboard.step4Title': '바로 공유',
    'dashboard.step4Body': '피드와 스토리에 맞는 카드로 저장합니다.',
    'dashboard.title': '오늘 어떤 라인을 그릴까요?',
    'dashboard.localSummary': '로컬에 {projects}개 라인 · {attempts}개 시도 기록',
    'dashboard.quickHeroTitle': '영상 → 카드',
    'dashboard.quickHeroBody': '영상을 고르고 라인 이름만 넣으면 1440p 카드로 바로 내보냅니다. 프로젝트 기록은 없어도 됩니다.',
    'dashboard.focus': '오늘의 포커스',
    'dashboard.betaAttempts': '베타 · {count}번 시도',
    'dashboard.continueProject': '프로젝트 계속하기',
    'dashboard.noProjectsTitle': '아직 프로젝트가 없어요',
    'dashboard.noProjectsBody': '첫 라인을 만들면 KLYM이 과정을 기록하기 시작합니다.',
    'dashboard.uploadToProject': '프로젝트에 업로드',
    'dashboard.attachSignature': '시그니처 연결',
    'dashboard.addProject': '프로젝트 추가',
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
    'projects.emptyFirstTitle': '첫 프로젝트를 만들어보세요',
    'projects.emptyFirstBody': '클라이밍장, 난이도, 벽, 짧은 베타 메모부터 기록하세요. 프로젝트가 생기면 영상 분석을 사용할 수 있습니다.',
    'projects.emptyFilteredTitle': '조건에 맞는 라인이 없어요',
    'projects.emptyFilteredBody': '필터를 바꾸거나 새 프로젝트를 만들어보세요.',
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
    'motion.createFirstTitle': '먼저 라인을 만들어주세요',
    'motion.createFirstBody': '클라이밍장, 난이도, 벽을 저장하면 영상 분석을 라인에 바로 연결할 수 있습니다.',
    'motion.quickBannerBody': '영상 하나로 라인, 난이도, 카드까지 빠르게 완성합니다.',
    'motion.quickUploadTitle': '내 등반 영상을 가져오세요.',
    'motion.uploadTitle': '내 클라이밍 영상을 가져오세요.',
    'motion.quickUploadBody': 'KLYM이 움직임을 읽고 공유용 카드까지 이어서 만듭니다.',
    'motion.uploadBody': '실내와 자연바위, 손과 발, 크럭스 손목까지 비교해 이 문제에 가장 잘 맞는 라인을 선택합니다.',
    'motion.selectVideoAria': '사진첩에서 클라이밍 영상 선택',
    'motion.selectGallery': '영상 선택',
    'motion.videoHint': '사진첩에서 MP4 / MOV 가져오기',
    'motion.generateSignature': '모션 라인 만들기',
    'motion.howItWorks': '모션을 읽는 방식',
    'motion.howItWorksBody': '문제 타입을 먼저 나누고 손, 발, 몸 중심, 크럭스 손목 후보를 비교합니다. 완등 매치와 추락 지점, 탑 홀드 컬러까지 함께 확인합니다.',
    'motion.sourceVideo': '[ 원본 영상 ]',
    'motion.manualError': '자동 감지 실패',
    'motion.manualHelp': '샘플 프레임 3개 이상에서 라인이 지나갈 지점을 탭하세요. KLYM이 그 포인트를 이어 모션 라인을 만듭니다.',
    'motion.sampleFrame': '샘플 프레임 {index}',
    'motion.generateFromPoints': '{count}개 포인트로 생성',
    'motion.readyKicker': '라인 준비 완료 · {source} · {score}%',
    'motion.readyTitle': '움직임이 라인이 됐습니다.',
    'motion.finishCard': '카드 마무리',
    'motion.nameSend': '이 라인의 이름을 정해주세요.',
    'motion.gymOptional': '클라이밍장 (선택)',
    'motion.wallOptional': '벽 (선택)',
    'motion.topHold': '탑 홀드',
    'motion.fallAt': '추락 · {progress}%',
    'motion.labelTop': '탑',
    'motion.labelMotion': '모션',
    'motion.saveBuildCard': '저장 · 카드 만들기',
    'motion.autoFailed': '자동 분석이 흔들렸습니다. 직접 포인트를 찍어 라인을 완성하세요.',
    'motion.videoFailed': '영상 처리에 실패했습니다.',
    'motion.manualNote': '사용자가 선택한 샘플 프레임 포인트로 모션 라인을 만들었습니다.',
    'send.header': '센드 카드 / 내보내기',
    'send.title': '센드 카드',
    'send.body': '피드 커버, 스토리, 프리미엄 센드 아카이브용으로 만듭니다.',
    'send.noProjectTitle': '완등 프로젝트가 없어요',
    'send.noProjectBody': '영상을 업로드하고 모션 라인을 먼저 만들어주세요.',
    'send.noSignatureTitle': '모션 시그니처가 없어요',
    'send.noSignatureBody': '이 프로젝트는 내보내기 전에 저장된 영상 기반 모션 시그니처가 필요합니다.',
    'send.generateSignature': '시그니처 생성',
    'send.reflection': '리플렉션',
    'send.defaultReflection': 'Held the swing. Kept the line.',
    'send.defaultReflectionKo': '스윙을 버티고, 라인을 이어갔다.',
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
    'profile.tagline': '선을 남기고, 무브를 기록.',
    'profile.projects': '프로젝트',
    'profile.sends': '완등',
    'profile.language': '언어',
    'profile.videoFilesValue': '원본 영상은 기기에만 보관',
    'onboarding.skip': '건너뛰기',
    'onboarding.kicker': 'KLYM // 003',
    'onboarding.title': '선을 남기고, 무브를 기록.',
    'onboarding.body': '프로젝트를 기록하고 완등 영상을 모션 시그니처로 바꾼 뒤 프리미엄 센드 카드로 내보내세요.',
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
