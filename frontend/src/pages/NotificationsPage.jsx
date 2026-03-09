import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Bell, Plus, Trash2, Send, Save, Phone, Settings2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function PhoneRow({ r, idx, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-sm bg-secondary/30 border border-border/50">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          value={r.name}
          onChange={e => onChange(idx, "name", e.target.value)}
          placeholder="Nama (opsional)"
          className="rounded-sm bg-background text-xs h-8"
        />
        <Input
          value={r.phone}
          onChange={e => onChange(idx, "phone", e.target.value)}
          placeholder="628xxxxxxxxxx"
          className="rounded-sm bg-background font-mono text-xs h-8"
        />
      </div>
      <button
        className={`w-8 h-8 rounded-sm flex items-center justify-center text-xs border transition-colors ${r.active ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : "bg-secondary text-muted-foreground border-border"}`}
        onClick={() => onChange(idx, "active", !r.active)}
        title={r.active ? "Nonaktifkan" : "Aktifkan"}
      >
        {r.active ? "✓" : "✗"}
      </button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(idx)}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

const DEFAULT_SETTINGS = {
  enabled: false,
  fonnte_token: "",
  recipients: [],
  notify_offline: true,
  notify_cpu: true,
  notify_memory: true,
  thresholds: { cpu: 80, memory: 80 },
};

export default function NotificationsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    api.get("/notifications/settings")
      .then(r => { setSettings({ ...DEFAULT_SETTINGS, ...r.data }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/notifications/settings", settings);
      toast.success("Pengaturan notifikasi disimpan");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal menyimpan");
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testPhone) { toast.error("Masukkan nomor HP tujuan test"); return; }
    setSendingTest(true);
    try {
      const r = await api.post("/notifications/test", {
        phone: testPhone,
        fonnte_token: settings.fonnte_token,
      });
      toast.success(r.data.message || "Test berhasil dikirim!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Test gagal. Periksa token dan nomor HP.");
    }
    setSendingTest(false);
  };

  const addRecipient = () => {
    setSettings(s => ({ ...s, recipients: [...s.recipients, { phone: "", name: "", active: true }] }));
  };

  const updateRecipient = (idx, field, val) => {
    const recs = [...settings.recipients];
    recs[idx] = { ...recs[idx], [field]: val };
    setSettings(s => ({ ...s, recipients: recs }));
  };

  const removeRecipient = (idx) => {
    setSettings(s => ({ ...s, recipients: s.recipients.filter((_, i) => i !== idx) }));
  };

  if (loading) return <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div>;

  return (
    <div className="space-y-5 pb-16" data-testid="notifications-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-['Rajdhani'] tracking-tight">Notifikasi</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Konfigurasi alert WhatsApp via Fonnte API</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-sm gap-2 w-full sm:w-auto">
          <Save className="w-4 h-4" /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-3 rounded-sm bg-blue-500/10 border border-blue-500/20 text-sm">
        <Info className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" />
        <div className="text-xs text-blue-300">
          <p className="font-semibold mb-1">Cara mendapatkan Fonnte API Token:</p>
          <ol className="list-decimal ml-4 space-y-0.5 text-blue-300/80">
            <li>Daftar di <span className="font-mono text-blue-300">fonnte.com</span></li>
            <li>Hubungkan nomor WhatsApp Anda ke Fonnte (scan QR)</li>
            <li>Salin API Token dari dashboard Fonnte</li>
            <li>Tempel token di field di bawah</li>
          </ol>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Aktifkan Notifikasi</p>
              <p className="text-xs text-muted-foreground">Kirim alert ke WhatsApp saat kondisi kritis</p>
            </div>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${settings.enabled ? "bg-green-500" : "bg-secondary"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.enabled ? "left-7" : "left-1"}`} />
          </button>
        </div>
      </div>

      {/* Fonnte Token */}
      <div className="bg-card border border-border rounded-sm p-4 space-y-4">
        <h2 className="text-base font-semibold font-['Rajdhani'] flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" /> Konfigurasi Fonnte API
        </h2>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Fonnte API Token</Label>
          <Input
            type="password"
            value={settings.fonnte_token}
            onChange={e => setSettings(s => ({ ...s, fonnte_token: e.target.value }))}
            className="rounded-sm bg-background font-mono text-xs"
            placeholder="Masukkan token dari dashboard Fonnte"
          />
          <p className="text-[10px] text-muted-foreground/70">Token bersifat rahasia. Jangan bagikan ke siapapun.</p>
        </div>

        {/* Test Message */}
        <div className="pt-2 border-t border-border/50 space-y-2">
          <Label className="text-xs text-muted-foreground">Test Kirim Pesan</Label>
          <div className="flex gap-2">
            <Input
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="628xxxxxxxxxx"
              className="rounded-sm bg-background font-mono text-xs flex-1"
            />
            <Button onClick={handleTest} disabled={sendingTest || !settings.fonnte_token} size="sm" variant="outline" className="rounded-sm gap-2 flex-shrink-0">
              <Send className="w-3.5 h-3.5" /> {sendingTest ? "..." : "Test"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/70">Format nomor: 628xxxxxxxxxx (tanpa tanda + dan spasi)</p>
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-card border border-border rounded-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold font-['Rajdhani'] flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" /> Nomor Penerima Alert
          </h2>
          <Button onClick={addRecipient} size="sm" variant="outline" className="rounded-sm gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" /> Tambah
          </Button>
        </div>
        {settings.recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Belum ada nomor penerima. Klik "Tambah" untuk menambahkan.</p>
        ) : (
          <div className="space-y-2">
            {settings.recipients.map((r, i) => (
              <PhoneRow key={i} r={r} idx={i} onChange={updateRecipient} onRemove={removeRecipient} />
            ))}
          </div>
        )}
      </div>

      {/* Alert Types & Thresholds */}
      <div className="bg-card border border-border rounded-sm p-4 space-y-4">
        <h2 className="text-base font-semibold font-['Rajdhani'] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" /> Jenis Alert & Threshold
        </h2>
        <div className="space-y-3">
          {[
            { key: "notify_offline", label: "Device Offline", desc: "Kirim alert saat router tidak dapat dijangkau", noThreshold: true },
            { key: "notify_cpu", label: "CPU Tinggi", desc: "Alert saat CPU melebihi threshold", threshKey: "cpu", unit: "%" },
            { key: "notify_memory", label: "Memori Tinggi", desc: "Alert saat memory melebihi threshold", threshKey: "memory", unit: "%" },
          ].map(item => (
            <div key={item.key} className="flex items-center gap-3 p-3 rounded-sm bg-secondary/20 border border-border/50">
              <button
                onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${settings[item.key] ? "bg-green-500" : "bg-secondary"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${settings[item.key] ? "left-5" : "left-0.5"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              {!item.noThreshold && item.threshKey && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Input
                    type="number"
                    value={settings.thresholds[item.threshKey]}
                    onChange={e => setSettings(s => ({
                      ...s,
                      thresholds: { ...s.thresholds, [item.threshKey]: parseInt(e.target.value) || 80 }
                    }))}
                    className="w-16 h-7 rounded-sm bg-background font-mono text-xs text-center"
                    min={1} max={100}
                  />
                  <span className="text-xs text-muted-foreground">{item.unit}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/70 pt-1 border-t border-border/50">
          ℹ️ Alert tidak akan dikirim ulang selama kondisi masih berlanjut. Sistem baru kirim ulang setelah kondisi kembali normal lalu muncul lagi.
        </p>
      </div>
    </div>
  );
}
