import { useCallback, useEffect, useState } from 'react'
import type { Template } from '../../../../shared/domain'
import { Alert, Button, Card, EmptyState, Select, Spinner } from '../ui'

export interface TemplatePreviewPanelProps {
  templates: Template[]
}

// A defensive check only — the SVG comes from @rhwp/core's own WASM renderer
// running against a file the local teacher registered themselves (single-
// user local app, no third-party/multi-tenant content), so
// dangerouslySetInnerHTML below is an accepted tradeoff. Still, SVG can
// technically carry <script> content, so reject it before ever injecting it
// as a cheap belt-and-suspenders check.
function containsScriptTag(svg: string): boolean {
  return /<script[\s>]/i.test(svg)
}

// Renders an already-registered template's pages headlessly via
// @rhwp/core's HwpDocument.renderPageSvg() (IPC: template:renderPreview) —
// a separate path from the @rhwp/editor iframe used for actually editing a
// template. See src/main/ipc/templates.ts for the handler and this task's
// spike notes for why this is known to work headlessly.
function TemplatePreviewPanel({ templates }: TemplatePreviewPanelProps): React.JSX.Element {
  const [templateId, setTemplateId] = useState<number | undefined>(templates[0]?.id)
  const [page, setPage] = useState(0)
  const [svg, setSvg] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  // Keep the selected template valid as the underlying list changes (e.g.
  // after a delete elsewhere in this page, or on first load).
  useEffect(() => {
    if (templateId !== undefined && templates.some((t) => t.id === templateId)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTemplateId(templates[0]?.id)
  }, [templates, templateId])

  // Selecting a different template always starts back at its first page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0)
  }, [templateId])

  const load = useCallback(async () => {
    if (templateId === undefined) {
      setSvg(null)
      setPageCount(0)
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const result = await window.api.templateRenderPreview({ templateId, page })
      if (containsScriptTag(result.svg)) {
        throw new Error('미리보기 렌더링 결과에 허용되지 않는 콘텐츠가 포함되어 있습니다.')
      }
      setSvg(result.svg)
      setPageCount(result.pageCount)
    } catch (e) {
      setSvg(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [templateId, page])

  useEffect(() => {
    // Standard fetch-on-dependency-change — same pattern as
    // TemplateLibraryPage.tsx's own mount-time load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  if (templates.length === 0) {
    return (
      <EmptyState
        title="미리볼 템플릿이 없습니다"
        description="템플릿을 먼저 등록하면 이 탭에서 렌더링된 페이지를 확인할 수 있습니다."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
        <Select
          label="템플릿"
          value={templateId ?? ''}
          onChange={(event) => setTemplateId(Number(event.target.value))}
          options={templates.map((t) => ({ value: String(t.id), label: t.name }))}
        />
      </div>

      {error && (
        <Alert
          type="error"
          message="미리보기를 렌더링하지 못했습니다."
          detail={error}
          onDismiss={() => setError(undefined)}
        />
      )}

      <Card className="flex flex-col items-center gap-4">
        {loading ? (
          <div className="flex min-h-[480px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : svg ? (
          <div
            className="max-h-[70vh] w-full overflow-auto rounded-md border border-lilac-ash-700 bg-white"
            // See containsScriptTag() above for the belt-and-suspenders check
            // applied before this string ever reaches this point.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex min-h-[480px] items-center justify-center text-sm text-lilac-ash-400">
            렌더링된 페이지가 없습니다.
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0 || loading}
            >
              이전
            </Button>
            <span className="text-sm text-lilac-ash-300">
              {page + 1} / {pageCount} 쪽
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1 || loading}
            >
              다음
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

export { TemplatePreviewPanel }
