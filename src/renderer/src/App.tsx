import { useEffect, useState } from 'react'
import type { Teacher } from '../../shared/domain'
import { Layout, Sidebar, Spinner, Topbar } from './components/ui'
import type { SidebarNavItem } from './components/ui'
import { FirstRunGate } from './pages/FirstRunGate'
import { GroupsPage } from './pages/GroupsPage'
import { GroupDetailPage } from './pages/GroupDetailPage'
import { TemplateLibraryPage } from './pages/TemplateLibraryPage'
import type { PickedTemplateFile } from './pages/TemplateLibraryPage'
import { TemplateEditorPage } from './pages/TemplateEditorPage'
import { MappingGenerationPage } from './pages/MappingGenerationPage'

type View =
  | { name: 'groups' }
  | { name: 'group-detail'; groupId: number; groupName: string }
  | { name: 'templates' }
  | { name: 'template-editor'; templateId?: number; pickedFile?: PickedTemplateFile }
  | { name: 'mapping-generation'; templateId?: number; groupId?: number }

const VIEW_TITLES: Record<View['name'], string> = {
  groups: '그룹 관리',
  'group-detail': '학생 명단',
  templates: '템플릿 라이브러리',
  'template-editor': '템플릿 편집',
  'mapping-generation': '필드 매핑 및 문서 생성'
}

// No router library — 4 screens, local single-user tool, no deep-linking
// need (an explicit plan decision, not an oversight). Navigation is plain
// `useState` view-switching, driven by the Sidebar and callbacks handed down
// to each page.
function App(): React.JSX.Element {
  const [teacher, setTeacher] = useState<Teacher | null | 'loading'>('loading')
  const [view, setView] = useState<View>({ name: 'groups' })

  useEffect(() => {
    window.api
      .teacherGet()
      .then(setTeacher)
      .catch(() => setTeacher(null))
  }, [])

  if (teacher === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-lilac-ash-950">
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
            initialTemplateId={view.templateId}
            initialGroupId={view.groupId}
          />
        )
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
            <div className="px-3 py-3 text-base font-semibold text-lilac-ash-50">class-doc</div>
          }
        />
      }
      topbar={<Topbar title={VIEW_TITLES[view.name]}>{currentTeacher.name} 선생님</Topbar>}
    >
      {renderPage()}
    </Layout>
  )
}

export default App
