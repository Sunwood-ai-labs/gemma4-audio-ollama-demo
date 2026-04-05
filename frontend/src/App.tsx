import { Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

type SpeakerStyle = {
  speaker_uuid: string
  speaker_name: string
  style_name: string
  style_id: number
}

type Health = {
  voicevox: { ok: boolean; version?: string; error?: string }
  ollama: { ok: boolean; version?: string; error?: string }
  model_available: boolean
  checked_at: string
}

type ChainResponse = {
  request_id: string
  question_text: string
  answer_text: string
  model: string
  question_audio_data_url: string
  answer_audio_data_url: string
  timings: {
    question_synthesis_ms: number
    gemma_ms: number
    answer_synthesis_ms: number
    total_ms: number
  }
}

type Locale = "ja" | "en"

type StatusState =
  | { key: "ready" }
  | { key: "loading" }
  | { key: "reset" }
  | { key: "interrupted" }
  | { key: "complete"; ms: number }

const defaultQuestions: Record<Locale, string> = {
  ja: "あなたの好きな色は何ですか？",
  en: "What is your favorite color?",
}

const translations = {
  ja: {
    badge: "Voice Loop",
    offline: "offline",
    language: "言語",
    languageJa: "日本語",
    languageEn: "English",
    title: "シンプルな VOICEVOX + Gemma デモ",
    subtitle:
      "質問文を入力すると、VOICEVOX で音声化し、その WAV を Gemma に渡して、回答を VOICEVOX で読み上げます。",
    inputTitle: "入力",
    inputDescription: "テキストと音声を選んで、フル音声ループを実行します。",
    questionScript: "質問テキスト",
    questionPlaceholder: "VOICEVOX に読ませたい質問を入力してください。",
    questionVoice: "質問の声",
    answerVoice: "回答の声",
    selectSpeaker: "音声を選択",
    runLoop: "ループを実行",
    reset: "リセット",
    refreshHealth: "状態を更新",
    healthError: "バックエンドの状態を取得できません。",
    speakersError: "VOICEVOX の音声一覧を取得できません。",
    chainError: "音声ループの実行に失敗しました。",
    emptyQuestion: "質問テキストが空です。",
    resultTitle: "結果",
    resultDescription: "生成された音声と Gemma の回答をここに表示します。",
    model: "モデル",
    request: "リクエスト",
    pending: "待機中",
    gemmaAnswer: "Gemma の回答",
    answerPlaceholder: "ループ完了後にここへ回答が表示されます。",
    questionAudio: "質問音声",
    answerAudio: "回答音声",
    noQuestionAudio: "まだ質問音声はありません。",
    noAnswerAudio: "まだ回答音声はありません。",
    pipelineTitle: "パイプライン",
    pipelineDescription: "このアプリの 3 ステップの概要です。",
    step1Title: "1. 質問音声",
    step1Text:
      "VOICEVOX が入力テキストを選択した質問用ボイスで読み上げます。",
    step2Title: "2. Gemma の回答",
    step2Text:
      "Gemma がその WAV を聞いて、短い回答をひとつ返します。",
    step3Title: "3. 回答音声",
    step3Text:
      "VOICEVOX が Gemma の回答を選択した回答ボイスで読み上げます。",
    timingTitle: "処理時間",
    timingDescription: "直近の実行にかかった時間の概要です。",
    timingQuestion: "質問",
    timingGemma: "Gemma",
    timingAnswer: "回答",
    timingTotal: "合計",
    statusReady: "ループを実行できます。",
    statusLoading:
      "VOICEVOX で質問音声を作り、Gemma が回答を生成しています。",
    statusReset: "現在の言語のデフォルト質問に戻しました。",
    statusInterrupted:
      "ループが中断しました。ローカルサービスを確認して再試行してください。",
    statusComplete: (ms: number) => `ループが完了しました (${ms} ms)。`,
  },
  en: {
    badge: "Voice Loop",
    offline: "offline",
    language: "Language",
    languageJa: "Japanese",
    languageEn: "English",
    title: "Simple VOICEVOX + Gemma demo",
    subtitle:
      "Enter a question, synthesize it with VOICEVOX, send that WAV to Gemma, then play back Gemma's answer with VOICEVOX.",
    inputTitle: "Input",
    inputDescription: "Choose the text and voices, then run the full audio loop.",
    questionScript: "Question Script",
    questionPlaceholder: "Type the question you want VOICEVOX to speak.",
    questionVoice: "Question Voice",
    answerVoice: "Answer Voice",
    selectSpeaker: "Select speaker",
    runLoop: "Run The Loop",
    reset: "Reset",
    refreshHealth: "Refresh Health",
    healthError: "Could not check backend health.",
    speakersError: "Could not load VOICEVOX speakers.",
    chainError: "Failed to run the voice loop.",
    emptyQuestion: "Question text is empty.",
    resultTitle: "Result",
    resultDescription: "The generated audios and the Gemma response appear here.",
    model: "Model",
    request: "Request",
    pending: "pending",
    gemmaAnswer: "Gemma answer",
    answerPlaceholder: "The answer will land here once the loop completes.",
    questionAudio: "Question audio",
    answerAudio: "Answer audio",
    noQuestionAudio: "No question audio yet.",
    noAnswerAudio: "No answer audio yet.",
    pipelineTitle: "Pipeline",
    pipelineDescription: "A quick summary of the three steps in this app.",
    step1Title: "1. Question audio",
    step1Text:
      "VOICEVOX reads the input text with the selected question speaker.",
    step2Title: "2. Gemma answer",
    step2Text: "Gemma listens to that WAV and returns one short answer.",
    step3Title: "3. Answer audio",
    step3Text:
      "VOICEVOX reads Gemma's answer aloud with the selected answer speaker.",
    timingTitle: "Timing",
    timingDescription: "Basic timing information for the last completed run.",
    timingQuestion: "Question",
    timingGemma: "Gemma",
    timingAnswer: "Answer",
    timingTotal: "Total",
    statusReady: "Ready to start the loop.",
    statusLoading:
      "VOICEVOX is shaping the question, then Gemma will answer it.",
    statusReset: "Reset to the default voice prompt for this language.",
    statusInterrupted: "Loop interrupted. Check local services and try again.",
    statusComplete: (ms: number) => `Loop complete in ${ms} ms.`,
  },
} as const

function getStatusText(
  locale: Locale,
  status: StatusState
): string {
  const t = translations[locale]

  switch (status.key) {
    case "ready":
      return t.statusReady
    case "loading":
      return t.statusLoading
    case "reset":
      return t.statusReset
    case "interrupted":
      return t.statusInterrupted
    case "complete":
      return t.statusComplete(status.ms)
    default:
      return t.statusReady
  }
}

function App() {
  const [locale, setLocale] = useState<Locale>("ja")
  const [questionText, setQuestionText] = useState(defaultQuestions.ja)
  const [questionSpeaker, setQuestionSpeaker] = useState("2")
  const [answerSpeaker, setAnswerSpeaker] = useState("2")
  const [speakers, setSpeakers] = useState<SpeakerStyle[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [result, setResult] = useState<ChainResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<StatusState>({ key: "ready" })
  const t = translations[locale]

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/health")
      if (!response.ok) {
        throw new Error("Failed to fetch backend health.")
      }
      const payload = (await response.json()) as Health
      setHealth(payload)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.healthError
      )
    }
  }, [t.healthError])

  const loadSpeakers = useCallback(async () => {
    try {
      const response = await fetch("/api/speakers")
      if (!response.ok) {
        throw new Error("Failed to fetch VOICEVOX speakers.")
      }
      const payload = (await response.json()) as SpeakerStyle[]
      setSpeakers(payload)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.speakersError
      )
    }
  }, [t.speakersError])

  useEffect(() => {
    void Promise.all([loadHealth(), loadSpeakers()])
  }, [loadHealth, loadSpeakers])

  async function handleSubmit() {
    if (!questionText.trim()) {
      setErrorMessage(t.emptyQuestion)
      return
    }

    setErrorMessage(null)
    setIsLoading(true)
    setStatus({ key: "loading" })

    try {
      const response = await fetch("/api/chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: questionText.trim(),
          question_speaker: Number(questionSpeaker),
          answer_speaker: Number(answerSpeaker),
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { detail?: string }
        throw new Error(payload.detail ?? t.chainError)
      }

      const payload = (await response.json()) as ChainResponse
      setResult(payload)
      setStatus({ key: "complete", ms: payload.timings.total_ms })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.chainError
      )
      setStatus({ key: "interrupted" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{t.badge}</Badge>
              <Badge variant={health?.voicevox.ok ? "success" : "danger"}>
                VOICEVOX {health?.voicevox.version ?? t.offline}
              </Badge>
              <Badge
                variant={
                  health?.ollama.ok && health.model_available ? "success" : "danger"
                }
              >
                Gemma {health?.ollama.version ?? t.offline}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {t.language}
              </span>
              <Button
                size="sm"
                variant={locale === "ja" ? "default" : "outline"}
                onClick={() => setLocale("ja")}
                aria-pressed={locale === "ja"}
              >
                {t.languageJa}
              </Button>
              <Button
                size="sm"
                variant={locale === "en" ? "default" : "outline"}
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
              >
                {t.languageEn}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
            <p className="max-w-3xl text-sm text-[hsl(var(--muted-foreground))]">
              {t.subtitle}
            </p>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t.inputTitle}</CardTitle>
              <CardDescription>{t.inputDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="question-text">{t.questionScript}</Label>
                  <Textarea
                    id="question-text"
                    aria-label={t.questionScript}
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder={t.questionPlaceholder}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="question-speaker">{t.questionVoice}</Label>
                    <Select value={questionSpeaker} onValueChange={setQuestionSpeaker}>
                      <SelectTrigger
                        id="question-speaker"
                        aria-label={t.questionVoice}
                      >
                        <SelectValue placeholder={t.selectSpeaker} />
                      </SelectTrigger>
                      <SelectContent>
                        {speakers.map((speaker) => (
                          <SelectItem
                            key={`question-${speaker.style_id}`}
                            value={String(speaker.style_id)}
                          >
                            {speaker.speaker_name} / {speaker.style_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="answer-speaker">{t.answerVoice}</Label>
                    <Select value={answerSpeaker} onValueChange={setAnswerSpeaker}>
                      <SelectTrigger
                        id="answer-speaker"
                        aria-label={t.answerVoice}
                      >
                        <SelectValue placeholder={t.selectSpeaker} />
                      </SelectTrigger>
                      <SelectContent>
                        {speakers.map((speaker) => (
                          <SelectItem
                            key={`answer-${speaker.style_id}`}
                            value={String(speaker.style_id)}
                          >
                            {speaker.speaker_name} / {speaker.style_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles aria-hidden="true" />
                    )}
                    {t.runLoop}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuestionText(defaultQuestions[locale])
                      setResult(null)
                      setErrorMessage(null)
                      setStatus({ key: "reset" })
                    }}
                  >
                    <RefreshCw aria-hidden="true" />
                    {t.reset}
                  </Button>
                  <Button variant="ghost" onClick={() => void loadHealth()}>
                    <Wand2 aria-hidden="true" />
                    {t.refreshHealth}
                  </Button>
                </div>

                <div
                  aria-live="polite"
                  className="rounded-md border bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]"
                >
                  {getStatusText(locale, status)}
                </div>

                {errorMessage ? (
                  <div
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"
                    role="alert"
                  >
                    {errorMessage}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.resultTitle}</CardTitle>
                <CardDescription>{t.resultDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <Badge variant="muted">
                    {t.model} {result?.model ?? "gemma4:e2b"}
                  </Badge>
                  <Badge variant="muted">
                    {t.request} {result?.request_id ?? t.pending}
                  </Badge>
                </div>

                <div className="rounded-md border bg-[hsl(var(--background))] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
                    {t.gemmaAnswer}
                  </p>
                  <p className="mt-3 text-lg font-medium leading-8 text-[hsl(var(--foreground))]">
                    {result?.answer_text ?? t.answerPlaceholder}
                  </p>
                </div>

                <Separator />

                <AudioPanel
                  label={t.questionAudio}
                  ariaLabel={t.questionAudio}
                  src={result?.question_audio_data_url}
                  emptyText={t.noQuestionAudio}
                />
                <AudioPanel
                  label={t.answerAudio}
                  ariaLabel={t.answerAudio}
                  src={result?.answer_audio_data_url}
                  emptyText={t.noAnswerAudio}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.pipelineTitle}</CardTitle>
                <CardDescription>{t.pipelineDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <StepCard step={t.step1Title} text={t.step1Text} />
                <StepCard step={t.step2Title} text={t.step2Text} />
                <StepCard step={t.step3Title} text={t.step3Text} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.timingTitle}</CardTitle>
                <CardDescription>{t.timingDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <TimingTile
                  label={t.timingQuestion}
                  value={result?.timings.question_synthesis_ms}
                />
                <TimingTile
                  label={t.timingGemma}
                  value={result?.timings.gemma_ms}
                />
                <TimingTile
                  label={t.timingAnswer}
                  value={result?.timings.answer_synthesis_ms}
                />
                <TimingTile
                  label={t.timingTotal}
                  value={result?.timings.total_ms}
                />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}

function StepCard({ step, text }: { step: string; text: string }) {
  return (
    <div className="rounded-md border bg-[hsl(var(--background))] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {step}
      </p>
      <p className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]">
        {text}
      </p>
    </div>
  )
}

function AudioPanel({
  label,
  ariaLabel,
  src,
  emptyText,
}: {
  label: string
  ariaLabel: string
  src?: string
  emptyText: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      {src ? (
        <audio className="w-full" controls aria-label={ariaLabel} src={src} />
      ) : (
        <div className="rounded-md border border-dashed px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">
          {emptyText}
        </div>
      )}
    </div>
  )
}

function TimingTile({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md border bg-[hsl(var(--background))] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[hsl(var(--foreground))]">
        {typeof value === "number" ? `${value} ms` : "-"}
      </p>
    </div>
  )
}

export default App
