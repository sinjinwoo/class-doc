import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, Spinner } from '../ui'

export interface GenerationPreviewViewerProps {
  previewId: string
  /** Which page to render — controlled by the parent so its prev/next controls can live right next to the image instead of bundled inside this component. */
  page: number
}

// See TemplatePreviewPanel.tsx's identical check/comment — same
// belt-and-suspenders reasoning applies to generation:renderPreviewPage's
// SVG (also @rhwp/core's own WASM renderer, also a locally-registered file).
function containsScriptTag(svg: string): boolean {
  return /<script[\s>]/i.test(svg)
}

// Renders the merged/list document generation just prepared (but not yet
// written to disk) via generation:renderPreviewPage — the same
// HwpDocument.renderPageSvg() path and frame styling as TemplatePreviewPanel,
// just pointed at an in-memory preview instead of a registered template
// file (kept visually identical to that screen on purpose).
function GenerationPreviewViewer({
  previewId,
  page
}: GenerationPreviewViewerProps): React.JSX.Element {
  const [svg, setSvg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const result = await window.api.generationRenderPreviewPage({ previewId, page })
      if (containsScriptTag(result.svg)) {
        throw new Error('미리보기 렌더링 결과에 허용되지 않는 콘텐츠가 포함되어 있습니다.')
      }
      setSvg(result.svg)
    } catch (e) {
      setSvg(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [previewId, page])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <Alert
          type="error"
          message="미리보기를 렌더링하지 못했습니다."
          detail={error}
          onDismiss={() => setError(undefined)}
        />
      )}

      <Card className="flex min-h-[70vh] flex-1 flex-col items-stretch gap-4">
        {/* The mat around the page, not the page itself — the rendered
            <svg>'s own white page background stays untouched; only this
            surrounding frame is gray, so the page's edges are clearly
            visible. max-w/max-h-full + w/h-auto on the injected <svg> is the
            same "shrink to fit, keep aspect ratio" rule normally used for
            <img>. */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-lilac-ash-800 bg-lilac-ash-700 p-3">
          {loading ? (
            <Spinner size="lg" />
          ) : svg ? (
            <div
              className="flex h-full w-full items-center justify-center [&>svg]:h-auto [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:max-w-full"
              // See containsScriptTag() above for the check applied before this
              // string ever reaches this point.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="text-sm text-lilac-ash-400">렌더링된 페이지가 없습니다.</div>
          )}
        </div>
      </Card>
    </div>
  )
}

export { GenerationPreviewViewer }
