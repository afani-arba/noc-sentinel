import { useState, useRef } from "react";
import api from "@/lib/api";
import { BarChart3, Download, RefreshCw, Building2, User, Calendar, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Helpers ────────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  online: { bg: "#dcfce7", text: "#15803d", label: "ONLINE" },
  offline: { bg: "#fee2e2", text: "#dc2626", label: "OFFLINE" },
  warning: { bg: "#fef9c3", text: "#854d0e", label: "WARNING" },
  unknown: { bg: "#f4f4f5", text: "#71717a", label: "UNKNOWN" },
};
function tgl(iso) {
  try { return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return iso; }
}
function now_wib() {
  return new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB";
}

// ─── PDF Export ─────────────────────────────────────────────────────────────
function exportPDF(report, companyName) {
  if (!report) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
  const BLUE = [30, 58, 138];
  const DARK = [15, 23, 42];
  const GRAY = [100, 116, 139];

  function sectionHeader(y, title) {
    doc.setFillColor(...BLUE);
    doc.rect(14, y, W - 28, 7, "F");
    doc.setFontSize(9); doc.setFont(undefined, "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title, 17, y + 5);
    doc.setFont(undefined, "normal");
    return y + 9;
  }

  // ── HEADER ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 28, "F");

  // Logo box
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(W - 26, 5, 18, 18, 3, 3, "F");
  doc.setFontSize(11); doc.setFont(undefined, "bold"); doc.setTextColor(255, 255, 255);
  const initials = companyName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  doc.text(initials, W - 20, 17, { align: "center" });

  doc.setFontSize(16); doc.setFont(undefined, "bold"); doc.setTextColor(255, 255, 255);
  doc.text(companyName, 14, 11);
  doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.setTextColor(148, 163, 184);
  doc.text("Laporan Monitoring Harian – Managed Service Provider", 14, 17);
  doc.text("Daily Network Monitoring Report", 14, 22);

  // ── META ────────────────────────────────────────────────────────────────
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 31, W - 28, 14, "F");
  doc.setFontSize(8); doc.setTextColor(...GRAY);

  const meta = [
    ["Client Name:", report.client_name || "—", "Tanggal Laporan:", tgl(report.generated_at)],
    ["Engineer on Duty:", report.engineer_name || "—", "Periode Monitoring:", "00:00 – 23:59 WIB"],
  ];
  meta.forEach(([l1, v1, l2, v2], row) => {
    const y = 36 + row * 5;
    doc.setFont(undefined, "normal"); doc.setTextColor(...GRAY); doc.text(l1, 17, y);
    doc.setFont(undefined, "bold"); doc.setTextColor(...DARK); doc.text(v1, 45, y);
    doc.setFont(undefined, "normal"); doc.setTextColor(...GRAY); doc.text(l2, W / 2, y);
    doc.setFont(undefined, "bold"); doc.setTextColor(...DARK); doc.text(v2, W / 2 + 35, y);
  });

  // ── RINGKASAN EKSEKUTIF ─────────────────────────────────────────────────
  let y = 50;
  doc.setFontSize(9); doc.setFont(undefined, "bold"); doc.setTextColor(59, 130, 246);
  doc.text("RINGKASAN EKSEKUTIF", 14, y); y += 3;
  doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.3); doc.line(14, y, W - 14, y); y += 3;

  const s = report.summary;
  const online = s.devices.online; const total = s.devices.total;
  const health = online / total >= 0.9 ? "STABLE" : online / total >= 0.7 ? "WARNING" : "CRITICAL";
  const healthColor = health === "STABLE" ? [22, 163, 74] : health === "WARNING" ? [234, 179, 8] : [220, 38, 38];

  const cards = [
    { label: "NETWORK HEALTH STATUS", value: health, sub: "Overall Performance", color: healthColor },
    { label: "DEVICE AVAILABILITY", value: `${online} / ${total}`, sub: "Total Online Devices", color: [59, 130, 246] },
    { label: "AVERAGE BANDWIDTH", value: `${s.avg_bandwidth.download} Mbps`, sub: `Upload: ${s.avg_bandwidth.upload} Mbps`, color: [16, 185, 129] },
    { label: "PEAK TRAFFIC", value: `${s.peak_bandwidth.download} Mbps`, sub: `at peak hour`, color: [168, 85, 247] },
    { label: "AVG PING / JITTER", value: `${s.avg_ping} ms`, sub: `Jitter: ${s.avg_jitter} ms`, color: [6, 182, 212] },
    { label: "SLA COMPLIANCE", value: `${report.availability?.uptime_pct ?? 100}%`, sub: `Target: ${report.availability?.sla_target ?? 99.5}%`, color: [234, 88, 12] },
  ];

  const cardW = (W - 28 - 5 * 2) / 6;
  cards.forEach((c, i) => {
    const x = 14 + i * (cardW + 2);
    doc.setFillColor(248, 250, 252); doc.rect(x, y, cardW, 20, "F");
    doc.setDrawColor(...c.color); doc.setLineWidth(0.5); doc.rect(x, y, cardW, 20, "S");
    doc.setLineWidth(1.5); doc.line(x, y, x, y + 20);
    doc.setFontSize(6); doc.setFont(undefined, "normal"); doc.setTextColor(...GRAY);
    doc.text(c.label, x + 2, y + 4);
    doc.setFontSize(10); doc.setFont(undefined, "bold"); doc.setTextColor(...c.color);
    doc.text(c.value, x + 2, y + 11);
    doc.setFontSize(6); doc.setFont(undefined, "normal"); doc.setTextColor(...GRAY);
    doc.text(c.sub, x + 2, y + 17);
  });
  y += 24;

  // ── SECTION 1 ───────────────────────────────────────────────────────────
  y = sectionHeader(y, "SECTION 1: STATUS PERANGKAT (MIKROTIK DEVICES)");

  const devHead = [["No", "Device Name", "IP Address", "Lokasi", "Status", "Uptime", "CPU%", "RAM%", "BW In/Out (M)", "Action"]];
  const devBody = (report.device_summary || []).map((d, i) => {
    const sc = STATUS_COLOR[d.status] || STATUS_COLOR.unknown;
    return [
      i + 1, d.name, d.ip_address, d.location || "—",
      { content: sc.label, styles: { fillColor: sc.bg, textColor: sc.text, fontStyle: "bold" } },
      d.uptime || "—", `${d.cpu}%`, `${d.memory}%`,
      `${d.bw_in || 0}M / ${d.bw_out || 0}M`,
      { content: d.action || "OK", styles: { textColor: d.action === "URGENT" ? [220, 38, 38] : d.action === "Investigate" ? [234, 88, 12] : [22, 163, 74], fontStyle: "bold" } },
    ];
  });

  autoTable(doc, {
    startY: y, head: devHead, body: devBody,
    headStyles: { fillColor: BLUE, fontSize: 7, fontStyle: "bold" },
    styles: { fontSize: 6.5, cellPadding: 1 },
    columnStyles: { 0: { cellWidth: 6 }, 1: { cellWidth: 28 }, 2: { cellWidth: 22 }, 3: { cellWidth: 20 }, 4: { cellWidth: 15 }, 5: { cellWidth: 16 }, 6: { cellWidth: 10 }, 7: { cellWidth: 10 }, 8: { cellWidth: 24 }, 9: { cellWidth: 18 } },
    margin: { left: 14, right: 14 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // ── NEW PAGE ─────────────────────────────────────────────────────────────
  doc.addPage();
  y = 14;

  // ── SECTION 2 ───────────────────────────────────────────────────────────
  y = sectionHeader(y, "SECTION 2: ANALISIS PERFORMA");

  const cpu = s.cpu_categories || { normal: 0, warning: 0, critical: 0 };
  const mem = s.mem_categories || { normal: 0, warning: 0, critical: 0 };

  const perf = [
    ["A. CPU Usage Analysis", "B. Memory Usage Analysis", "C. Bandwidth Utilization"],
    [
      `Normal (0-60%): ${cpu.normal}\nWarning (61-80%): ${cpu.warning}\nCritical (>80%): ${cpu.critical} Device`,
      `Normal (0-70%): ${mem.normal}\nWarning (71-85%): ${mem.warning}\nCritical (>85%): ${mem.critical} Device`,
      `Avg Traffic: ${s.avg_bandwidth.download} Mbps\nPeak Traffic: ${s.peak_bandwidth.download} Mbps`,
    ],
  ];
  autoTable(doc, {
    startY: y, body: perf, styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 85 }, 1: { cellWidth: 85 }, 2: { cellWidth: 85 } },
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ── SECTION 3 ───────────────────────────────────────────────────────────
  y = sectionHeader(y, "SECTION 3: INCIDENT & ISSUE LOG");
  const incidents = report.incidents || [];
  if (incidents.length === 0) {
    doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text("Tidak ada incident tercatat pada periode ini.", 14, y + 5);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Time", "Device", "Severity", "Issue Description", "Action Taken", "Status", "PIC"]],
      body: incidents.map(inc => {
        const sev = inc.severity?.toUpperCase();
        const sevStyle = sev === "CRITICAL" ? { textColor: [220, 38, 38], fontStyle: "bold" } : sev === "WARNING" ? { textColor: [234, 88, 12] } : {};
        return [
          inc.time, inc.device,
          { content: sev, styles: sevStyle },
          inc.description, inc.action,
          { content: inc.status, styles: inc.status === "OPEN" ? { textColor: [220, 38, 38], fontStyle: "bold" } : { textColor: [22, 163, 74] } },
          inc.pic,
        ];
      }),
      headStyles: { fillColor: BLUE, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7, cellPadding: 1.5 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── SECTION 4 ───────────────────────────────────────────────────────────
  y = sectionHeader(y, "SECTION 4: NETWORK AVAILABILITY STATS");
  const av = report.availability || {};
  const avCards = [
    { label: "TOTAL DOWNTIME", value: `${av.total_downtime_mins || 0} Mins`, sub: "Accumulated today" },
    { label: "SLA COMPLIANCE", value: `${av.uptime_pct ?? 100}%`, sub: `Target: ${av.sla_target ?? 99.5}%` },
    { label: "100% UPTIME", value: `${av.full_uptime_devices || 0} / ${s.devices.total}`, sub: "Devices with 0 issues" },
  ];
  const avW = (W - 28 - 4) / 3;
  avCards.forEach((c, i) => {
    const x = 14 + i * (avW + 2);
    doc.setFillColor(59, 130, 246); doc.rect(x, y, avW, 18, "F");
    doc.setFontSize(7); doc.setFont(undefined, "bold"); doc.setTextColor(255, 255, 255);
    doc.text(c.label, x + 3, y + 5);
    doc.setFontSize(14); doc.text(c.value, x + 3, y + 13);
    doc.setFontSize(6); doc.setFont(undefined, "normal"); doc.setTextColor(186, 230, 253);
    doc.text(c.sub, x + 3, y + 17);
  });
  y += 22;

  // ── FOOTER ──────────────────────────────────────────────────────────────
  const pc = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(`${companyName} | Daily Network Monitoring Report | Halaman ${i}/${pc}`, W / 2, H - 6, { align: "center" });
    doc.text(`Digenerate: ${new Date().toLocaleString("id-ID")}`, 14, H - 6);
  }

  doc.save(`laporan-monitoring-${new Date().toISOString().slice(0, 10)}.pdf`);
  toast.success("PDF berhasil diexport!");
}

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.unknown;
  const isOnline = status === "online";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-bold`}
      style={{ backgroundColor: `${c.bg}`, color: c.text, border: `1px solid ${c.text}30` }}>
      {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {c.label}
    </span>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState("daily");
  const [clientName, setClientName] = useState("");
  const [engineerName, setEngineerName] = useState("");
  const [companyName, setCompanyName] = useState("PT ARSYA BAROKAH ABADI");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await api.post("/reports/generate", {
        period, client_name: clientName, engineer_name: engineerName, company_name: companyName
      });
      setReport(r.data);
      toast.success("Laporan berhasil dibuat");
    } catch { toast.error("Gagal membuat laporan"); }
    setLoading(false);
  };

  const devices = report?.device_summary || [];
  const s = report?.summary;
  const av = report?.availability;

  return (
    <div className="space-y-4 pb-16" data-testid="reports-page">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-['Rajdhani'] tracking-tight">Laporan Monitoring</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Generate dan export laporan harian jaringan</p>
      </div>

      {/* Config Panel */}
      <div className="bg-card border border-border rounded-sm p-4">
        <h3 className="text-sm font-semibold font-['Rajdhani'] mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Konfigurasi Laporan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Nama Perusahaan
            </label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="PT ARSYA BAROKAH ABADI"
              className="rounded-sm bg-background h-9 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3" /> Nama Client
            </label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="PT Air Lintas Barokah..."
              className="rounded-sm bg-background h-9 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3 h-3" /> Engineer on Duty
            </label>
            <Input value={engineerName} onChange={e => setEngineerName(e.target.value)} placeholder="Nama engineer..."
              className="rounded-sm bg-background h-9 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Periode
            </label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="rounded-sm bg-background h-9 text-xs" data-testid="report-period-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Harian (24 Jam)</SelectItem>
                <SelectItem value="weekly">Mingguan (7 Hari)</SelectItem>
                <SelectItem value="monthly">Bulanan (30 Hari)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={generate} disabled={loading} size="sm" className="rounded-sm gap-2" data-testid="generate-report-btn">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Memproses..." : "Generate Laporan"}
          </Button>
          {report && (
            <Button onClick={() => exportPDF(report, companyName)} variant="outline" size="sm" className="rounded-sm gap-2" data-testid="export-pdf-btn">
              <Download className="w-4 h-4" /> Export PDF
            </Button>
          )}
        </div>
      </div>

      {/* LAPORAN PREVIEW */}
      {report && (
        <div className="space-y-4 font-sans" id="report-preview">

          {/* ── HEADER LAPORAN ── */}
          <div className="bg-[#0f172a] text-white rounded-sm overflow-hidden">
            <div className="flex items-start justify-between p-5 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{report.company_name}</h2>
                <p className="text-sm text-slate-400 mt-0.5">Laporan Monitoring Harian – Managed Service Provider</p>
                <p className="text-xs text-slate-500">Daily Network Monitoring Report</p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-blue-600 flex items-center justify-center text-xl font-black text-white flex-shrink-0">
                {report.company_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
            </div>
            {/* Meta bar */}
            <div className="bg-slate-800/50 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-xs border-t border-slate-700">
              <div><span className="text-slate-400">Client Name: </span><span className="font-semibold text-white">{report.client_name || "—"}</span></div>
              <div><span className="text-slate-400">Tanggal Laporan: </span><span className="font-semibold text-white">{tgl(report.generated_at)}</span></div>
              <div><span className="text-slate-400">Engineer on Duty: </span><span className="font-semibold text-white">{report.engineer_name || "—"}</span></div>
              <div><span className="text-slate-400">Periode Monitoring: </span><span className="font-semibold text-white">00:00 – 23:59 WIB</span></div>
            </div>
          </div>

          {/* ── RINGKASAN EKSEKUTIF ── */}
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="bg-blue-900 px-4 py-2">
              <h3 className="text-white text-sm font-bold tracking-wider uppercase">Ringkasan Eksekutif</h3>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Network Health Status", value: s.devices.online / s.devices.total >= 0.9 ? "STABLE" : "WARNING", color: s.devices.online / s.devices.total >= 0.9 ? "text-green-500" : "text-yellow-500", sub: "Overall Performance" },
                { label: "Device Availability", value: `${s.devices.online} / ${s.devices.total}`, color: "text-blue-500", sub: "Total Online Devices" },
                { label: "Average Bandwidth", value: `${s.avg_bandwidth.download} Mbps`, color: "text-green-500", sub: `Upload: ${s.avg_bandwidth.upload} Mbps` },
                { label: "Peak Traffic", value: `${s.peak_bandwidth.download} Mbps`, color: "text-purple-500", sub: "Recorded today" },
                { label: "Avg Ping / Jitter", value: `${s.avg_ping} ms`, color: "text-cyan-500", sub: `Jitter: ${s.avg_jitter} ms` },
                { label: "SLA Compliance", value: `${av?.uptime_pct ?? 100}%`, color: "text-orange-500", sub: `Target: ${av?.sla_target ?? 99.5}%` },
              ].map(c => (
                <div key={c.label} className="border border-border rounded-sm p-3 bg-background/50">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
                  <p className={`text-lg font-black font-['Rajdhani'] ${c.color}`}>{c.value}</p>
                  <p className="text-[10px] text-muted-foreground">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 1: STATUS PERANGKAT ── */}
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="bg-blue-900 px-4 py-2">
              <h3 className="text-white text-sm font-bold tracking-wider uppercase">Section 1: Status Perangkat (MikroTik Devices)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-950/40 text-blue-300 uppercase text-[10px] tracking-wider">
                    {["No", "Device Name", "IP Address", "Lokasi", "Status", "Uptime", "CPU", "RAM", "Bandwidth (In/Out)", "Action"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d, i) => (
                    <tr key={d.name} className={`border-t border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{d.name}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{d.ip_address}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.location || "—"}</td>
                      <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                      <td className="px-3 py-2 font-mono">{d.uptime || "—"}</td>
                      <td className={`px-3 py-2 font-mono font-bold ${d.cpu > 80 ? "text-red-500" : d.cpu > 60 ? "text-yellow-500" : "text-green-500"}`}>
                        {d.cpu}%
                      </td>
                      <td className={`px-3 py-2 font-mono font-bold ${d.memory > 85 ? "text-red-500" : d.memory > 70 ? "text-yellow-500" : "text-foreground"}`}>
                        {d.memory}%
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {d.bw_in || 0}M / {d.bw_out || 0}M
                      </td>
                      <td className={`px-3 py-2 font-bold ${d.action === "URGENT" ? "text-red-500" : d.action === "Investigate" ? "text-orange-500" : "text-green-500"}`}>
                        {d.action || "OK"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 2: ANALISIS PERFORMA ── */}
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="bg-blue-900 px-4 py-2">
              <h3 className="text-white text-sm font-bold tracking-wider uppercase">Section 2: Analisis Performa</h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* CPU */}
              <div>
                <h4 className="text-xs font-bold mb-2 text-primary">A. CPU Usage Analysis</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Normal (0-60%)</span><span className="text-green-500 font-mono font-bold">{s.cpu_categories?.normal ?? 0} Devices</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Warning (61-80%)</span><span className="text-yellow-500 font-mono font-bold">{s.cpu_categories?.warning ?? 0} Device</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Critical (&gt;80%)</span><span className="text-red-500 font-mono font-bold">{s.cpu_categories?.critical ?? 0} Device</span></div>
                </div>
              </div>
              {/* Memory */}
              <div>
                <h4 className="text-xs font-bold mb-2 text-primary">B. Memory Usage Analysis</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Normal (0-70%)</span><span className="text-green-500 font-mono font-bold">{s.mem_categories?.normal ?? 0} Devices</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Warning (71-85%)</span><span className="text-yellow-500 font-mono font-bold">{s.mem_categories?.warning ?? 0} Device</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Critical (&gt;85%)</span><span className="text-red-500 font-mono font-bold">{s.mem_categories?.critical ?? 0} Device</span></div>
                </div>
              </div>
              {/* Bandwidth */}
              <div>
                <h4 className="text-xs font-bold mb-2 text-primary">C. Bandwidth Utilization</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg Traffic</span><span className="font-mono font-bold">{s.avg_bandwidth.download} Mbps</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Peak Traffic</span><span className="font-mono font-bold">{s.peak_bandwidth.download} Gbps</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg Ping</span><span className="font-mono font-bold">{s.avg_ping} ms</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: INCIDENT & ISSUE LOG ── */}
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="bg-blue-900 px-4 py-2">
              <h3 className="text-white text-sm font-bold tracking-wider uppercase">Section 3: Incident &amp; Issue Log</h3>
            </div>
            {(!report.incidents || report.incidents.length === 0) ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">✅ Tidak ada incident tercatat pada periode ini</p>
                <p className="text-xs text-muted-foreground mt-1">Incident berasal dari Syslog messages yang diterima server</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-blue-950/40 text-blue-300 uppercase text-[10px] tracking-wider">
                      {["Time", "Device", "Severity", "Issue Description", "Action Taken", "Status", "PIC"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.incidents.map((inc, i) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{inc.time}</td>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">{inc.device}</td>
                        <td className="px-3 py-2">
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded-[3px] ${inc.severity === "CRITICAL" ? "bg-red-500/10 text-red-500" : inc.severity === "WARNING" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-blue-500/10 text-blue-500"}`}>
                            {inc.severity?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground">{inc.description}</td>
                        <td className="px-3 py-2 text-muted-foreground">{inc.action}</td>
                        <td className="px-3 py-2">
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded-[3px] border ${inc.status === "OPEN" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"}`}>
                            {inc.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{inc.pic}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 4: NETWORK AVAILABILITY STATS ── */}
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="bg-blue-900 px-4 py-2">
              <h3 className="text-white text-sm font-bold tracking-wider uppercase">Section 4: Network Availability Stats</h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "TOTAL DOWNTIME", value: `${av?.total_downtime_mins ?? 0} Mins`, sub: "Accumulated today" },
                { label: "SLA COMPLIANCE", value: `${av?.uptime_pct ?? 100}%`, sub: `Target: ${av?.sla_target ?? 99.5}%` },
                { label: "100% UPTIME", value: `${av?.full_uptime_devices ?? 0} / ${s.devices.total}`, sub: "Devices with 0 issues" },
              ].map(c => (
                <div key={c.label} className="bg-blue-600 rounded-sm p-4 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-1">{c.label}</p>
                  <p className="text-3xl font-black font-['Rajdhani']">{c.value}</p>
                  <p className="text-xs text-blue-200 mt-1">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
