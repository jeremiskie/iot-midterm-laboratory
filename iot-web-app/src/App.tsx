import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  Circle,
  Cloud,
  LoaderCircle,
  RefreshCw,
  Search,
  Thermometer,
  Waves,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TelemetryRecord = {
  id?: number | string
  device_id?: string
  deviceId?: string
  temperature: number
  humidity: number
  motion: boolean
  created_at?: string
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")

async function fetchTelemetry() {
  const response = await fetch(`${apiBaseUrl}/api/telemetry`)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: unknown
    } | null
    const detail = typeof body?.detail === "string" ? `: ${body.detail}` : ""
    throw new Error(`Request failed (${response.status})${detail}`)
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data)) {
    throw new Error("The telemetry endpoint did not return a list.")
  }
  return data as TelemetryRecord[]
}

function getErrorMessage(loadError: unknown) {
  if (loadError instanceof TypeError) {
    return "Could not reach the API. Check that FastAPI is running; direct API URLs also need CORS access."
  }
  return loadError instanceof Error
    ? loadError.message
    : "Unable to load telemetry."
}

function formatTimestamp(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function App() {
  const [records, setRecords] = useState<TelemetryRecord[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTelemetry = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)

    try {
      setRecords(await fetchTelemetry())
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchTelemetry()
      .then((data) => {
        if (!cancelled) setRecords(data)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(getErrorMessage(loadError))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return records

    return records.filter((record) =>
      (record.device_id ?? record.deviceId ?? "").toLowerCase().includes(query)
    )
  }, [records, search])

  const movingCount = records.filter((record) => record.motion).length
  const latestReading = records[0]?.created_at
  const apiStatus = isLoading
    ? "Connecting"
    : error
      ? "Unavailable"
      : "Connected"

  return (
    <main className="min-h-svh bg-[#f7f8fa] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a
            href="/"
            className="flex items-center gap-3"
            aria-label="Fieldnotes home"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Activity className="size-[18px]" strokeWidth={2.3} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Fieldnotes
            </span>
            <span className="hidden border-l border-slate-200 pl-3 text-sm text-slate-500 sm:block">
              Environmental monitoring
            </span>
          </a>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="relative flex size-2">
              {isLoading && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-slate-400 opacity-60" />
              )}
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  error
                    ? "bg-rose-500"
                    : isLoading
                      ? "bg-slate-400"
                      : "bg-emerald-500"
                }`}
              />
            </span>
            {apiStatus}
            <ChevronDown className="ml-1 size-3.5 text-slate-400" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
              <span>Workspace</span>
              <span className="text-slate-300">/</span>
              <span>Overview</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-[38px]">
              Sensor overview
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Monitor recent environmental readings from your connected devices.
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => void loadTelemetry(true)}
            disabled={isLoading || isRefreshing}
            className="w-fit rounded-xl border-slate-200 bg-white px-4 text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh data
          </Button>
        </section>

        <section
          aria-label="Telemetry summary"
          className="mb-8 grid gap-4 sm:grid-cols-3"
        >
          <SummaryCard
            label="Total readings"
            value={isLoading ? "—" : records.length.toString()}
            hint="Most recent records"
            icon={<Activity className="size-[18px]" />}
            iconClass="bg-indigo-50 text-indigo-600"
          />
          <SummaryCard
            label="Motion detected"
            value={isLoading ? "—" : movingCount.toString()}
            hint="In the latest readings"
            icon={<Circle className="size-[17px] fill-current" />}
            iconClass="bg-amber-50 text-amber-600"
          />
          <SummaryCard
            label="Latest update"
            value={isLoading ? "Loading" : formatTimestamp(latestReading)}
            hint="Most recent sensor activity"
            icon={<Cloud className="size-[18px]" />}
            iconClass="bg-sky-50 text-sky-600"
            compactValue
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Recent telemetry
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest readings from your devices
              </p>
            </div>
            <label className="relative block w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by device..."
                aria-label="Filter telemetry by device"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm transition outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-3 focus:ring-slate-100"
              />
            </label>
          </div>

          {error ? (
            <div
              role="alert"
              className="flex flex-col items-center px-6 py-14 text-center"
            >
              <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertCircle className="size-5" />
              </span>
              <h3 className="font-medium text-slate-900">
                Couldn&apos;t load telemetry
              </h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                {error}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Check that your API is available at{" "}
                {apiBaseUrl || "the configured Vite proxy"}.
              </p>
              <Button
                variant="outline"
                className="mt-5 rounded-xl"
                onClick={() => void loadTelemetry(true)}
              >
                <RefreshCw className="size-4" />
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div
              className="flex flex-col items-center px-6 py-16 text-center"
              role="status"
            >
              <LoaderCircle className="mb-3 size-6 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">
                Fetching your latest readings...
              </p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Search className="size-5" />
              </span>
              <h3 className="font-medium text-slate-900">
                {records.length === 0 ? "No readings yet" : "No devices found"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {records.length === 0
                  ? "Telemetry will appear here as your devices send data."
                  : "Try another device ID or clear your search."}
              </p>
              {search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 hover:bg-transparent">
                      <TableHead className="h-11 pl-6 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                        Device
                      </TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                        Temperature
                      </TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                        Humidity
                      </TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                        Motion
                      </TableHead>
                      <TableHead className="h-11 pr-6 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                        Recorded
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record, index) => {
                      const deviceId =
                        record.device_id ?? record.deviceId ?? "Unknown device"
                      return (
                        <TableRow
                          key={
                            record.id ??
                            `${deviceId}-${record.created_at ?? index}`
                          }
                          className="border-slate-100 transition-colors hover:bg-slate-50/70"
                        >
                          <TableCell className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                <Activity className="size-4" />
                              </span>
                              <div className="font-medium text-slate-800">
                                {deviceId}
                                <div className="mt-0.5 text-xs font-normal text-slate-400">
                                  Sensor device
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                              <Thermometer className="size-4 text-orange-500" />
                              {Number(record.temperature).toFixed(1)}°C
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                              <Waves className="size-4 text-sky-500" />
                              {Number(record.humidity).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                                record.motion
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {record.motion ? (
                                <Activity className="size-3.5" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                              {record.motion ? "Detected" : "Clear"}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 pr-6 text-sm text-slate-500">
                            {formatTimestamp(record.created_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span>
                  Showing {filteredRecords.length} of {records.length} readings
                </span>
                <span>Up to 100 most recent records</span>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  iconClass,
  compactValue = false,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
  iconClass: string
  compactValue?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p
            className={`mt-3 font-semibold tracking-tight text-slate-900 ${
              compactValue ? "text-lg" : "text-[32px]"
            }`}
          >
            {value}
          </p>
        </div>
        <span
          className={`flex size-10 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

export default App
