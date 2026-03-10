import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/App";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Cpu, RefreshCw, Search, RotateCcw, AlertTriangle, CheckCircle2,
  Wifi, WifiOff, Zap, Settings2, Trash2, TriangleAlert, Save,
  Eye, EyeOff, LinkIcon, ServerIcon, AlertCircle
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
  if (!isoStr) return "—";
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}d lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
  return `${Math.floor(diff / 86400)}h lalu`;
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats, loading }) {
  const items = [
    { label: "Total CPE", value: stats?.total ?? "—", color: "text-foreground" },
    { label: "Online", value: stats?.online ?? "—", color: "text-green-400" },
    { label: "Offline", value: stats?.offline ?? "—", color: "text-red-400" },
    { label: "Faults", value: stats?.faults ?? "—", color: "text-yellow-400" },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((s) => (
        <div key={s.label} className="bg-secondary/30 border border-border rounded-sm px-4 py-2 flex flex-col items-center min-w-[80px]">
          <span className={`text-xl font-bold font-mono ${s.color} ${loading ? "animate-pulse" : ""}`}>{s.value}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Device Row ────────────────────────────────────────────────────────────────

function DeviceRow({ device, isAdmin }) {
  const [acting, setActing] = useState(null);

  const doAction = async (action, label) => {
    setActing(action);
    try {
      await api.post(`/genieacs/devices/${encodeURIComponent(device.id)}/${action}`);
      toast.success(`${label} dikirim ke ${device.model || device.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || `${label} gagal`);
    }
    setActing(null);
  };

  return (
    <tr className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${device.online ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <div>
            <p className="text-xs font-mono text-foreground truncate max-w-[200px]" title={device.id}>{device.id}</p>
            <p className="text-[10px] text-muted-foreground">{device.serial || "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs">
        <p className="text-foreground font-medium">{device.manufacturer || "—"}</p>
        <p className="text-muted-foreground">{device.model || "—"}</p>
      </td>
      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{device.ip || "—"}</td>
      <td className="px-3 py-2.5 text-[10px] text-muted-foreground font-mono">{device.firmware || "—"}</td>
      <td className="px-3 py-2.5 text-[10px] text-muted-foreground">{timeAgo(device.last_inform)}</td>
      <td className="px-3 py-2.5">
        <Badge variant="outline" className={`text-[10px] rounded-sm ${device.online ? "border-green-500/40 text-green-400" : "border-red-500/40 text-red-400"}`}>
          {device.online ? <><Wifi className="w-2.5 h-2.5 mr-1" />Online</> : <><WifiOff className="w-2.5 h-2.5 mr-1" />Offline</>}
        </Badge>
      </td>
      {isAdmin && (
        <td className="px-3 py-2.5">
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Reboot"
              disabled={acting !== null} onClick={() => doAction("reboot", "Reboot")}>
              <RotateCcw className={`w-3 h-3 ${acting === "reboot" ? "animate-spin" : ""}`} />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Refresh Parameter"
              disabled={acting !== null} onClick={() => doAction("refresh", "Refresh")}>
              <RefreshCw className={`w-3 h-3 ${acting === "refresh" ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ── Faults Tab ────────────────────────────────────────────────────────────────

function FaultsTab() {
  const [faults, setFaults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "administrator";

  useEffect(() => {
    setLoading(true);
    api.get("/genieacs/faults")
      .then(r => setFaults(r.data))
      .catch(() => toast.error("Gagal memuat faults"))
      .finally(() => setLoading(false));
  }, []);

  const deleteFault = async (id) => {
    try {
      await api.delete(`/genieacs/faults/${encodeURIComponent(id)}`);
      setFaults(f => f.filter(x => x._id !== id));
      toast.success("Fault dihapus");
    } catch { toast.error("Gagal hapus fault"); }
  };

  return (
    <div>
      {loading && <p className="text-muted-foreground text-sm py-4 text-center animate-pulse">Memuat faults...</p>}
      {!loading && faults.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Tidak ada fault aktif 🎉</p>
        </div>
      )}
      {faults.length > 0 && (
        <div className="space-y-2">
          {faults.map(f => (
            <div key={f._id} className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
              <TriangleAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground truncate">{f.device || f._id}</p>
                <p className="text-[10px] text-red-400 mt-0.5">{f.code || ""} — {f.message || JSON.stringify(f).slice(0, 80)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(f.timestamp)}</p>
              </div>
              {isAdmin && (
                <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => deleteFault(f._id)}>
                  <Trash2 className="w-3 h-3 text-red-400" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Server Config Tab ─────────────────────────────────────────────────────────

function ServerConfigTab() {
  const [cfg, setCfg] = useState({ url: "", username: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get("/system/genieacs-config")
      .then(r => setCfg(c => ({ ...c, url: r.data.url || "", username: r.data.username || "" })))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!cfg.url) { toast.error("URL GenieACS wajib diisi"); return; }
    setSaving(true);
    try {
      const r = await api.post("/system/save-genieacs-config", cfg);
      toast.success(r.data.message || "Konfigurasi disimpan");
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!cfg.url) { toast.error("Isi URL GenieACS dahulu"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      // Simpan dulu agar test pakai config terbaru
      await api.post("/system/save-genieacs-config", cfg);
      const r = await api.get("/genieacs/test-connection");
      setTestResult(r.data);
      if (r.data.success) toast.success(r.data.message);
      else toast.error(r.data.error || "Koneksi ke GenieACS gagal");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Test koneksi gagal");
    }
    setTesting(false);
  };

  return (
    <div className="space-y-5 max-w-xl">
      {/* Header info */}
      <div className="flex items-start gap-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-sm">
        <ServerIcon className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-cyan-300">
          <p className="font-semibold mb-0.5">Konfigurasi GenieACS NBI Server</p>
          <p className="text-cyan-300/70">Isi URL, username, dan password server GenieACS lalu klik <strong>Test Koneksi</strong> untuk memverifikasi, kemudian <strong>Simpan</strong>.</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            GenieACS URL (NBI) <span className="text-destructive">*</span>
          </Label>
          <Input
            value={cfg.url}
            onChange={e => setCfg(c => ({ ...c, url: e.target.value }))}
            placeholder="http://10.x.x.x:7557"
            className="rounded-sm font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">Port NBI default GenieACS adalah <code className="bg-secondary px-1 rounded">7557</code></p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Username</Label>
            <Input
              value={cfg.username}
              onChange={e => setCfg(c => ({ ...c, username: e.target.value }))}
              placeholder="admin"
              className="rounded-sm text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Password</Label>
            <div className="relative">
              <Input
                value={cfg.password}
                onChange={e => setCfg(c => ({ ...c, password: e.target.value }))}
                type={showPwd ? "text" : "password"}
                placeholder={cfg.url ? "(biarkan kosong jika tidak berubah)" : ""}
                className="rounded-sm text-xs pr-9"
              />
              <button type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd(v => !v)}>
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-start gap-2 p-3 rounded-sm border text-xs ${
          testResult.success
            ? "bg-green-500/10 border-green-500/20 text-green-300"
            : "bg-red-500/10 border-red-500/20 text-red-300"
        }`}>
          {testResult.success
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <div>
            <p className="font-semibold">{testResult.success ? "Berhasil terhubung!" : "Koneksi gagal"}</p>
            <p className="mt-0.5 opacity-80">{testResult.success ? testResult.message : testResult.error}</p>
            {testResult.success && testResult.stats && (
              <div className="flex gap-4 mt-2 font-mono text-[11px]">
                <span>Total: <strong>{testResult.stats.total}</strong></span>
                <span className="text-green-400">Online: <strong>{testResult.stats.online}</strong></span>
                <span className="text-red-400">Offline: <strong>{testResult.stats.offline}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleTest} variant="outline" disabled={testing || saving} className="rounded-sm gap-2 h-9 text-xs">
          <Zap className="w-3.5 h-3.5" />{testing ? "Testing..." : "Test Koneksi"}
        </Button>
        <Button onClick={handleSave} disabled={saving || testing} className="rounded-sm gap-2 h-9 text-xs">
          <Save className="w-3.5 h-3.5" />{saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      {/* Guide */}
      <details className="text-xs border border-border rounded-sm">
        <summary className="cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground transition-colors select-none">
          Cara setup GenieACS NBI ▸
        </summary>
        <div className="px-3 pb-3 space-y-2 font-mono text-[11px] border-t border-border mt-0 pt-3">
          <p className="font-sans text-muted-foreground font-semibold">1. Cek status genieacs-nbi di server GenieACS:</p>
          <p className="text-green-400 bg-secondary/30 px-2 py-1 rounded">systemctl status genieacs-nbi</p>
          <p className="font-sans text-muted-foreground font-semibold">2. Test akses dari server NOC ke GenieACS:</p>
          <p className="text-green-400 bg-secondary/30 px-2 py-1 rounded">curl http://10.x.x.x:7557/devices?limit=1</p>
          <p className="font-sans text-[10px] text-muted-foreground">Jika mendapat response JSON → isi form di atas → Test Koneksi</p>
        </div>
      </details>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GenieACSPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "administrator";

  const [tab, setTab] = useState("devices");
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [connectionOk, setConnectionOk] = useState(null); // null=unknown, true, false

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, statsRes] = await Promise.all([
        api.get("/genieacs/devices", { params: { limit: 300, search } }),
        api.get("/genieacs/stats"),
      ]);
      setDevices(devRes.data);
      setStats(statsRes.data);
      setConnectionOk(true);
    } catch (e) {
      const msg = e.response?.data?.detail || "Gagal terhubung ke GenieACS";
      if (connectionOk !== false) toast.error(msg);
      setConnectionOk(false);
    }
    setLoading(false);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const tabs = [
    { id: "devices", label: "CPE Devices", icon: Cpu },
    { id: "faults", label: "Faults", icon: AlertTriangle },
    ...(isAdmin ? [{ id: "config", label: "Konfigurasi Server", icon: Settings2 }] : []),
  ];

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-['Rajdhani'] tracking-tight flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" /> GenieACS / TR-069
          </h1>
          <p className="text-xs text-muted-foreground">Manajemen CPE (modem/router pelanggan) via protocol TR-069</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {/* Connection status badge */}
          {connectionOk !== null && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-medium border ${
              connectionOk
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {connectionOk ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connectionOk ? "Terhubung" : "Tidak terhubung"}
            </div>
          )}
          <Button variant="outline" size="sm" className="rounded-sm gap-2" onClick={fetchDevices} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {isAdmin && (
            <Button variant={tab === "config" ? "default" : "outline"} size="sm"
              className="rounded-sm gap-2"
              onClick={() => setTab("config")}>
              <Settings2 className="w-4 h-4" /> Konfigurasi
            </Button>
          )}
        </div>
      </div>

      {/* Stats (hidden when in config tab) */}
      {tab !== "config" && <StatsBar stats={stats} loading={loading} />}

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.id === "faults" && stats?.faults > 0 && (
              <span className="ml-1 bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full font-mono">{stats.faults}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-card border border-border rounded-sm p-4">

        {/* Devices Tab */}
        {tab === "devices" && (
          <>
            {/* Not connected banner */}
            {connectionOk === false && (
              <div className="flex items-center gap-3 p-3 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-sm">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-yellow-300 font-semibold">GenieACS belum terkonfigurasi</p>
                  <p className="text-[11px] text-yellow-300/70">
                    {isAdmin
                      ? <>Klik tab <strong>Konfigurasi Server</strong> untuk menambahkan URL &amp; kredensial GenieACS.</>
                      : "Hubungi administrator untuk mengatur koneksi GenieACS."}
                  </p>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="rounded-sm h-7 text-xs gap-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => setTab("config")}>
                    <Settings2 className="w-3 h-3" /> Setup
                  </Button>
                )}
              </div>
            )}

            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="Cari ID, model, IP, serial..." className="pl-8 h-8 rounded-sm text-xs" />
              </div>
              <Button type="submit" size="sm" className="rounded-sm h-8 text-xs">Cari</Button>
              {search && (
                <Button type="button" size="sm" variant="outline" className="rounded-sm h-8 text-xs"
                  onClick={() => { setSearch(""); setSearchInput(""); }}>Reset</Button>
              )}
            </form>

            {/* Table */}
            {loading ? (
              <p className="text-muted-foreground text-sm text-center py-8 animate-pulse">Memuat perangkat...</p>
            ) : devices.length === 0 ? (
              <div className="text-center py-12">
                <Cpu className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Tidak ada perangkat ditemukan</p>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="rounded-sm mt-3 text-xs gap-1"
                    onClick={() => setTab("config")}>
                    <Settings2 className="w-3 h-3" /> Setup GenieACS Server
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Device ID / Serial", "Produsen / Model", "IP Address", "Firmware", "Terakhir Aktif", "Status", isAdmin ? "Aksi" : ""].map(h => (
                        <th key={h} className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map(d => (
                      <DeviceRow key={d.id} device={d} isAdmin={isAdmin} />
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-muted-foreground mt-3 text-right font-mono">
                  Menampilkan {devices.length} perangkat
                </p>
              </div>
            )}
          </>
        )}

        {tab === "faults" && <FaultsTab />}

        {tab === "config" && isAdmin && <ServerConfigTab />}

        {tab === "config" && !isAdmin && (
          <p className="text-muted-foreground text-sm text-center py-8">Hanya administrator yang dapat mengubah konfigurasi.</p>
        )}
      </div>
    </div>
  );
}
