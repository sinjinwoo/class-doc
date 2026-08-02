# Electron + rhwp 아키텍처 패턴

필드 기반 HWPX 템플릿 문서 자동 생성 앱(예: 학생 서류, 출결부, 명렬표 등 학교/행정 문서)을 만들 때 검증된 구조.

## 전체 구조

```
Renderer 프로세스 (React + TypeScript + Vite)
  ├─ 템플릿 설정 화면
  │    └─ @rhwp/editor (iframe) — rhwp-studio 자체 UI/메뉴/툴바 그대로 임베드
  │         (사용자가 "필드 입력" 메뉴로 직접 누름틀 삽입 — 호스트가 만드는 UI 아님)
  ├─ 필드↔연동 매핑 화면 (호스트가 만드는 유일한 커스텀 편집 UI)
  ├─ 문서 생성/미리보기 화면
  └─ IPC(contextBridge)로 Main과 통신

Electron Main 프로세스 (Node)
  ├─ @rhwp/core (WASM, headless)
  │    — 필드 값 주입/조회, 반복 행 삽입, exportHwpx (DOM/Canvas 불필요, 검증됨)
  ├─ better-sqlite3 — SQLite 직접 접근
  ├─ 파일시스템 (템플릿 로드, 출력 폴더 저장, 다이얼로그)
  └─ (선택) rhwp CLI 바이너리 — PDF 내보내기용
```

**역할 분담 원칙**
- `@rhwp/editor`(iframe, Renderer): 사람이 보면서 편집하는 용도 전담. 우리 코드가 여기 개입하는 지점은 `loadFile` / `exportHwpx` 두 가지뿐.
- `@rhwp/core`(WASM, Main): 사람 개입 없는 프로그래매틱 처리 전담. 학생별 대량 생성, 값 치환, 반복 행 복제, 최종 저장.

## 템플릿 필드 지정 흐름

```
템플릿 등록(사본 복사) → @rhwp/editor로 열기 (rhwp-studio 전체 UI 표시)
   ↓
사용자: 값 들어갈 위치에 커서 → "도구 상자 → 입력 → 필드 입력"(Ctrl+K+E) 클릭
   ↓ (필드 이름 입력 다이얼로그도 rhwp-studio 자체 제공)
확인 → CLICK_HERE 필드 삽입됨
   ↓
[목록형] 표 안에서 같은 방식으로 반복 대상 행 내부 필드 삽입
   ↓
저장 → 호스트가 editor.exportHwpx() 호출 → bytes 수신
   ↓
호스트(Main): @rhwp/core로 bytes 재로드 → getFieldList()로 필드 목록 추출
   ↓
[호스트가 만드는 화면] 필드↔연동 매핑
   "방금 삽입한 필드: 이름①, 사유②, 시작일③..."
   각 필드마다 드롭다운: [학년|반|번호|이름|성별|생일|작성일|기타(직접입력)]
   "기타" 선택 시 필수 여부·기본값 입력
   ↓
template_field 테이블에 field_name + binding + scope 기록
```

필드 이름 중복은 rhwp-studio 저장 시점엔 검증 안 될 수 있으므로, `getFieldList()` 수신 직후 앱 쪽에서 `UNIQUE(template_id, field_name, scope)` 위반 여부를 검사.

저장 직후 재로드하여 `getFieldList()`가 삽입 직전 목록과 일치하는지 확인(왕복 검증). `exportHwpVerify()`(자기 재로드 기반 검증 메타데이터)도 함께 기록해 회귀를 조기 발견.

## DB 스키마 패턴

```sql
CREATE TABLE template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('INDIVIDUAL','LIST')),  -- 개별형/목록형
    repeat_row_json TEXT,          -- 목록형: 반복 행 식별 정보
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE template_field (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,      -- rhwp getFieldList()의 name과 1:1
    binding TEXT NOT NULL CHECK (binding IN
        ('GRADE','CLASS_NO','STUDENT_NO','NAME','GENDER','BIRTHDAY','WRITE_DATE','USER')),
    scope TEXT NOT NULL DEFAULT 'DOC' CHECK (scope IN ('DOC','ROW')),  -- 문서공통/반복행내부
    required INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,
    display_order INTEGER,
    FOREIGN KEY(template_id) REFERENCES template(id) ON DELETE CASCADE,
    UNIQUE(template_id, field_name, scope)
);
```

`binding`은 앱 도메인 개념(rhwp는 모름) — 필드 이름과 실제 데이터 소스를 연결하는 매핑 테이블 역할. `scope`가 `ROW`인 필드는 목록형 문서의 반복 행 안에서 학생마다 다른 값이 들어감.

better-sqlite3 접근 계층(MyBatis Mapper 대체):
```
electron/main/database/
  ├── student.repository.ts
  ├── template.repository.ts
  ├── templateField.repository.ts
  └── document.repository.ts
```

## 문서 생성 파이프라인 (Main 헤드리스)

```
[Renderer] 학생 선택 → 템플릿 선택 → USER 필드 입력(직접입력/CSV) → 미리보기
   ↓ IPC
[Main, @rhwp/core, DOM/Canvas 불필요]
  [개별형] 학생별 반복:
      템플릿 bytes 로드 → HwpDocument 생성
      → getFieldList()로 필드 확인, 미발견 시 즉시 예외
      → setFieldValueByName()로 값 주입
      → exportHwpx() → 학생별 파일 저장
  [목록형] 사본 1회 로드 → DOC 필드 주입
      → insertTableRow(section_idx, parent_para_idx, control_idx, row_idx, below)로
        학생 수만큼 행 복제 (반드시 사전 스파이크 검증 — rhwp-api-notes.md 참고)
      → 행별 ROW 필드 주입 → exportHwpx() → 파일 1개 저장
   ↓
[Main] document_history 기록 → [Renderer] 완료 알림
```

- 필드 미발견 시 `setFieldValueByName()`이 명확한 문자열 예외를 던짐 → catch하여 생성 차단 + 재지정 안내
- AUTO 값 부재(생일 미입력 등)는 빈 문자열 주입
- 대량 생성 시 Main에서 진행률을 IPC 이벤트로 Renderer에 스트리밍해 로딩 상태 표시 (Renderer UI가 멈춘 것처럼 보이지 않도록)
- 파일명 규칙 예: 개별형 `학년-반-번호_이름_템플릿명.hwpx`, 목록형 `학년-반_템플릿명.hwpx`, 중복 시 `(1)`, 금지 문자는 `_` 치환

## Renderer ↔ Main 통신

```
Renderer                          Main
─────────────                    ─────────────
contextBridge 노출 API      →    ipcMain.handle(...)
(예: window.api.generateDocs)
                             ←    진행률 이벤트 (webContents.send)
```

- `nodeIntegration: false`, `contextIsolation: true` 유지, preload에서 필요한 API만 화이트리스트로 노출
- `@rhwp/editor` iframe은 Renderer 내부에서 독립적으로 postMessage 통신(자체 프로토콜)하므로 앱의 IPC와는 별개 채널 — `editor.exportHwpx()`로 받은 bytes만 IPC로 Main에 전달
- 파일시스템 접근(폴더 선택, 템플릿 로드/저장)은 Main에서 수행

## 예외 처리 체크리스트

| 상황 | 처리 |
|---|---|
| 필드 이름 중복 지정 | `getFieldList()` 결과 수신 직후 매핑 화면에서 즉시 차단 |
| 생성 시 필드 미발견 | `setFieldValueByName()` 예외 catch → 생성 차단, 재지정 유도 |
| exportHwpx 실패 / exportHwpVerify recovered:false | 저장 차단 + 오류 안내 |
| 손상된 HWPX/구형식 | `new HwpDocument(bytes)` 파싱 예외 catch → 재저장 안내 |
| 생성 파일 탐색기 썸네일이 빈 이미지 | 기능상 문제 없음(1x1 PNG). 필요 시 `getPageSvg()`로 별도 썸네일 생성은 후속 과제 |