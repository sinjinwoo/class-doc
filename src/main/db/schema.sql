-- Executable copy of docs/schema.md §3. docs/schema.md is the source of truth
-- (design rationale, alternatives considered, etc. all live there) — this file
-- must be kept byte-for-byte in sync with that document's DDL block whenever
-- the schema changes.

PRAGMA foreign_keys = ON; -- 참고용: 실제로는 매 연결 시 애플리케이션 코드(better-sqlite3)에서 설정

-- ─────────────────────────────────────────────────────────
-- 1. teacher — 로컬 프로필. 비밀번호/인증 없음.
-- ─────────────────────────────────────────────────────────
CREATE TABLE teacher (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ─────────────────────────────────────────────────────────
-- 2. student_group — 교사가 정의한 임의의 학생 묶음.
--    "학년-반 1개"라는 보장 없음(여러 반 합반, 동아리 명단 등 가능).
-- ─────────────────────────────────────────────────────────
CREATE TABLE student_group (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (teacher_id) REFERENCES teacher(id) ON DELETE CASCADE,
    UNIQUE (teacher_id, name)
);

-- ─────────────────────────────────────────────────────────
-- 3. group_field — 그룹의 CSV 헤더(또는 수기 입력 폼)에서 감지된 "컬럼 정의".
--    template_field가 HWPX 누름틀을 감지해 저장하는 것과 동일한 철학.
-- ─────────────────────────────────────────────────────────
CREATE TABLE group_field (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id       INTEGER NOT NULL,
    field_key      TEXT NOT NULL CHECK (length(trim(field_key)) > 0), -- CSV 헤더 원문(정규화 후)
    display_order  INTEGER,       -- CSV 컬럼 순서 / 폼 입력 순서
    is_display     INTEGER NOT NULL DEFAULT 0 CHECK (is_display IN (0,1)),
    is_identity    INTEGER NOT NULL DEFAULT 0 CHECK (is_identity IN (0,1)),
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (group_id) REFERENCES student_group(id) ON DELETE CASCADE,
    UNIQUE (group_id, field_key)
);

-- 그룹당 "표시 이름" 필드는 최대 1개(0개는 DB가 못 막음 — §4/§7 참고).
CREATE UNIQUE INDEX idx_group_field_one_display
    ON group_field(group_id)
    WHERE is_display = 1;

-- ─────────────────────────────────────────────────────────
-- 4. student — 그룹 소속만 고정 컬럼. 실제 속성값은 student_field_value에 존재.
--    identity_hash: is_identity=1인 필드 값들을 앱이 정규화·해시한 재업로드 식별자(§4).
-- ─────────────────────────────────────────────────────────
CREATE TABLE student (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id       INTEGER NOT NULL,
    identity_hash  TEXT NOT NULL CHECK (length(trim(identity_hash)) > 0),
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (group_id) REFERENCES student_group(id) ON DELETE CASCADE,
    UNIQUE (group_id, identity_hash)
);

-- ─────────────────────────────────────────────────────────
-- 5. student_field_value — EAV 값 테이블. (student_id, group_field_id)당 값 1개.
-- ─────────────────────────────────────────────────────────
CREATE TABLE student_field_value (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    group_field_id  INTEGER NOT NULL,
    value           TEXT,
    FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
    FOREIGN KEY (group_field_id) REFERENCES group_field(id) ON DELETE CASCADE,
    UNIQUE (student_id, group_field_id)
);

CREATE INDEX idx_student_field_value_group_field_id ON student_field_value(group_field_id);

-- 무결성 가드레일: student_field_value가 가리키는 student와 group_field는
-- 반드시 같은 group_id에 속해야 한다. 고정 컬럼이었다면 FK만으로 자명했을
-- 불변식이 EAV로 바뀌며 사라졌으므로 트리거로 보강한다(§4).
CREATE TRIGGER trg_sfv_group_match_ins
BEFORE INSERT ON student_field_value
FOR EACH ROW
WHEN (SELECT group_id FROM student WHERE id = NEW.student_id)
     <> (SELECT group_id FROM group_field WHERE id = NEW.group_field_id)
BEGIN
    SELECT RAISE(ABORT, 'student_field_value: student and group_field belong to different groups');
END;

CREATE TRIGGER trg_sfv_group_match_upd
BEFORE UPDATE ON student_field_value
FOR EACH ROW
WHEN (SELECT group_id FROM student WHERE id = NEW.student_id)
     <> (SELECT group_id FROM group_field WHERE id = NEW.group_field_id)
BEGIN
    SELECT RAISE(ABORT, 'student_field_value: student and group_field belong to different groups');
END;

-- 값이 바뀌면 student.updated_at을 갱신(고정 컬럼이었다면 UPDATE student 한 줄로
-- 끝났을 일이 EAV에서는 자식 테이블 쓰기이므로 트리거로 동기화).
CREATE TRIGGER trg_sfv_touch_student_ins
AFTER INSERT ON student_field_value
BEGIN
    UPDATE student SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.student_id;
END;

CREATE TRIGGER trg_sfv_touch_student_upd
AFTER UPDATE ON student_field_value
BEGIN
    UPDATE student SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.student_id;
END;

CREATE TRIGGER trg_sfv_touch_student_del
AFTER DELETE ON student_field_value
BEGIN
    UPDATE student SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = OLD.student_id;
END;

-- ─────────────────────────────────────────────────────────
-- 6. template — HWPX 파일은 <exe 디렉터리>/class-doc/template/ 아래 저장.
--    file_name은 그 고정 폴더 "안에서의" 상대 파일명만 저장(§4 근거 참고).
-- ─────────────────────────────────────────────────────────
CREATE TABLE template (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL CHECK (length(trim(name)) > 0),
    file_name        TEXT NOT NULL CHECK (length(trim(file_name)) > 0),
    doc_type         TEXT NOT NULL CHECK (doc_type IN ('INDIVIDUAL','LIST')),
    repeat_row_json  TEXT, -- LIST 타입: 반복 행(표) 위치 식별 정보(JSON)
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (name),
    UNIQUE (file_name)
);

-- ─────────────────────────────────────────────────────────
-- 7. template_field — arcjotectire.md의 검증된 구조 재사용.
--    binding은 더 이상 고정 enum이 아님 — group_field.field_key 또는 '__STATIC__'(§4).
-- ─────────────────────────────────────────────────────────
CREATE TABLE template_field (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id    INTEGER NOT NULL,
    field_name     TEXT NOT NULL,      -- rhwp getFieldList()의 name과 1:1
    binding        TEXT NOT NULL CHECK (length(trim(binding)) > 0),
                       -- group_field.field_key 문자열이거나, 정적/커스텀 값을 뜻하는
                       -- 예약어 '__STATIC__'. 특정 그룹의 실제 field_key 집합과
                       -- 일치하는지는 DB가 아니라 앱 레이어 책임(§4 참고).
    scope          TEXT NOT NULL DEFAULT 'DOC' CHECK (scope IN ('DOC','ROW')),
    required       INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0,1)),
    default_value  TEXT,               -- binding='__STATIC__'일 때 실제로 들어갈 고정 텍스트
    display_order  INTEGER,
    FOREIGN KEY (template_id) REFERENCES template(id) ON DELETE CASCADE,
    UNIQUE (template_id, field_name, scope)
);

-- ─────────────────────────────────────────────────────────
-- 8. template_field_override — (템플릿, 그룹) 쌍별 매핑 오버라이드(v3, docs/schema.md §4).
--    template_field.binding/required/default_value는 "아직 오버라이드하지 않은
--    그룹"에 보여줄/쓸 폴백으로 의미가 유지된다. 이 테이블에 해당 (template_field_id,
--    group_id) 행이 있으면 그 값이 우선한다.
-- ─────────────────────────────────────────────────────────
CREATE TABLE template_field_override (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    template_field_id  INTEGER NOT NULL,
    group_id           INTEGER NOT NULL,
    binding            TEXT NOT NULL CHECK (length(trim(binding)) > 0),
    required           INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0,1)),
    default_value      TEXT,
    FOREIGN KEY (template_field_id) REFERENCES template_field(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES student_group(id) ON DELETE CASCADE,
    UNIQUE (template_field_id, group_id)
);

CREATE INDEX idx_template_field_override_group_id ON template_field_override(group_id);

-- ─────────────────────────────────────────────────────────
-- 9. generation_run — "생성" 버튼 1회 클릭 = 배치 1건.
--    template/group이 나중에 삭제돼도 이력이 읽히도록 이름 스냅샷 보관.
-- ─────────────────────────────────────────────────────────
CREATE TABLE generation_run (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id            INTEGER,
    template_name_snapshot TEXT NOT NULL,
    group_id               INTEGER,
    group_name_snapshot    TEXT,
    doc_type_snapshot      TEXT NOT NULL CHECK (doc_type_snapshot IN ('INDIVIDUAL','LIST')),
    total_count            INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    success_count          INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
    failure_count          INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    started_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    finished_at            TEXT,
    FOREIGN KEY (template_id) REFERENCES template(id) ON DELETE SET NULL,
    FOREIGN KEY (group_id) REFERENCES student_group(id) ON DELETE SET NULL,
    CHECK (success_count + failure_count <= total_count)
);

-- ─────────────────────────────────────────────────────────
-- 10. document_history — 배치 안의 개별 결과(학생별, 또는 LIST형이면 그룹 전체 1건).
-- ─────────────────────────────────────────────────────────
CREATE TABLE document_history (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id                INTEGER NOT NULL,
    student_id            INTEGER,        -- LIST 문서(그룹 전체 1파일)는 NULL
    student_name_snapshot TEXT,           -- 생성 시점 표시 필드(group_field.is_display=1) 값의
                                           -- 스냅샷 — 학생/필드 삭제 후에도 이력에서 확인 가능
    output_path           TEXT,           -- 성공 시 필수(아래 CHECK), 실패 시 NULL 허용
    status                TEXT NOT NULL CHECK (status IN ('SUCCESS','FAILURE')),
    error_message         TEXT,
    created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (run_id) REFERENCES generation_run(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE SET NULL,
    CHECK (status <> 'FAILURE' OR error_message IS NOT NULL),
    CHECK (status <> 'SUCCESS' OR output_path IS NOT NULL)
);

-- ─────────────────────────────────────────────────────────
-- 인덱스 (§6에서 각각의 근거 설명)
-- ─────────────────────────────────────────────────────────
CREATE INDEX idx_generation_run_template_id ON generation_run(template_id);
CREATE INDEX idx_generation_run_group_id    ON generation_run(group_id);
CREATE INDEX idx_document_history_run_id     ON document_history(run_id);
CREATE INDEX idx_document_history_student_id ON document_history(student_id);
