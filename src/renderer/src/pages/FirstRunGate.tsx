import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import type { Teacher } from '../../../shared/domain'
import { Alert, Button, Card, Input } from '../components/ui'

export interface FirstRunGateProps {
  onCreated: (teacher: Teacher) => void
}

// Shown once, on a fresh DB with no `teacher` row yet (this app is a single
// local profile, not a login system — see CLAUDE.md's "User flow" §1).
function FirstRunGate({ onCreated }: FirstRunGateProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const trimmedName = name.trim()
  const isValid = trimmedName.length > 0

  async function handleSubmit(): Promise<void> {
    if (!isValid || submitting) return
    setSubmitting(true)
    setError(undefined)
    try {
      const teacher = await window.api.teacherCreate({ name: trimmedName })
      onCreated(teacher)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && isValid) {
      handleSubmit()
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-lilac-ash-950 p-6">
      <Card title="class-doc에 오신 것을 환영합니다" className="w-full max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-lilac-ash-300">
            선생님 성함을 입력해 주세요. 이 정보는 이 PC에만 저장되며 별도의 로그인은 필요하지
            않습니다.
          </p>
          <Input
            label="선생님 성함"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: 김민준"
            autoFocus
          />
          {error && <Alert type="error" message="프로필을 만들지 못했습니다." detail={error} />}
          <Button variant="primary" disabled={!isValid} loading={submitting} onClick={handleSubmit}>
            시작하기
          </Button>
        </div>
      </Card>
    </div>
  )
}

export { FirstRunGate }
