import { useCallback, useEffect, useState } from 'react'
import type { Template } from '../../../shared/domain'
import {
  Alert,
  Button,
  EmptyState,
  PageHeader,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  useToast
} from '../components/ui'
import { TemplateCard, TemplatePreviewPanel } from '../components/templates'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

export interface PickedTemplateFile {
  fileName: string
  bytes: Uint8Array
}

export interface TemplateLibraryPageProps {
  onOpenTemplate: (templateId: number) => void
  onCreateFromPickedFile: (file: PickedTemplateFile) => void
}

function TemplateLibraryPage({
  onOpenTemplate,
  onCreateFromPickedFile
}: TemplateLibraryPageProps): React.JSX.Element {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [picking, setPicking] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [activeTab, setActiveTab] = useState<'library' | 'preview'>('library')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(undefined)
    try {
      setTemplates(await window.api.templateList())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // See GroupsPage.tsx's identical comment — standard fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function handlePickFile(): Promise<void> {
    setPicking(true)
    try {
      const result = await window.api.templatePickFile()
      if (!result) return // user canceled the dialog — not an error
      onCreateFromPickedFile({ fileName: result.fileName, bytes: result.bytes })
    } catch (e) {
      toast({
        type: 'error',
        message: '파일을 선택하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setPicking(false)
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return
    const template = deleteTarget
    setDeleteTarget(null)
    try {
      await window.api.templateDelete({ templateId: template.id })
      toast({ type: 'success', message: `'${template.name}' 템플릿을 삭제했습니다.` })
      await load()
    } catch (e) {
      toast({
        type: 'error',
        message: '템플릿을 삭제하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="문서 서식"
        title="템플릿 라이브러리"
        description="누름틀(필드)을 넣은 한글(HWPX) 서식을 등록해 두고, 문서를 만들 때 불러와 사용합니다."
        actions={
          <Button onClick={handlePickFile} loading={picking}>
            새 템플릿 등록
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert type="error" message="템플릿 목록을 불러오지 못했습니다." detail={loadError} />
          <Button variant="secondary" onClick={load}>
            다시 시도
          </Button>
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'library' | 'preview')}
        >
          <TabList>
            <Tab value="library">템플릿 목록</Tab>
            <Tab value="preview">미리보기</Tab>
          </TabList>

          <TabPanel value="library" className="pt-6">
            {templates.length === 0 ? (
              <EmptyState
                title="등록된 템플릿이 없습니다"
                description="HWPX 파일을 선택해 새 템플릿을 등록하세요."
                action={
                  <Button variant="secondary" onClick={handlePickFile} loading={picking}>
                    새 템플릿 등록
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onOpen={() => onOpenTemplate(template.id)}
                    onDelete={() => setDeleteTarget(template)}
                  />
                ))}
              </div>
            )}
          </TabPanel>

          <TabPanel value="preview" className="pt-6">
            <TemplatePreviewPanel templates={templates} />
          </TabPanel>
        </Tabs>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="템플릿 삭제"
        message={`'${deleteTarget?.name ?? ''}' 템플릿을 삭제하시겠습니까?`}
        detail="이 템플릿에 연결된 필드 매핑 정보도 함께 삭제됩니다. 이미 생성된 문서와 생성 이력에는 영향이 없습니다."
        confirmLabel="삭제"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export { TemplateLibraryPage }
