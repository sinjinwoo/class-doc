import { useCallback, useEffect, useState } from 'react'
import type { RhwpEditor } from '@rhwp/editor'
import type { TemplateDocType } from '../../../shared/domain'
import { Alert, Button, Input, PageHeader, useToast } from '../components/ui'
import { RhwpEditorHost } from '../editor/RhwpEditorHost'

export interface TemplateEditorPageProps {
  /** Set when re-editing an already-registered template. */
  templateId?: number
  /** Set when registering a brand-new template from a freshly picked file. */
  pickedFile?: { fileName: string; bytes: Uint8Array }
  onSaved: (templateId: number) => void
  onCancel: () => void
}

function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

// The registration/re-edit flow from .claude/skills/rhwp/references/arcjotectire.md:
// load bytes into the @rhwp/editor iframe, let the teacher insert 누름틀 fields
// with rhwp-studio's own UI, then on this host's own "저장" button: export ->
// persist via IPC -> only on success, notify the studio the export was saved.
function TemplateEditorPage({
  templateId,
  pickedFile,
  onSaved,
  onCancel
}: TemplateEditorPageProps): React.JSX.Element {
  const { toast } = useToast()

  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null)
  const [sourceFileName, setSourceFileName] = useState('')
  const [name, setName] = useState('')
  // No doc-type picker in the UI: 목록형 (LIST) generation isn't functional
  // yet (see generation.ts prepareList()), so new templates are always
  // 개별형. A re-edited template keeps whatever type it was saved with.
  const [docType, setDocType] = useState<TemplateDocType>('INDIVIDUAL')
  const [loadError, setLoadError] = useState<string | undefined>(undefined)

  const [editor, setEditor] = useState<RhwpEditor | null>(null)
  const [editorLoaded, setEditorLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>(undefined)

  // Load the source bytes: either the freshly picked file (already in
  // memory), or an existing template's bytes + metadata re-fetched over IPC.
  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      try {
        if (pickedFile) {
          if (cancelled) return
          setSourceBytes(pickedFile.bytes)
          setSourceFileName(pickedFile.fileName)
          setName(stripExtension(pickedFile.fileName))
          return
        }
        if (templateId !== undefined) {
          const [fileResult, list] = await Promise.all([
            window.api.templateReadFile({ templateId }),
            window.api.templateList()
          ])
          if (cancelled) return
          setSourceBytes(fileResult.bytes)
          setSourceFileName(fileResult.fileName)
          const existing = list.find((t) => t.id === templateId)
          if (existing) {
            setName(existing.name)
            setDocType(existing.docType)
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [templateId, pickedFile])

  const handleEditorReady = useCallback((instance: RhwpEditor) => {
    setEditor(instance)
  }, [])

  // Once both the editor instance and the source bytes are available (either
  // may arrive first), load the document into the iframe exactly once.
  useEffect(() => {
    if (!editor || !sourceBytes || editorLoaded) return undefined
    let cancelled = false
    editor
      .loadFile(sourceBytes, sourceFileName)
      .then(() => {
        if (cancelled) return
        setEditorLoaded(true)
        // Cheap, harmless safety net (see RhwpEditorHost.tsx's container-
        // sizing comment for the fuller timing investigation): in case
        // rhwp-studio's own internal layout listens for window resize
        // events to re-fit its view, nudge it once after the document has
        // finished loading into its now-real-sized container.
        window.dispatchEvent(new Event('resize'))
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [editor, sourceBytes, sourceFileName, editorLoaded])

  async function handleSave(): Promise<void> {
    if (!editor) return
    setSaving(true)
    setSaveError(undefined)
    try {
      const bytes = await editor.exportHwpx()

      const saved = await window.api
        .templateSave({
          templateId,
          name: name.trim() || undefined,
          fileName: sourceFileName,
          docType,
          bytes
        })
        .catch((e: unknown) => {
          // templateSave failed — the draft must stay recoverable inside the
          // iframe, so notifySaved() must NOT be called in this branch.
          setSaveError(e instanceof Error ? e.message : String(e))
          return null
        })
      if (!saved) return

      await editor.notifySaved(sourceFileName)

      toast({
        type: 'success',
        message: '템플릿이 저장되었습니다.',
        detail: '탐색기 미리보기 이미지는 갱신되지 않을 수 있으나 문서 내용에는 문제가 없습니다.'
      })
      onSaved(saved.id)
    } catch (e) {
      // exportHwpx() or notifySaved() failure.
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        leading={
          <Button variant="ghost" className="-ml-3" onClick={onCancel}>
            ← 템플릿 목록
          </Button>
        }
        eyebrow="템플릿"
        title={templateId !== undefined ? '템플릿 편집' : '새 템플릿 등록'}
      />

      <Alert
        type="info"
        message="필드(누름틀)는 편집기 안에서 직접 삽입해 주세요."
        detail="편집기 위쪽 메뉴의 '입력 → 필드 입력'을 사용합니다. 단축키는 Ctrl+K를 누른 뒤 E입니다."
      />

      {loadError && (
        <Alert type="error" message="템플릿 파일을 불러오지 못했습니다." detail={loadError} />
      )}
      {saveError && (
        <Alert
          type="error"
          message="템플릿 저장에 실패했습니다. 편집기 안의 내용은 그대로 보존되어 있습니다."
          detail={saveError}
          onDismiss={() => setSaveError(undefined)}
        />
      )}

      {/* Name + save sit together directly above the editor so the save
          action is visible without scrolling past the (tall) editor — a
          bottom action bar went unnoticed in testing. */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="템플릿 이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={sourceFileName || '템플릿 이름'}
          />
        </div>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!editorLoaded}>
          저장
        </Button>
      </div>

      {/* A thin frame around the third-party (white) editor iframe — no
          padding, so the editor's own chrome sits flush inside the rounded
          hairline instead of floating in a dark box. Fills whatever vertical
          space this flex-1 wrapper is given instead of a fixed height, so the
          editor doesn't get clipped (nor waste space) when the window is
          resized — the app window has no fixed-size lock (src/main/index.ts).
          The min-h lives on this wrapper (not just the host) because
          overflow-hidden drops a flex item's automatic min-height to 0. */}
      <div className="min-h-[600px] flex-1 overflow-hidden rounded-panel border border-line-strong bg-surface">
        <RhwpEditorHost onReady={handleEditorReady} className="h-full min-h-[600px]" />
      </div>
    </div>
  )
}

export { TemplateEditorPage }
