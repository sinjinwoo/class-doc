---
name: electron-rhwp-hwpx
description: Guidance for designing/building Electron apps that generate or automate Korean HWP/HWPX documents using rhwp (@rhwp/core, @rhwp/editor) instead of Java/hwpxlib. Covers the verified split between @rhwp/editor (iframe editor; humans insert fields via its native "필드 입력" menu — no host API for this) and @rhwp/core (headless WASM API for field read/write, table row insert/delete, export — works in Electron main without a browser). Use whenever the user builds an Electron/React/Node app for HWP/HWPX generation, mail-merge/template-based Korean document automation, 누름틀/필드 기반 문서 생성, school admin documents (출결부, 명렬표, 학생 서류), rhwp/rhwp-studio, or hwpxlib alternatives — even without "rhwp" named explicitly. Also use to spike-test a new rhwp version or template's field/table behavior before finalizing a design, or when asked if Java/hwpxlib is still needed alongside rhwp.
---

# Electron + rhwp HWPX 문서 자동화

이 스킬은 실제로 `@rhwp/core`/`@rhwp/editor` npm 패키지를 설치해 소스를 읽고, 샘플 HWPX 파일로 헤드리스 Node 스파이크 테스트를 돌려서 얻은 **검증된 사실**을 담고 있습니다. README나 일반 지식만으로 설계하면 아래 §2의 함정에 걸리기 쉬우니, 이 스킬이 트리거되면 아래 내용을 먼저 적용하고, 확정 안 된 부분은 반드시 실측(§4)을 거치도록 안내하세요.

## 1. 핵심 아키텍처 — 두 패키지의 역할이 완전히 분리되어 있음

`rhwp`는 npm에 두 패키지로 나뉘어 배포됩니다. **이 둘의 API 표면이 서로 겹치지 않는다**는 게 이 스킬의 가장 중요한 전제입니다.

| | `@rhwp/editor` (iframe, Renderer 프로세스) | `@rhwp/core` (WASM, Main 프로세스 가능) |
|---|---|---|
| 용도 | 사람이 눈으로 보며 편집 | 코드가 프로그래매틱하게 처리 |
| 공개 API | `loadFile, pageCount, getPageSvg, getRendererDiagnostics, exportHwp, exportHwpx, exportHml, getHmlSaveState, exportHwpVerify, notifySaved, element, destroy` | `HwpDocument` 클래스: `getFieldList, getFieldValueByName, setFieldValueByName, insertClickHereField, insertClickHereFieldInCell, removeFieldAt, getFieldInfoAt, insertTableRow, deleteTableRow, exportHwpx, exportHwp, exportHwpVerify` 등 |
| 필드(누름틀) 관련 API | **없음.** 필드 삽입은 iframe 내부 rhwp-studio 자체 UI 메뉴(도구 상자 → 입력 → **필드 입력**, Ctrl+K+E)로만 가능. 호스트 코드가 API로 필드를 삽입할 방법이 없음 | 있음. 필드 읽기/쓰기/삽입/삭제, 테이블 행 삽입/삭제 모두 이 레벨에서 처리 |
| DOM/Canvas 필요 여부 | 필요(iframe) | **불필요** — 순수 Node(Electron main)에서 헤드리스 동작 확인됨. 단 `measureTextWidth`/`measureText` 콜백은 렌더링(`getPageSvg`) 경로에서만 확인됨; 필드 read/write/export 경로에서는 폴리필 없이 성공 확인 |

**따라서 필드 지정 UX는 항상 이렇게 설계해야 합니다** (직접 브릿지 API로 필드를 삽입하려는 설계는 잘못된 전제입니다):

```
1. [Renderer] 템플릿을 @rhwp/editor(iframe)로 열기
2. [사람] iframe 안에서 커서 놓고 "필드 입력"(Ctrl+K+E) 메뉴로 직접 필드 삽입 (rhwp-studio 자체 기능)
3. [사람] 저장 → 호스트가 editor.exportHwpx()로 bytes 수신
4. [Main] 그 bytes를 @rhwp/core의 새 HwpDocument로 로드 → getFieldList()로 필드 이름 추출
5. [Renderer, 앱이 직접 만드는 유일한 화면] "필드↔의미 매핑" 화면
   — rhwp는 필드 이름만 알 뿐, 그 필드가 "학생 이름"인지 "학년"인지 모름.
     이 매핑은 앱 도메인 로직이므로 반드시 별도 화면으로 만들어야 함
6. [Main] 대량 생성 시점엔 @rhwp/core만으로 헤드리스 처리:
   HwpDocument 로드 → setFieldValueByName() 반복 → (목록형이면 insertTableRow()) → exportHwpx()
```

전체 아키텍처 다이어그램과 IPC 흐름은 `references/architecture.md` 참고.

## 2. 알려진 함정 (설계 전에 반드시 인지)

- **README가 실제 배포판보다 뒤처짐.** README에 적힌 버전(예: v0.7.18)과 실제 `npm view @rhwp/core versions`로 조회되는 최신판(예: v0.8.2)이 다를 수 있음. API 존재 여부를 README만 보고 판단하지 말고, 항상 `npm install` 후 `node_modules/@rhwp/core/rhwp.d.ts`를 직접 열어 확인할 것.
- **`@rhwp/editor`에 필드 API가 없다는 걸 모르고 "호스트가 필드 삽입 모달을 띄운다"는 설계를 하면 안 됨.** 이건 흔히 하는 실수 — README의 "hwpctl 호환 30개 액션, Field API 제공"이라는 문구만 보고 이게 호스트에도 노출된다고 착각하기 쉬움. 실제로는 iframe 내부 구현일 뿐임.
- **헤드리스 `exportHwpx()`는 문서 썸네일(`Preview/PrvImage.png`)을 갱신하지 않음.** 1x1 빈 PNG로 남음 — 문서 내용엔 문제 없지만 탐색기 미리보기가 안 뜰 수 있다고 사용자에게 미리 안내할 것.
- **`setFieldValueByName()`에 존재하지 않는 필드명을 넘기면 명확한 문자열 예외**(`"필드 오류: 필드 이름 '{name}' 없음"`)가 발생함 — try/catch로 잡아서 "필드 미발견 시 생성 차단" 같은 예외처리 로직에 바로 연결 가능. 단, 이 예외는 `JsValue`(문자열)로 던져지므로 `e.message`가 아니라 `String(e)` 또는 `e` 자체로 읽어야 함(`e.message`는 `undefined`).
- **목록형(반복 행) 문서에서 필드가 포함된 행을 `insertTableRow()`로 복제했을 때의 필드 이름 유일성 처리는 API 존재만 확인됐고 실사용 검증은 안 됨.** 표+필드가 같이 있는 실제 템플릿으로 반드시 스파이크 테스트 후 설계에 반영할 것 (§4 참고).
- Java(hwpxlib)를 완전히 걷어내는 게 항상 정답은 아님 — 반복 행/필드 API가 rhwp에 있다는 게 확인됐다고 해서 대규모 실서비스에서도 안정적이란 보장은 아니므로, 실사용 규모(예: 학생 수십 명 대량 생성)로 성능/안정성 테스트 없이 프로덕션에 바로 투입하는 설계는 지양.

## 3. 권장 기술 스택 조합

| 영역 | 권장 | 이유 |
|---|---|---|
| 셸 | Electron | JCEF/Java 불필요, React 생태계 그대로 사용 |
| HWP/HWPX 편집 UI | `@rhwp/editor` (Renderer) | 완전한 메뉴/툴바 내장, 필드 입력도 자체 제공 |
| HWP/HWPX 헤드리스 처리 | `@rhwp/core` (Main) | 필드 값 주입, 반복 행, 저장 — DOM 불필요 확인됨 |
| DB | SQLite + `better-sqlite3` | Electron 표준, 동기 API |
| PDF | 미확정 — `rhwp export-pdf` CLI vs Electron `printToPDF` 중 실제 문서로 여백/폰트 비교 후 결정 | 문서 원본 레이아웃 재현 정확도가 방식마다 다를 수 있음 |

## 4. 새 버전/새 템플릿을 받으면 항상 이렇게 스파이크 테스트

이 스킬은 스크립트를 번들하지 않습니다 — 매번 아래 절차를 상황에 맞게 즉석에서 작성해 실행하세요 (환경/버전이 빠르게 바뀌는 라이브러리라 고정 스크립트보다 그때그때 직접 짜는 게 안전합니다):

1. `npm install @rhwp/core @rhwp/editor` 실제로 설치하고 `node_modules/@rhwp/core/rhwp.d.ts`에서 필요한 메서드 시그니처 확인
2. Node(headless)에서 `init({ module_or_path: fs.readFileSync('.../rhwp_bg.wasm') })` — URL fetch 방식(`new URL(...)`)은 Node의 `fetch`가 `file://`를 지원 안 해 실패할 수 있으니 **항상 바이트를 직접 읽어 넘길 것**
3. 샘플 HWPX(가능하면 필드/표가 모두 포함된 것)로 `new HwpDocument(bytes)` → `getFieldList()` → `setFieldValueByName()` → `exportHwpx()` → 재로드 → 값 일치 확인까지 왕복
4. 목록형을 다룬다면 `insertTableRow()`도 같은 방식으로 반드시 별도 검증 (§2 참고)
5. 결과를 unzip해서 `Contents/section0.xml`을 직접 열어 실제 텍스트가 바뀌었는지 눈으로도 확인 (API 반환값만 믿지 말 것)

상세 API 시그니처와 검증된 호출 예시는 `references/rhwp-api-notes.md` 참고.

## 5. 참고 자료

- `references/architecture.md` — Electron Renderer/Main 분리 아키텍처, DB 스키마 패턴(template/template_field, binding/scope 개념), IPC 흐름, 문서 생성 파이프라인 전체
- `references/rhwp-api-notes.md` — `@rhwp/core`/`@rhwp/editor` 검증된 API 목록과 시그니처, 실제 호출 예시 및 반환값 샘플