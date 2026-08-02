import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import { useCallback, useId, useRef, useState } from 'react'
import { cn } from './utils'
import { Spinner } from './Spinner'

export interface FileDropzoneProps {
  onFilesSelected: (files: FileList) => void
  accept?: string
  error?: string
  uploading?: boolean
  progress?: number
  label?: string
  hint?: string
  fileName?: string
  className?: string
}

function FileDropzone({
  onFilesSelected,
  accept,
  error,
  uploading = false,
  progress,
  label = 'Drag and drop a file here, or click to browse',
  hint,
  fileName,
  className
}: FileDropzoneProps): React.JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const hasError = Boolean(error)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files && files.length > 0) {
        onFilesSelected(files)
      }
    },
    [onFilesSelected]
  )

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    if (uploading) return
    setIsDragOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragOver(false)
    if (uploading) return
    handleFiles(event.dataTransfer.files)
  }

  function handleClick(): void {
    if (uploading) return
    inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    handleFiles(event.target.files)
    event.target.value = ''
  }

  const stateClasses = hasError
    ? 'border-almond-silk-500 bg-almond-silk-900 text-almond-silk-200'
    : isDragOver
      ? 'border-space-indigo-400 bg-space-indigo-900 text-space-indigo-200'
      : 'border-lilac-ash-600 bg-lilac-ash-900 text-lilac-ash-300'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={uploading || undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-space-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-lilac-ash-900',
        stateClasses,
        uploading && 'cursor-not-allowed',
        className
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
      {uploading ? (
        <>
          <Spinner size="md" />
          {fileName && <p className="text-sm">{fileName}</p>}
          {typeof progress === 'number' && (
            <div className="h-2 w-full max-w-xs rounded-full bg-lilac-ash-800">
              <div
                className="h-2 rounded-full bg-space-indigo-500 transition-all duration-150"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </>
      ) : hasError ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : (
        <p className="text-sm">{label}</p>
      )}
      {hint && !uploading && !hasError && <p className="text-xs text-lilac-ash-400">{hint}</p>}
    </div>
  )
}

export { FileDropzone }
