# rhwp API 검증 노트

`@rhwp/core@0.8.2`, `@rhwp/editor@0.8.2` 기준. npm 실물 패키지의 `.d.ts`/`.js`를 직접 열람하고, 필드 2개(이름/나이)가 포함된 샘플 HWPX로 헤드리스 Node에서 실측한 결과. **버전이 빠르게 바뀌는 라이브러리이므로 새 버전에서는 반드시 재검증할 것.**

## `@rhwp/editor` — 호스트에 노출되는 전체 공개 API

`RhwpEditor` 클래스(`node_modules/@rhwp/editor/index.js`, `index.d.ts`)의 메서드는 이게 전부이며, 필드 관련 메서드는 없다:

```
loadFile(...)
pageCount(...)
getPageSvg(...)
getRendererDiagnostics(...)
exportHwp(): Promise<Uint8Array>
exportHwpx(): Promise<Uint8Array>
exportHml(): Promise<...>
getHmlSaveState(...)
exportHwpVerify(): Promise<HwpVerifyResult>
notifySaved(...)
element
destroy()
```

postMessage 기반 고정 화이트리스트이며 제네릭 passthrough 없음. **필드 삽입/조회/값 주입은 이 API로 불가능** — iframe 안에서 사람이 rhwp-studio 자체 메뉴(도구 상자 → 입력 → **필드 입력**, Ctrl+K+E)로 처리해야 한다. 실제 데모(edwardkim.github.io/rhwp)에서 이 메뉴 존재를 확인했다.

## `@rhwp/core` — `HwpDocument` 클래스 주요 API

```ts
constructor(data: Uint8Array)          // 파일 로드, 렌더링 없이 문서 모델만 생성

// 필드
getFieldList(): string                                  // JSON 문자열 반환
getFieldValueByName(name: string): string
setFieldValueByName(name: string, value: string): string
insertClickHereField(section_idx, para_idx, char_offset, guide, memo, name, editable): string
insertClickHereFieldInCell(section_idx, parent_para_idx, control_idx, cell_idx, cell_para_idx, char_offset, is_textbox, guide, memo, name, editable): string
removeFieldAt(...): string
getFieldInfoAt(section_idx, para_idx, char_offset): string

// 표(목록형 반복 행)
insertTableRow(section_idx, parent_para_idx, control_idx, row_idx, below: boolean): string
deleteTableRow(section_idx, parent_para_idx, control_idx, row_idx): string

// 저장
exportHwpx(): Uint8Array
exportHwp(): Uint8Array
exportHwpVerify(): string   // 자기 재로드 기반 검증 메타데이터, issue #178 대응
```

모두 **DOM/Canvas 없이 순수 Node(Electron main 프로세스 조건)에서 동작 확인됨** (아래 §실측 로그 참고). `measureText`/`measureTextWidth` JS 콜백 의존성은 `rhwp.js` 내부에 존재하지만(`arg0.measureText(...)`), 필드 읽기/쓰기/저장 경로에서는 호출되지 않는 것으로 실측됨. 렌더링(`getPageSvg` 등)에서는 필요할 가능성이 높으므로 그 경로를 Main에서 쓰려면 `node-canvas` 같은 폴리필을 별도 검증할 것.

## Node에서 초기화하는 법 (headless)

```js
import { readFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';

// 주의: init()을 인자 없이 호출하면 new URL('rhwp_bg.wasm', import.meta.url)을 fetch하는데,
// Node의 fetch는 file:// 프로토콜을 지원하지 않아 실패한다.
// 반드시 바이트를 직접 읽어서 넘길 것.
const wasmBytes = readFileSync('./node_modules/@rhwp/core/rhwp_bg.wasm');
await init({ module_or_path: wasmBytes });

const doc = new HwpDocument(new Uint8Array(readFileSync('./template.hwpx')));
```

## 실측 로그 (필드 2개짜리 샘플 HWPX)

```
getFieldList() (초기):
[{"fieldId":1,"fieldType":"clickhere","name":"이름","guide":"이름","value":"",
  "location":{"sectionIndex":0,"paraIndex":1}, ...},
 {"fieldId":2,"fieldType":"clickhere","name":"나이","guide":"나이","value":"", ...}]

setFieldValueByName('이름', '신진우') →
  {"ok":true,"fieldId":1,"oldValue":"","newValue":"신진우"}

exportHwpx() → 재로드 후 section0.xml 확인:
  <hp:t>신진우</hp:t>  <hp:t>27</hp:t>   ← 실제 XML에 반영됨

exportHwpVerify() →
  {"bytesLen":6656,"pageCountBefore":1,"pageCountAfter":1,"recovered":true}

존재하지 않는 필드명 주입:
  setFieldValueByName('존재하지않는필드', '테스트')
  → 예외 발생, String(e) === "필드 오류: 필드 이름 '존재하지않는필드' 없음"
  → 주의: e.message는 undefined (예외가 JsValue/문자열로 던져짐, Error 객체 아님).
     catch (e) { const msg = typeof e === 'string' ? e : String(e); } 형태로 처리할 것
```

생성된 HWPX의 `Preview/PrvImage.png`는 1x1 빈 PNG로 남는다(헤드리스 export가 썸네일을 재생성하지 않음) — 문서 내용 자체엔 영향 없음.

## HWPX 내부 구조 참고 (unzip해서 직접 볼 때)

HWPX는 zip 컨테이너다:
```
Contents/section0.xml   ← 본문 텍스트/필드 XML (<hp:fieldBegin type="CLICK_HERE" name="...">)
Contents/header.xml
Contents/content.hpf
META-INF/container.xml, manifest.xml
Preview/PrvImage.png, PrvText.txt
mimetype
settings.xml / version.xml
```
API 반환값만 믿지 말고, 의심스러우면 `unzip file.hwpx -d out/ && grep -o '<hp:t[^>]*>[^<]*</hp:t>' out/Contents/section0.xml`로 실제 텍스트를 직접 확인하는 습관을 들일 것 — 실제로 이 방식으로 값 주입이 진짜 반영됐는지 교차검증했다.

## 아직 검증 안 된 것 (다음에 이 스킬을 쓸 때 우선 확인)

1. **`insertTableRow()`로 필드 포함 행을 복제했을 때** 복제된 행들의 필드 이름이 자동으로 구분되는지(접미사 등), 아니면 직접 이름을 바꿔줘야 하는지 — 표 있는 템플릿으로 실측 필요.
2. **iframe 안에서 실제로 "필드 입력" 메뉴를 클릭했을 때** 뜨는 다이얼로그가 정확히 어떤 입력(이름만/안내문 포함)을 받는지, 그 결과가 `getFieldList()`와 1:1로 매핑되는지.
3. **`getPageSvg()` 등 렌더링 경로를 Main(headless)에서 쓸 때** `measureText` 폴리필이 실제로 필요한지 여부.
4. **버전 확인 습관**: README에 적힌 버전(예: v0.7.18)이 실제 `npm view @rhwp/core versions`로 확인되는 최신판(예: v0.8.2)보다 뒤처져 있었다. 새 프로젝트 시작 시 항상 npm 기준으로 재확인할 것.