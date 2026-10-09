import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button, Tab, TabList, TabPanel, Tabs } from '../components/ui'

export type GuideTarget = 'groups' | 'templates' | 'mapping-generation'

export interface GuidePageProps {
  /** Jumps to the screen a guide tab is about (App.tsx owns navigation). */
  onNavigate: (target: GuideTarget) => void
}

type GuideTab = 'groups' | 'templates' | 'generation'

interface GuideNote {
  kind: 'tip' | 'caution'
  text: ReactNode
}

interface GuideStep {
  title: string
  body: ReactNode
  notes?: GuideNote[]
}

interface GuideSection {
  value: GuideTab
  label: string
  eyebrow: string
  heading: string
  summary: ReactNode
  target: GuideTarget
  targetLabel: string
  steps: GuideStep[]
  extras?: { title: string; items: ReactNode[] }
}

// Inline UI-name marker: renders an on-screen button/menu name the way the
// teacher will actually see it — white, slightly bolder, in brackets — so
// "click this" words stand out from the explanation around them.
function Ui({ children }: { children: ReactNode }): React.JSX.Element {
  return <span className="font-semibold whitespace-nowrap text-bone-white">[{children}]</span>
}

// Every label below was checked against the actual screens:
// GroupsPage / GroupDetailPage / components/groups/* (반 등록),
// TemplateLibraryPage / TemplateEditorPage (템플릿 등록),
// MappingGenerationPage / components/mapping/* (문서 생성).
const SECTIONS: GuideSection[] = [
  {
    value: 'groups',
    label: '반 등록',
    eyebrow: 'STEP 01 · 반 등록',
    heading: '학생 명단을 그룹으로 등록해요',
    summary: (
      <>
        이 프로그램에서는 반을 <strong className="font-semibold text-bone-white">그룹</strong>
        으로 등록합니다. 그룹은 함께 문서를 만들 학생들의 명단이에요. 한 반을 그룹 하나로 만들어도
        되고, 동아리·방과후 수업처럼 여러 반 학생을 섞어 만들어도 괜찮습니다.
      </>
    ),
    target: 'groups',
    targetLabel: '그룹 관리로 이동',
    steps: [
      {
        title: '새 그룹 만들기',
        body: (
          <>
            왼쪽 메뉴에서 <Ui>그룹 관리</Ui>를 누른 뒤, 오른쪽 위의 <Ui>새 그룹</Ui> 버튼을
            누릅니다. ‘새 그룹 만들기’ 창에 그룹 이름(예: 3학년 2반)을 적고 <Ui>저장</Ui>을
            누르세요.
          </>
        ),
        notes: [
          {
            kind: 'tip',
            text: '그룹 이름은 나중에 문서 파일 이름에 쓰일 수 있으니 알아보기 쉽게 지어 주세요.'
          }
        ]
      },
      {
        title: '그룹 열기',
        body: (
          <>
            목록에 생긴 그룹 카드를 누르면 학생 명단 화면이 열립니다. 카드 오른쪽의 숫자는 그 그룹에
            등록된 학생 수예요.
          </>
        )
      },
      {
        title: '엑셀·CSV 파일로 명단 한 번에 올리기',
        body: (
          <>
            <Ui>명단 가져오기</Ui>를 누르고 엑셀(.xlsx)이나 CSV 파일을 창에 끌어다 놓거나, 눌러서
            선택합니다. 파일의
            <strong className="font-semibold text-bone-white"> 첫 줄(제목 줄)</strong>이 그대로 학생
            정보의 항목(필드)이 돼요. <Ui>다음</Ui>을 눌러 미리보기 표를 확인한 뒤 <Ui>가져오기</Ui>
            를 누르면 끝입니다.
          </>
        ),
        notes: [
          {
            kind: 'tip',
            text: (
              <>
                예시 첫 줄:{' '}
                <span className="font-semibold text-bone-white">
                  반 · 번호 · 이름 · 보호자 이름
                </span>{' '}
                — 항목은 정해져 있지 않아서 그룹마다 달라도 됩니다.
              </>
            )
          },
          {
            kind: 'caution',
            text: (
              <>
                엑셀 파일은 <strong className="font-semibold">첫 번째 시트</strong>만 읽어요. 예전
                형식인 .xls 파일은 엑셀에서 ‘.xlsx’로 다시 저장한 뒤 가져와 주세요.
              </>
            )
          }
        ]
      },
      {
        title: '한 명씩 추가하거나 고치기',
        body: (
          <>
            <Ui>학생 추가</Ui>를 누르면 그룹의 항목마다 입력 칸이 나옵니다. 값을 적고 <Ui>추가</Ui>
            를 누르세요. 이미 등록된 학생은 표 오른쪽의 연필 아이콘으로 고치고, 휴지통 아이콘으로
            삭제할 수 있어요.
          </>
        ),
        notes: [
          {
            kind: 'tip',
            text: '아직 항목이 하나도 없는 새 그룹이라면, 창 아래 ‘새 필드 이름’ 칸에 이름·학년 같은 항목을 먼저 추가한 다음 값을 입력하세요.'
          }
        ]
      },
      {
        title: '필드(항목) 관리',
        body: (
          <>
            <Ui>필드 관리</Ui>에서 ‘메모’처럼 새 항목을 추가하거나, 필요 없는 항목을 지울 수
            있습니다.
          </>
        ),
        notes: [
          {
            kind: 'caution',
            text: '항목을 지우면 모든 학생의 해당 값도 함께 지워지고, 되돌릴 수 없어요.'
          }
        ]
      }
    ],
    extras: {
      title: '알아두면 좋아요',
      items: [
        <>
          <strong className="font-semibold text-bone-white">
            명단을 다시 올려도 중복되지 않아요.
          </strong>{' '}
          같은 그룹에 CSV를 다시 가져오면{' '}
          <strong className="font-semibold text-bone-white">학년·반·번호</strong>가 같은 학생을 같은
          사람으로 보고, 새 값으로 정보를 바꿔 줍니다.
        </>,
        <>
          CSV에 학년·반·번호 항목이 없으면 모든 칸이 똑같은 경우에만 같은 학생으로 알아봐요. 이때는
          값이 하나라도 바뀌면 새 학생으로 추가될 수 있으니, 가능하면 세 항목을 넣어 주세요.
        </>,
        <>
          <strong className="font-semibold text-bone-white">이름</strong> 또는{' '}
          <strong className="font-semibold text-bone-white">성명</strong> 항목이 학생 이름으로
          쓰입니다(명단 표에서 굵게 표시). 둘 다 없으면 첫 번째 항목이 이름 역할을 해요.
        </>
      ]
    }
  },
  {
    value: 'templates',
    label: '템플릿 등록',
    eyebrow: 'STEP 02 · 템플릿 등록',
    heading: '한글 서식에 누름틀을 넣어 등록해요',
    summary: (
      <>
        템플릿은 학생마다 내용이 달라지는 자리에{' '}
        <strong className="font-semibold text-bone-white">누름틀(필드)</strong>을 넣어 둔 한글
        문서입니다. 예를 들어 가정통신문의 이름 자리에 ‘이름’ 누름틀을 넣어 두면, 문서를 만들 때
        학생마다 이름이 자동으로 채워져요.
      </>
    ),
    target: 'templates',
    targetLabel: '템플릿 라이브러리로 이동',
    steps: [
      {
        title: '한글 파일을 HWPX로 준비하기',
        body: (
          <>
            한글에서 사용할 서식을 열고 <Ui>다른 이름으로 저장</Ui>에서 파일 형식을{' '}
            <strong className="font-semibold text-bone-white">HWPX</strong>로 골라 저장합니다.
          </>
        ),
        notes: [
          {
            kind: 'caution',
            text: '예전 형식인 .hwp 파일은 등록할 수 없어요. 꼭 .hwpx로 저장해 주세요.'
          }
        ]
      },
      {
        title: '새 템플릿 등록',
        body: (
          <>
            왼쪽 메뉴에서 <Ui>템플릿 라이브러리</Ui>를 누르고 <Ui>새 템플릿 등록</Ui>을 누른 뒤,
            파일 선택 창에서 준비한 HWPX 파일을 고릅니다. 편집 화면이 열리고 문서가 편집기에
            나타나요.
          </>
        )
      },
      {
        title: '편집기 안에서 누름틀 넣기',
        body: (
          <>
            학생마다 달라질 자리에 커서를 두고, 편집기 메뉴의 <Ui>입력</Ui> → <Ui>필드 입력</Ui>
            (단축키: Ctrl+K를 누른 뒤 E)을 누릅니다. ‘필드 이름’에 이름·번호처럼 알아보기 쉬운
            이름을 적고 확인하세요. 필요한 자리마다 반복하면 됩니다.
          </>
        ),
        notes: [
          {
            kind: 'caution',
            text: '누름틀은 선생님이 편집기 안에서 직접 넣어야 해요. 프로그램이 대신 넣어 주지는 않습니다.'
          },
          {
            kind: 'caution',
            text: '한 문서 안에서 누름틀 이름이 겹치면 저장되지 않아요. 이름을 서로 다르게 지어 주세요.'
          }
        ]
      },
      {
        title: '템플릿 이름 정하기',
        body: (
          <>
            편집기 위쪽의 ‘템플릿 이름’을 확인합니다. 처음에는 파일 이름이 들어가 있으니, 알아보기
            쉬운 이름으로 바꿔도 좋아요. 템플릿 하나로 학생 한 명마다 같은 서식이 한 부씩
            채워집니다.
          </>
        )
      },
      {
        title: '저장하기',
        body: (
          <>
            템플릿 이름 오른쪽의 <Ui>저장</Ui>을 누르면 템플릿이 등록되고, 넣어 둔 누름틀 목록이
            자동으로 읽혀요. 저장이 끝나면 바로 <Ui>문서 생성</Ui> 화면으로 넘어갑니다.
          </>
        ),
        notes: [
          {
            kind: 'tip',
            text: '저장에 실패해도 편집기 안의 작업 내용은 그대로 남아 있으니, 안내를 확인한 뒤 다시 저장하면 됩니다.'
          }
        ]
      }
    ],
    extras: {
      title: '알아두면 좋아요',
      items: [
        <>
          템플릿 라이브러리에서 카드를 누르면 다시 편집할 수 있어요. 누름틀을 추가·삭제하고 다시
          저장해도, 남아 있는 누름틀의 연결 설정은 그대로 유지됩니다.
        </>,
        <>
          <Ui>미리보기</Ui> 탭에서는 등록한 템플릿이 실제로 어떻게 보이는지 쪽별로 확인할 수 있어요.
        </>
      ]
    }
  },
  {
    value: 'generation',
    label: '문서 생성',
    eyebrow: 'STEP 03 · 문서 생성',
    heading: '누름틀을 학생 정보와 연결해 문서를 만들어요',
    summary: (
      <>
        템플릿과 그룹을 고르고, 누름틀마다 어떤 내용을 넣을지 정하면 선택한 학생 모두의 문서가{' '}
        <strong className="font-semibold text-bone-white">한 파일</strong>로 만들어집니다. 예를 들어
        학생 30명을 선택하면 30쪽짜리 문서 하나가 생겨요.
      </>
    ),
    target: 'mapping-generation',
    targetLabel: '문서 생성으로 이동',
    steps: [
      {
        title: '템플릿과 그룹 고르기',
        body: (
          <>
            왼쪽 메뉴에서 <Ui>문서 생성</Ui>을 누르고, 위쪽의 ‘템플릿’과 ‘그룹’을 각각 고릅니다. 둘
            다 고르면 아래에 연결 표가 나타나요.
          </>
        )
      },
      {
        title: '누름틀마다 들어갈 내용 연결하기 (필드 매핑)',
        body: (
          <>
            ‘필드 매핑’ 표에서 누름틀(필드명)마다 ‘매핑 대상’을 고릅니다. 그룹의 항목(예: 이름,
            번호)을 고르면 학생 정보가 들어가고,{' '}
            <strong className="font-semibold text-bone-white">교사 이름</strong>을 고르면 선생님
            성함이, <strong className="font-semibold text-bone-white">직접 입력</strong>을 고르면
            다음 단계에서 학생별로 직접 적은 내용이 들어갑니다.
          </>
        ),
        notes: [
          {
            kind: 'tip',
            text: '새로 등록한 누름틀은 처음에 ‘직접 입력’으로 되어 있어요. 고른 내용은 바로 저장되고, 같은 템플릿과 그룹을 다시 고르면 그대로 남아 있습니다.'
          },
          {
            kind: 'caution',
            text: '상태가 ‘그룹에 필드 없음’이면 연결된 항목이 그룹에서 사라진 것이에요. 매핑 대상을 다시 골라 주세요.'
          }
        ]
      },
      {
        title: '학생 고르고 내용 확인하기',
        body: (
          <>
            ‘생성할 학생 선택’ 표에는 누름틀이 열로, 학생마다 들어갈 값이 미리 채워져 보입니다.
            처음에는 모든 학생이 선택되어 있으니, 빼고 싶은 학생만 체크를 해제하세요. ‘직접 입력’
            열은 표 안의 칸에 바로 적으면 돼요(비워 두어도 됩니다).
          </>
        ),
        notes: [
          {
            kind: 'caution',
            text: '직접 입력한 값은 따로 저장되지 않아요. 템플릿이나 그룹을 바꾸거나 다른 화면으로 나가면 지워집니다.'
          }
        ]
      },
      {
        title: '생성하고 미리보기',
        body: (
          <>
            <Ui>생성</Ui>을 누르면 완성될 문서를 미리 보여 줍니다. <Ui>← 이전 쪽</Ui>·
            <Ui>다음 쪽 →</Ui>으로 넘겨 가며 확인하세요. 이 단계에서는 아직 파일이 저장되지 않으니,
            고칠 곳이 있으면 <Ui>수정하기</Ui>로 돌아가면 됩니다.
          </>
        ),
        notes: [
          {
            kind: 'tip',
            text: '연결 문제로 만들 수 없는 학생이 있으면 미리보기 위쪽에 따로 표시되고, 그 학생은 문서에서 빠집니다.'
          }
        ]
      },
      {
        title: '저장하기',
        body: (
          <>
            화면 아래의 <Ui>생성하기</Ui>를 누르고, 문서를 저장할 폴더를 고르면 끝입니다. 선택한
            학생 전체가 한 파일에 차례로 담겨요.
          </>
        ),
        notes: [
          {
            kind: 'tip',
            text: (
              <>
                파일 이름은{' '}
                <span className="font-semibold text-bone-white">학년-반_템플릿이름.hwpx</span>{' '}
                형태로 정해지고, 학년·반 항목이 없으면 그룹 이름이 대신 쓰여요.
              </>
            )
          },
          {
            kind: 'tip',
            text: '폴더 선택 창을 취소하면 저장되지 않고 미리보기 화면이 그대로 남아 있어요.'
          }
        ]
      }
    ]
  }
]

function NoteLine({ note }: { note: GuideNote }): React.JSX.Element {
  const isCaution = note.kind === 'caution'
  return (
    <li className="flex gap-3 text-sm leading-relaxed">
      <span
        className={
          isCaution
            ? 'w-10 shrink-0 pt-0.5 text-label font-medium uppercase text-danger'
            : 'w-10 shrink-0 pt-0.5 text-label font-medium uppercase text-saffron-spark'
        }
      >
        {isCaution ? '주의' : 'TIP'}
      </span>
      <span className="text-silver-mist">{note.text}</span>
    </li>
  )
}

function GuideSectionView({
  section,
  onNavigate
}: {
  section: GuideSection
  onNavigate: (target: GuideTarget) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-12">
      {/* Intro: amber eyebrow + weight-400 heading + gray summary, and the
          single violet action for this view (DESIGN.md's headline block). */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-label font-medium uppercase text-saffron-spark">{section.eyebrow}</p>
          <h3 className="text-title font-normal text-bone-white">{section.heading}</h3>
          <p className="text-[15px] leading-relaxed font-light text-silver-mist">
            {section.summary}
          </p>
        </div>
        <Button onClick={() => onNavigate(section.target)}>{section.targetLabel} →</Button>
      </div>

      <ol className="flex flex-col">
        {section.steps.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[4.5rem_1fr] gap-x-6 border-t border-line py-8 last:border-b"
          >
            <span
              aria-hidden="true"
              className="text-display leading-none font-light text-ash-gray tabular-nums"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex max-w-3xl flex-col gap-3">
              <h4 className="text-heading font-normal text-bone-white">
                <span className="sr-only">{index + 1}단계: </span>
                {step.title}
              </h4>
              <p className="text-[15px] leading-relaxed font-light text-silver-mist">{step.body}</p>
              {step.notes && step.notes.length > 0 && (
                <ul className="mt-1 flex flex-col gap-2">
                  {step.notes.map((note, noteIndex) => (
                    <NoteLine key={noteIndex} note={note} />
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {section.extras && (
        <div className="grid grid-cols-[4.5rem_1fr] gap-x-6">
          <span aria-hidden="true" />
          <div className="flex max-w-3xl flex-col gap-4">
            <p className="text-label font-medium uppercase text-saffron-spark">
              {section.extras.title}
            </p>
            <ul className="flex flex-col gap-3">
              {section.extras.items.map((item, index) => (
                <li
                  key={index}
                  className="relative pl-5 text-sm leading-relaxed text-silver-mist before:absolute before:top-[0.6em] before:left-0 before:h-1.5 before:w-1.5 before:rounded-full before:bg-ash-gray"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function GuidePage({ onNavigate }: GuidePageProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<GuideTab>('groups')

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="text-label font-medium uppercase text-saffron-spark">사용 가이드</p>
        <h2 className="text-display font-normal text-bone-white">세 단계면 문서가 완성돼요.</h2>
        <p className="max-w-2xl text-[15px] leading-relaxed font-light text-silver-mist">
          반 등록 → 템플릿 등록 → 문서 생성 순서로 진행하면 됩니다. 처음 한 번만 준비해 두면,
          다음부터는 문서 생성만으로 반 전체의 문서를 바로 만들 수 있어요.
        </p>
        {/* Keep in sync with reality: all data lives in the local class-doc/
            folder (SQLite + template/output files); the only external request
            is src/main/updateCheck.ts's release-metadata GET (no user data).
            Adding any other network feature means updating this text. */}
        <div className="mt-3 flex max-w-3xl flex-col gap-1.5 rounded-panel border border-line bg-surface px-5 py-4">
          <p className="text-label font-medium uppercase text-saffron-spark">개인정보 안내</p>
          <p className="text-sm leading-relaxed text-silver-mist">
            학생 명단, 템플릿, 만들어진 문서 등 모든 정보는{' '}
            <strong className="font-semibold text-bone-white">선생님의 컴퓨터 안에서만</strong>{' '}
            다루어지며, 외부로 전송되지 않습니다. 모든 자료는 프로그램 옆의{' '}
            <span className="text-bone-white">class-doc</span> 폴더에 저장되고, 편집기를 포함한 모든
            기능이 인터넷 연결 없이 동작합니다. 인터넷에 연결되어 있으면 새 버전이 나왔는지만
            확인하며, 이때도 학생 정보는 전혀 보내지 않습니다.
          </p>
        </div>
        {/* Mirrors src/main/paths.ts: packaged builds store everything in
            <folder of the .exe>/class-doc/{data,template,output}. */}
        <div className="flex max-w-3xl flex-col gap-1.5 rounded-panel border border-line bg-surface px-5 py-4">
          <p className="text-label font-medium uppercase text-saffron-spark">
            다른 컴퓨터에서 이어 쓰기
          </p>
          <p className="text-sm leading-relaxed text-silver-mist">
            프로그램(실행 파일)이 있는 폴더의 <span className="text-bone-white">class-doc</span>{' '}
            폴더를 통째로 복사해, 다른 컴퓨터에서도{' '}
            <strong className="font-semibold text-bone-white">프로그램과 같은 위치</strong>에 두고
            실행하면 등록한 반, 템플릿, 만든 문서가 그대로 유지됩니다. 새 버전을 설치하거나
            프로그램을 지워도 이 폴더는 지워지지 않아요.
          </p>
          <div className="mt-1">
            {/* Secondary, not primary: violet stays reserved for each tab's
                single "…로 이동" action below. */}
            <Button
              variant="secondary"
              onClick={() => {
                window.api.appOpenDataFolder().catch(() => {})
              }}
            >
              데이터 폴더 열기
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GuideTab)}>
        <TabList aria-label="사용 가이드 단계">
          {SECTIONS.map((section, index) => (
            <Tab key={section.value} value={section.value} className="flex items-baseline gap-2">
              <span aria-hidden="true" className="text-xs tabular-nums opacity-60">
                {String(index + 1).padStart(2, '0')}
              </span>
              {section.label}
            </Tab>
          ))}
        </TabList>

        {SECTIONS.map((section) => (
          <TabPanel key={section.value} value={section.value} className="pt-10">
            <GuideSectionView section={section} onNavigate={onNavigate} />
          </TabPanel>
        ))}
      </Tabs>
    </div>
  )
}

export { GuidePage }
