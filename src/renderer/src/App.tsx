import { useEffect, useState } from 'react'
import type { Teacher } from '../../shared/domain'
import type { AppUpdateStatus } from '../../shared/ipc-types'
import { Button, Layout, Sidebar, Spinner, Topbar, useToast } from './components/ui'
import type { SidebarNavItem } from './components/ui'
import { FirstRunGate } from './pages/FirstRunGate'
import { GroupsPage } from './pages/GroupsPage'
import { GroupDetailPage } from './pages/GroupDetailPage'
import { TemplateLibraryPage } from './pages/TemplateLibraryPage'
import type { PickedTemplateFile } from './pages/TemplateLibraryPage'
import { TemplateEditorPage } from './pages/TemplateEditorPage'
import { MappingGenerationPage } from './pages/MappingGenerationPage'
import { GuidePage } from './pages/GuidePage'
import type { GuideTarget } from './pages/GuidePage'
import { TeacherFormModal } from './components/common/TeacherFormModal'
import { EditIcon } from './components/groups/icons'
import { cn, focusRing } from './components/ui/utils'

type View =
  | { name: 'groups' }
  | { name: 'group-detail'; groupId: number; groupName: string }
  | { name: 'templates' }
  | { name: 'template-editor'; templateId?: number; pickedFile?: PickedTemplateFile }
  | { name: 'mapping-generation'; templateId?: number; groupId?: number }
  | { name: 'guide' }

const VIEW_TITLES: Record<View['name'], string> = {
  groups: '그룹 관리',
  'group-detail': '그룹원',
  templates: '템플릿 라이브러리',
  'template-editor': '템플릿 편집',
  'mapping-generation': '필드 매핑 및 문서 생성',
  guide: '사용 가이드'
}

function guideTargetView(target: GuideTarget): View {
  switch (target) {
    case 'groups':
      return { name: 'groups' }
    case 'templates':
      return { name: 'templates' }
    case 'mapping-generation':
      return { name: 'mapping-generation' }
  }
}

// No router library — 4 screens, local single-user tool, no deep-linking
// need (an explicit plan decision, not an oversight). Navigation is plain
// `useState` view-switching, driven by the Sidebar and callbacks handed down
// to each page.
function App(): React.JSX.Element {
  const { toast } = useToast()
  const [teacher, setTeacher] = useState<Teacher | null | 'loading'>('loading')
  const [view, setView] = useState<View>({ name: 'groups' })
  const [teacherModalOpen, setTeacherModalOpen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null)

  useEffect(() => {
    window.api
      .teacherGet()
      .then(setTeacher)
      .catch(() => setTeacher(null))
  }, [])

  // Update state lives in main (src/main/updateCheck.ts): read it once, then
  // follow pushed changes (download progress → ready). Failures stay silent.
  useEffect(() => {
    const unsubscribe = window.api.onAppUpdateStatus(setUpdateStatus)
    window.api
      .appGetUpdateStatus()
      .then(setUpdateStatus)
      .catch(() => {})
    return unsubscribe
  }, [])

  if (teacher === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-void">
        <Spinner size="lg" />
      </div>
    )
  }

  if (teacher === null) {
    return <FirstRunGate onCreated={setTeacher} />
  }

  // A fresh `const` alias, narrowed to `Teacher` (not `Teacher | null |
  // 'loading'`) by the two early returns above — avoids `as Teacher` casts
  // in the JSX/closures below.
  const currentTeacher: Teacher = teacher

  async function handleUpdateTeacherName(name: string): Promise<void> {
    try {
      const updated = await window.api.teacherUpdate({ id: currentTeacher.id, name })
      setTeacher(updated)
      setTeacherModalOpen(false)
      toast({ type: 'success', message: '이름을 변경했습니다.' })
    } catch (e) {
      toast({
        type: 'error',
        message: '이름을 변경하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  const navItems: SidebarNavItem[] = [
    {
      key: 'groups',
      label: '그룹 관리',
      active: view.name === 'groups' || view.name === 'group-detail',
      onClick: () => setView({ name: 'groups' })
    },
    {
      key: 'templates',
      label: '템플릿 라이브러리',
      active: view.name === 'templates' || view.name === 'template-editor',
      onClick: () => setView({ name: 'templates' })
    },
    {
      key: 'mapping-generation',
      label: '문서 생성',
      active: view.name === 'mapping-generation',
      onClick: () => setView({ name: 'mapping-generation' })
    },
    {
      key: 'guide',
      label: '사용 가이드',
      active: view.name === 'guide',
      onClick: () => setView({ name: 'guide' })
    }
  ]

  function renderPage(): React.JSX.Element {
    switch (view.name) {
      case 'groups':
        return (
          <GroupsPage
            teacherId={currentTeacher.id}
            onOpenGroup={(group) =>
              setView({ name: 'group-detail', groupId: group.id, groupName: group.name })
            }
          />
        )
      case 'group-detail':
        return (
          <GroupDetailPage
            groupId={view.groupId}
            groupName={view.groupName}
            onBack={() => setView({ name: 'groups' })}
          />
        )
      case 'templates':
        return (
          <TemplateLibraryPage
            onOpenTemplate={(templateId) => setView({ name: 'template-editor', templateId })}
            onCreateFromPickedFile={(pickedFile) =>
              setView({ name: 'template-editor', pickedFile })
            }
          />
        )
      case 'template-editor':
        return (
          <TemplateEditorPage
            templateId={view.templateId}
            pickedFile={view.pickedFile}
            onSaved={(templateId) => setView({ name: 'mapping-generation', templateId })}
            onCancel={() => setView({ name: 'templates' })}
          />
        )
      case 'mapping-generation':
        return (
          <MappingGenerationPage
            teacherId={currentTeacher.id}
            teacherName={currentTeacher.name}
            initialTemplateId={view.templateId}
            initialGroupId={view.groupId}
          />
        )
      case 'guide':
        return <GuidePage onNavigate={(target) => setView(guideTargetView(target))} />
      default:
        return <></>
    }
  }

  return (
    <Layout
      sidebar={
        <Sidebar
          items={navItems}
          header={
            // DESIGN.md "logo lockup": a small angular violet mark + white
            // wordmark — the mark is the only brand graphic in the app.
            <div className="flex items-center gap-2.5 px-4 py-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-electric-iris" aria-hidden="true">
                <path d="M2 14 8.5 2 14 14 8.5 10.5Z" fill="currentColor" />
              </svg>
              <span className="text-base font-medium tracking-tight text-bone-white">
                class-doc
              </span>
            </div>
          }
          footer={
            updateStatus && (
              <div className="flex flex-col items-start gap-1.5 px-4">
                {updateStatus.state.kind === 'downloading' && (
                  <p className="flex items-center gap-2 px-1 text-xs text-ash-gray">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ash-gray" />
                    업데이트 받는 중 · v{updateStatus.state.version} ({updateStatus.state.percent}%)
                  </p>
                )}
                {(updateStatus.state.kind === 'ready' || updateStatus.state.kind === 'manual') && (
                  // Amber = DESIGN.md's emphasis color; violet stays reserved
                  // for each page's single primary action.
                  <button
                    type="button"
                    onClick={() => {
                      if (updateStatus.state.kind === 'ready') window.api.appInstallUpdate()
                      else window.api.appOpenUpdatePage()
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-full border border-saffron-spark/40 px-3 py-1.5 text-xs font-medium text-saffron-spark transition-colors duration-150 hover:bg-saffron-spark/10',
                      focusRing
                    )}
                    title={
                      updateStatus.state.kind === 'ready'
                        ? '지금 다시 시작해 새 버전을 설치합니다. 누르지 않아도 프로그램을 닫을 때 자동으로 설치됩니다.'
                        : '새 버전 다운로드 페이지를 브라우저로 엽니다'
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-saffron-spark"
                    />
                    {updateStatus.state.kind === 'ready'
                      ? `업데이트 준비됨 · 재시작`
                      : `업데이트 가능 · v${updateStatus.state.version}`}
                  </button>
                )}
                <p className="text-xs text-ash-gray">v{updateStatus.currentVersion}</p>
              </div>
            )
          }
        />
      }
      topbar={
        <Topbar title={VIEW_TITLES[view.name]}>
          <span>{currentTeacher.name} 선생님</span>
          <Button
            variant="ghost"
            size="icon"
            icon={<EditIcon className="h-4 w-4" />}
            aria-label="선생님 이름 변경"
            onClick={() => setTeacherModalOpen(true)}
          />
        </Topbar>
      }
    >
      {renderPage()}

      <TeacherFormModal
        open={teacherModalOpen}
        onClose={() => setTeacherModalOpen(false)}
        onSubmit={handleUpdateTeacherName}
        initialName={currentTeacher.name}
      />
    </Layout>
  )
}

export default App
