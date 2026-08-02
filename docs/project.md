# 학생 문서 자동 생성 프로그램 설계서

## Electron + rhwp 기반 데스크톱 애플리케이션 설계

## 1. 프로젝트 개요

### 1.1 목적

학교 업무에서 반복적으로 작성되는 학생 관련 문서를 자동화하기 위한 데스크톱 프로그램이다.

기존에는 한글 문서(HWP/HWPX) 양식을 직접 수정하고 학생별 데이터를 반복 입력해야 했으나, 본 시스템은 **HWPX 템플릿 기반 자동 문서 생성 구조**를 제공한다.

사용자는 한 번 작성한 문서 양식에 필드를 지정하고, 학생 데이터를 연결하면 다음 기능을 수행할 수 있다.

* 학생 정보 기반 개별 문서 자동 생성
* 여러 학생 정보를 포함하는 목록형 문서 생성
* CSV 기반 외부 데이터 입력
* 문서 생성 이력 관리
* 오프라인 환경에서 독립 실행

모든 기능은 인터넷 연결 없이 동작하며, 학교 내부 환경에서도 사용할 수 있도록 로컬 데이터 저장 방식을 사용한다.

---

# 2. 시스템 아키텍처

전체 시스템은 Electron 기반 데스크톱 애플리케이션으로 구성한다.

```
┌───────────────────────────────┐
│ Renderer Process               │
│ React + TypeScript + Vite      │
│                               │
│  - 사용자 화면                 │
│  - 템플릿 관리                 │
│  - 학생 선택                   │
│  - 생성 결과 표시              │
│  - @rhwp/editor 임베드          │
└───────────────┬───────────────┘
                │ IPC
                │ contextBridge
┌───────────────▼───────────────┐
│ Electron Main Process          │
│                               │
│  - 문서 생성 엔진              │
│  - SQLite 관리                 │
│  - 파일 처리                   │
│  - OS 기능 접근                │
│                               │
│  @rhwp/core                    │
│  better-sqlite3                │
└───────────────────────────────┘
```

---

# 3. 기술 스택

| 영역              | 기술                        |
| --------------- | ------------------------- |
| Desktop Runtime | Electron                  |
| Frontend        | React + TypeScript + Vite |
| 상태 관리           | Zustand                   |
| HWPX Editor     | @rhwp/editor              |
| HWPX Processing | @rhwp/core                |
| Database        | SQLite                    |
| Database Driver | better-sqlite3            |
| Excel 처리        | ExcelJS                   |
| Logging         | electron-log              |
| Packaging       | electron-builder          |

---

# 4. 주요 기술 선택 이유

## 4.1 Electron

Electron을 사용하여 웹 기술 기반의 데스크톱 애플리케이션을 구축한다.

장점:

* Windows 환경 배포 용이
* React 기반 UI 개발 가능
* 파일 시스템 접근 가능
* 로컬 DB 사용 가능
* 별도 서버 없이 동작 가능

---

## 4.2 rhwp 기반 HWPX 처리

문서 편집 및 생성은 rhwp 라이브러리를 사용한다.

구성:

```
@rhwp/editor
        |
        |
사용자 문서 편집
        |
        |
@rhwp/core
        |
        |
자동 데이터 입력 및 저장
```

### @rhwp/editor 역할

사용자가 템플릿을 제작하는 환경을 제공한다.

담당 기능:

* HWPX 파일 열기
* 문서 편집
* 필드 삽입
* 문서 저장

사용자는 편집 화면에서 rhwp-studio 기능을 이용하여 필요한 위치에 필드를 삽입한다.

예:

```
학생 이름 : [NAME]

생년월일 : [BIRTHDAY]

사유 : [REASON]
```

---

### @rhwp/core 역할

자동 문서 생성 처리를 담당한다.

담당 기능:

* HWPX 로드
* 필드 조회
* 필드 값 입력
* 반복 행 처리
* HWPX 저장

예:

템플릿

```
학생명 : CLICK_HERE
학년 : CLICK_HERE
```

데이터

```
이름 : 홍길동
학년 : 3
```

결과

```
학생명 : 홍길동
학년 : 3
```

---

# 5. 프로그램 구조

프로젝트 구조:

```
front
│
├── src
│   │
│   ├── renderer
│   │   ├── pages
│   │   ├── components
│   │   ├── stores
│   │   └── api
│   │
│   ├── main
│   │   ├── database
│   │   ├── services
│   │   ├── ipc
│   │   └── document
│   │
│   ├── preload
│   │   └── index.ts
│   │
│   └── shared
│
├── package.json
└── electron-builder.yml
```

---

# 6. 문서 생성 방식

## 6.1 템플릿 제작 과정

```
1. 사용자가 HWPX 양식 작성

        ↓

2. rhwp editor에서 문서 열기

        ↓

3. 필요한 위치에 필드 삽입

        ↓

4. 템플릿 저장

        ↓

5. 프로그램에서 필드와 학생 데이터 연결
```

---

# 7. 필드 매핑 시스템

rhwp 필드와 프로그램 데이터를 연결한다.

예:

| HWPX 필드    | 데이터  |
| ---------- | ---- |
| NAME       | 학생명  |
| GRADE      | 학년   |
| CLASS_NO   | 반    |
| STUDENT_NO | 번호   |
| BIRTHDAY   | 생년월일 |

DB 저장:

```sql
template_field

id
template_id
field_name
binding
scope
required
default_value
```

---

# 8. 데이터베이스 설계

## 학생 관리

```sql
student

id
grade
class_no
student_no
name
gender
birthday
created_at
```

## 템플릿 관리

```sql
template

id
name
file_path
doc_type
created_at
updated_at
```

## 필드 매핑

```sql
template_field

id
template_id
field_name
binding
scope
required
default_value
```

## 생성 기록

```sql
document_history

id
template_id
student_id
output_path
created_at
```

---

# 9. 문서 생성 처리 흐름

```
학생 선택

↓

템플릿 선택

↓

필드 값 생성

↓

IPC 요청

↓

Main Process

↓

@rhwp/core 문서 로드

↓

필드 값 입력

↓

HWPX 저장

↓

생성 기록 저장

↓

완료 알림
```

---

# 10. 개별 문서 생성

예:

선택 학생:

```
3학년 1반

홍길동
김철수
이영희
```

템플릿:

```
결석계.hwpx
```

결과:

```
3-1-1_홍길동_결석계.hwpx

3-1-2_김철수_결석계.hwpx

3-1-3_이영희_결석계.hwpx
```

---

# 11. 목록형 문서 생성

한 문서 안에 여러 학생 데이터를 포함하는 방식.

예:

```
출석 현황표

-----------------

번호 이름 사유

1   홍길동

2   김철수

3   이영희

-----------------
```

처리:

```
템플릿 로드

↓

반복 행 복제

↓

학생 데이터 입력

↓

최종 HWPX 저장
```

---

# 12. CSV 데이터 입력

외부 학생 데이터를 CSV로 가져올 수 있다.

지원:

* 학생 번호 매칭
* 사용자 필드 입력
* 날짜 변환
* 누락 데이터 검사

예:

CSV

```
번호,사유

1,병결

2,가정사정
```

---

# 13. Electron 보안 구조

Renderer:

```
nodeIntegration=false

contextIsolation=true
```

Main 접근:

```
React

↓

preload.ts

↓

contextBridge

↓

ipcMain

↓

서비스
```

Renderer에서 직접 파일 시스템이나 DB에 접근하지 않는다.

---

# 14. 오류 처리

| 상황       | 처리        |
| -------- | --------- |
| 필드 없음    | 생성 중단     |
| 필수 값 없음  | 사용자 입력 요청 |
| 잘못된 HWPX | 파일 오류 표시  |
| 저장 실패    | 재시도 안내    |
| DB 오류    | 로그 기록     |
| 출력 파일 중복 | 자동 번호 처리  |

---

# 15. 배포 구조

```
Installer

↓

Electron Runtime

↓

React UI

↓

rhwp WASM

↓

SQLite Database
```

특징:

* 인터넷 필요 없음
* 별도 서버 필요 없음
* 학교 PC 단독 실행 가능

---

# 16. 개발 순서

## Phase 1

Electron 기본 환경 구축

* React 연결
* IPC 구조
* preload 구성

## Phase 2

데이터 관리

* SQLite 연결
* 학생 CRUD
* 템플릿 CRUD

## Phase 3

문서 기능

* rhwp editor 연동
* 필드 매핑
* 자동 생성

## Phase 4

고급 기능

* 목록형 문서
* CSV 입력
* PDF 출력
* 생성 이력

## Phase 5

배포

* electron-builder
* Windows 설치 파일 제작
* 클린 환경 테스트

---

# 17. 결론

본 시스템은 Electron과 rhwp 기반으로 구축하여 기존 서버 기반 문서 자동화 방식이 아닌 **완전한 로컬 실행형 학생 문서 자동 생성 플랫폼**을 목표로 한다.

핵심 방향은 다음과 같다.

* HWPX 템플릿 기반 자동화
* rhwp 공식 편집 환경 활용
* 필드 기반 데이터 치환
* SQLite 기반 로컬 관리
* 오프라인 동작
* 학교 업무 환경 최적화

이를 통해 반복적인 문서 작성 업무를 줄이고, 표준화된 문서 생성 환경을 제공한다.
