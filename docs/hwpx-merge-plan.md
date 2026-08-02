# 여러 학생 문서를 하나로 병합 — 구현 계획 (미착수, 인수인계용)

## 배경

교사가 "개별형" 템플릿으로 학생별 문서를 생성하면 현재는 학생 수만큼 **별도 파일**이 생긴다. 요구사항은 이걸 **한 파일**로 합쳐서 내보내는 것 — 예: 30명 학급이면 30페이지짜리 문서 1개.

## 실측으로 확인한 것 (2026-08-02, 이 세션에서 직접 스파이크 테스트함)

세 가지 가능한 접근을 실제로 테스트했다. 결과는 아래와 같다.

### ❌ 방법 1: `@rhwp/core`의 클립보드(copySelection/pasteInternal)로 문서 간 복사

`HwpDocument` 인스턴스 A에서 `copySelection()`으로 복사한 내용을, 별도 인스턴스 B에서 `pasteInternal()`로 붙여넣기 시도.

```
docA: copySelection → hasInternalClipboard = true
docB (별도 인스턴스): hasInternalClipboard = false
docB.pasteInternal() → {"ok":false,"error":"clipboard empty"}
docA.pasteInternal() (자기 자신에게) → 성공
```

**결론**: 클립보드는 `HwpDocument` 인스턴스별로 완전히 격리됨. 서로 다른 문서 객체 간 복사/붙여넣기 불가능. 같은 문서 안에서의 복사/붙여넣기는 정상 동작.

### ❌ 방법 2: 표 반복 행(`insertTableRow`) 기반 — `.claude/skills/rhwp`가 원래 가정했던 방식

`arcjotectire.md`가 문서화한 흐름("템플릿 행에 필드 하나 넣어두면 `insertTableRow()`가 학생 수만큼 행을 복제")을 그대로 테스트.

```
2행 표에 "이름" 필드 삽입 → insertTableRow(row_idx=1, below=true)
→ 행 개수: 2 → 3 (성공)
→ 필드 개수: 여전히 1개 (새 행에 필드가 복제되지 않음!)
```

추가로, 같은 이름의 필드 2개를 수동으로 각 행에 넣고 `setFieldValueByName()`을 호출하면 **첫 번째 필드만 값이 설정되고 두 번째는 그대로 빈 값**으로 남는다.

**결론**: `insertTableRow()`는 행/셀 구조(빈 셀)만 복제하고, 셀 안의 필드 컨트롤은 복제하지 않는다. `.claude/skills/rhwp`의 기존 문서(arcjotectire.md)가 가정한 흐름은 **틀렸다** — 실제로 목록형을 구현하려면 앱이 학생마다 (1) 빈 행 추가 → (2) 그 행에 매번 새로운 고유 이름의 필드를 직접 삽입 → (3) 그 이름으로 값 설정, 이렇게 해야 한다. 템플릿 설계 방식 자체가 바뀌어야 하는 큰 작업.

### ✅ 방법 3: zip/XML 레벨 직접 병합 — 실제로 동작 확인됨

HWPX는 zip 컨테이너(`Contents/section0.xml`, `header.xml`, `content.hpf` 등)이므로, `@rhwp/core`를 거치지 않고 파일 자체를 조작.

**테스트 절차**:
1. 같은 템플릿에서 유래한 두 개의 hwpx 파일(값만 다름)을 각각 압축 해제
2. `header.xml`/`settings.xml`이 **완전히 동일**함을 확인(필드 값 변경은 스타일/폰트 정의를 건드리지 않으므로 — 같은 템플릿에서 나온 파일은 항상 이렇다)
3. 두 번째 파일의 `Contents/section0.xml`을 `Contents/section1.xml`로 이름 바꿔 첫 번째 파일의 압축 폴더에 추가
4. `Contents/content.hpf`의 `<opf:manifest>`에 `section1` 아이템 추가, `<opf:spine>`에 `section1` itemref 추가
5. 다시 압축(주의: Windows `Compress-Archive`는 zip 엔트리 경로에 백슬래시를 써서 rhwp가 못 읽는다 — `/`로 된 경로여야 함. `.NET ZipArchive.CreateEntry()` 직접 사용해서 우회함)

**결과**:
```
LOAD: ok
getSectionCount: 2
pageCount: 2
exportHwpVerify: {"recovered":true}   ← rhwp 자체 무결성 검증 통과
renderPageSvg(0), renderPageSvg(1) 둘 다 정상 렌더링
```

**결론**: 된다. `insertTableRow` 방식보다 훨씬 간단하고, 템플릿 제작 방식을 바꿀 필요가 전혀 없다 — 지금처럼 "개별형" 템플릿에 필드 넣고 학생별로 값만 다르게 채워서 각각 만든 다음, 마지막에 zip 레벨에서 하나로 합치기만 하면 된다.

## 아직 검증 안 된 것 (실제 구현 전 반드시 확인)

이번 테스트는 `HwpDocument.createEmpty()` + 순수 텍스트 삽입만으로 확인했다. 실제 템플릿은 표/이미지/커스텀 스타일이 있을 수 있으므로:

1. **표/이미지가 포함된 실제 등록 템플릿으로 재검증 필요.** `header.xml`이 "필드 값만 다르면 항상 동일하다"는 전제가 표/이미지/커스텀 스타일이 있는 문서에서도 유지되는지 확인.
2. **페이지 번호가 섹션마다 리셋될 가능성.** 각 섹션의 `hp:startNum`이 "1페이지부터 시작"으로 되어 있으면, 병합된 문서에서 페이지 번호가 1,2,3...으로 이어지지 않고 섹션마다 1로 초기화될 수 있음(교정 사항이지 병합 자체를 막는 문제는 아님).
3. **`Preview/PrvImage.png`(탐색기 미리보기 썸네일)는 첫 번째 문서 것만 재사용됨** — 이미 알려진 비영향 이슈(헤드리스 export는 어차피 썸네일을 안 만듦).

## 구현 범위

1. **zip 쓰기 라이브러리 추가** — Node에 내장 zip writer가 없음. `yazl`/`jszip`/`adm-zip` 중 선택(가벼운 것 추천, 이 프로젝트는 unzip+rezip만 하면 되므로 `yazl`이 무난해 보임 — 별도 검증 필요).
2. **병합 유틸리티** — `src/main/util/` 아래 새 모듈. 입력: N개의 exportHwpx() 결과 바이트 배열. 처리: 각각 압축 해제(unzip 라이브러리도 필요 — `yauzl` 또는 `jszip`이 unzip도 지원), section0.xml들을 section0..N-1로 재배치, 첫 번째 것의 header.xml/settings.xml/META-INF/mimetype/Preview 재사용, content.hpf의 manifest+spine 재작성. 출력: 병합된 hwpx 바이트.
3. **`generation.ts`의 `runIndividual()` 수정** — 현재는 학생마다 즉시 `writeFileSync`하는데, 대신 각 학생의 export 바이트를 메모리에 모아뒀다가 마지막에 병합 유틸리티 호출 → 파일 1개만 씀. (주의: 학생 수가 매우 많으면 메모리 사용량이 커질 수 있음 — 필요시 스트리밍 방식 고려, 지금 규모(교사 1인, 전교생 수백 명)에서는 문제없을 것으로 예상.)
4. **`docs/schema.md`/`CLAUDE.md` 갱신** — 이 새로운 병합 흐름을 문서화.

## 관련 파일

- 스파이크 테스트 스크립트(참고용, 세션 스크래치패드에 있음 — 필요시 재현 가능): 클립보드 테스트, insertTableRow 테스트, zip 병합 테스트 스크립트들. 세션이 끝나면 사라지므로, 내일 작업 시작 시 이 문서의 "실측으로 확인한 것" 절차를 그대로 재현하면 됨.
- `.claude/skills/rhwp/references/arcjotectire.md` — 목록형 관련 서술이 이번 실측으로 **틀린 것으로 확인됨**. 목록형(표 반복) 기능을 실제로 만들 때는 이 문서를 먼저 갱신할 것.
- `src/main/ipc/generation.ts` — `runIndividual()`/`runList()`가 수정 대상.
