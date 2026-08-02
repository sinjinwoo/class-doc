import { useEffect, useRef, useState } from 'react'
import { createEditor, type RhwpEditor } from '@rhwp/editor'
import { Alert, Spinner } from '../components/ui'
import { cn } from '../components/ui/utils'
import { RHWP_STUDIO_URL } from './studioUrl'

// Waits two animation frames — one full layout+paint cycle — so any
// still-settling ancestor flex layout (e.g. TemplateEditorPage.tsx's
// `flex h-full flex-col` > `Card.flex-1` chain that this host's own size is
// computed against) has resolved before the iframe is created against it.
function waitTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export interface RhwpEditorHostProps {
  /** Fired once after `createEditor()` resolves, with the live instance. */
  onReady: (editor: RhwpEditor) => void
  className?: string
}

type EditorStatus = 'loading' | 'ready' | 'error'

// Mounts/unmounts the @rhwp/editor iframe lifecycle. This screen depends on
// reaching the online-hosted rhwp-studio (see studioUrl.ts) — no network, or
// the host being briefly unreachable, is an expected failure mode here, not
// an exceptional one, so createEditor()'s rejection is caught and surfaced
// as an inline Alert rather than left as an unhandled rejection that would
// blank the screen.
function RhwpEditorHost({ onReady, className }: RhwpEditorHostProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<RhwpEditor | null>(null)
  const onReadyRef = useRef(onReady)

  const [status, setStatus] = useState<EditorStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

  // Keep the ref in sync with the latest `onReady` prop identity — done in an
  // effect (not during render) so the mount/unmount effect below can read the
  // latest callback via the ref without needing `onReady` itself in its
  // dependency array (which would otherwise tear down and recreate the
  // iframe whenever the parent passes an unmemoized callback).
  useEffect(() => {
    onReadyRef.current = onReady
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let cancelled = false

    // Previously this called createEditor() synchronously in the same tick
    // the container first mounted, while this component's *own* ancestor
    // chain (TemplateEditorPage.tsx's `flex h-full flex-col` > `Card.flex-1`)
    // may not have finished resolving its layout yet on the very first paint.
    // Combined with the container div's own className toggling between
    // `hidden` (display:none, zero size) and its real size only once the
    // editor became 'ready' — i.e. *after* createEditor() had already
    // finished creating/handshaking the iframe against a zero-size container
    // — rhwp-studio's own initial layout pass could run against a stale/
    // small container size. The container below is now unconditionally sized
    // (`absolute inset-0` of an always-sized `relative` wrapper) instead of
    // toggling `hidden`, and this waits a full layout+paint cycle before
    // calling createEditor() at all, so the iframe is created against a
    // container that has already settled into its real size.
    waitTwoFrames().then(() => {
      if (cancelled) return
      createEditor(container, { studioUrl: RHWP_STUDIO_URL })
        .then((editor) => {
          if (cancelled) {
            editor.destroy()
            return
          }
          editorRef.current = editor
          setStatus('ready')
          onReadyRef.current(editor)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : String(error))
        })
    })

    return () => {
      cancelled = true
      editorRef.current?.destroy()
      editorRef.current = null
    }
    // Intentionally mount/destroy exactly once per RhwpEditorHost instance —
    // see the ref-sync effect above for why `onReady` is safe to omit here.
  }, [])

  return (
    <div className={cn('relative', className)}>
      {/* Always mounted at its real, final size (never `display:none`) so
          createEditor() creates the iframe against a container that already
          has real dimensions instead of a zero-size one that only becomes
          real after the fact. `absolute inset-0` (rather than composing
          `h-full`/`min-h-[...]` a second time here) fills the sized
          `relative` wrapper above directly, sidestepping any percentage-
          height resolution timing of its own. */}
      <div ref={containerRef} className="absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Alert
            type="error"
            message="편집기를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 이 화면을 다시 열어주세요."
            detail={errorMessage}
          />
        </div>
      )}
    </div>
  )
}

export { RhwpEditorHost }
