import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/App";
import { Search, Plus, Pencil, Trash2, RefreshCw, Wifi, WifiOff, Server, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function HotspotUserCard({ u, isViewer, userRole, onEdit, onDelete }) {
  const [showPwd, setShowPwd] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-sm p-3 hover:border-border/80 transition-all" data-testid={`hotspot-row-${u.name}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.is_online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
          <span className="font-mono text-sm font-semibold truncate">{u.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge className={`rounded-sm text-[10px] border ${u.disabled === "true" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"}`}>
            {u.disabled === "true" ? "off" : "on"}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Password row - always visible */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Password</span>
        <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
          {showPwd ? (u.password || "—") : (u.password ? "••••••••" : "—")}
        </span>
        {u.password && (
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setShowPwd(!showPwd)}>
            {showPwd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </Button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Profile</span>
            <Badge variant="outline" className="rounded-sm text-[10px]">{u.profile || "default"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Server</span>
            <span className="text-xs font-mono">{u.server || "all"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Online</span>
            {u.is_online
              ? <Badge className="rounded-sm text-[10px] border bg-green-500/10 text-green-500 border-green-500/20 gap-1"><Wifi className="w-3 h-3" />Online</Badge>
              : <span className="text-xs text-muted-foreground">Offline</span>}
          </div>
          {u.comment && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Comment</span>
              <span className="text-xs text-muted-foreground">{u.comment}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isViewer && (
        <div className="mt-2 pt-2 border-t border-border/50 flex gap-1 justify-end">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 rounded-sm" onClick={() => onEdit(u)} data-testid={`hotspot-edit-${u.name}`}>
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          {userRole === "administrator" && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 rounded-sm text-destructive" onClick={() => onDelete(u[".id"], u.name)} data-testid={`hotspot-delete-${u.name}`}>
              <Trash2 className="w-3 h-3" /> Hapus
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HotspotUsersPage() {
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showFormPwd, setShowFormPwd] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", profile: "default", server: "all", comment: "" });

  useEffect(() => {
    api.get("/devices").then(r => {
      setDevices(r.data);
      if (r.data.length === 1) setSelectedDevice(r.data[0].id);
    }).catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!selectedDevice) return;
    setLoading(true);
    setError("");
    try {
      const params = { device_id: selectedDevice };
      if (search) params.search = search;
      const r = await api.get("/hotspot-users", { params });
      setUsers(r.data);
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to connect to MikroTik";
      setError(msg);
      setUsers([]);
    }
    setLoading(false);
  }, [selectedDevice, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openAdd = () => {
    setEditing(null);
    setShowFormPwd(false);
    setForm({ name: "", password: "", profile: "default", server: "all", comment: "" });
    setDialogOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setShowFormPwd(false);
    setForm({ name: u.name || "", password: "", profile: u.profile || "default", server: u.server || "all", comment: u.comment || "", disabled: u.disabled || "false" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        const data = { ...form };
        if (!data.password) delete data.password;
        await api.put(`/hotspot-users/${editing[".id"]}?device_id=${selectedDevice}`, data);
        toast.success("Hotspot user updated on MikroTik");
      } else {
        await api.post(`/hotspot-users?device_id=${selectedDevice}`, form);
        toast.success("Hotspot user created on MikroTik");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Operation failed");
    }
  };

  const handleDelete = async (mtId, name) => {
    if (!window.confirm(`Delete hotspot user "${name}" from MikroTik?`)) return;
    try {
      await api.delete(`/hotspot-users/${mtId}?device_id=${selectedDevice}`);
      toast.success("Hotspot user deleted");
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Delete failed");
    }
  };

  const currentDev = devices.find(d => d.id === selectedDevice);
  const onlineCount = users.filter(u => u.is_online).length;

  return (
    <div className="space-y-4 pb-16" data-testid="hotspot-users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-['Rajdhani'] tracking-tight">Hotspot Users</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage hotspot users on MikroTik</p>
        </div>
        {!isViewer && selectedDevice && (
          <Button onClick={openAdd} size="sm" className="rounded-sm gap-2 w-full sm:w-auto" data-testid="add-hotspot-user-btn">
            <Plus className="w-4 h-4" /> Add User
          </Button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Select Device</label>
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-full sm:w-48 rounded-sm bg-card text-xs h-9" data-testid="hotspot-device-select">
              <SelectValue placeholder="Select device..." />
            </SelectTrigger>
            <SelectContent>
              {devices.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${d.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
                    {d.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedDevice && (
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-sm bg-card h-9 text-xs" data-testid="hotspot-search-input" />
            </div>
            <Button variant="outline" size="icon" onClick={fetchUsers} className="rounded-sm h-9 w-9 flex-shrink-0" data-testid="hotspot-refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {selectedDevice && !error && users.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
          <span>Total: <span className="text-foreground font-mono">{users.length}</span></span>
          <span className="text-green-500">Online: <span className="font-mono">{onlineCount}</span></span>
          <span className="text-muted-foreground/60">Offline: <span className="font-mono">{users.length - onlineCount}</span></span>
          {currentDev && <span className="ml-auto font-mono text-[10px]">{currentDev.name}</span>}
        </div>
      )}

      {/* Content */}
      {!selectedDevice ? (
        <div className="bg-card border border-border rounded-sm p-8 sm:p-12 text-center">
          <Server className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Select a MikroTik device to view hotspot users</p>
        </div>
      ) : error ? (
        <div className="bg-card border border-red-500/30 rounded-sm p-6 sm:p-8 text-center">
          <WifiOff className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 text-red-500/50" />
          <p className="text-red-400 text-xs sm:text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="bg-card border border-border rounded-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Connecting to MikroTik...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border rounded-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">No hotspot users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {users.map(u => (
            <HotspotUserCard
              key={u[".id"]}
              u={u}
              isViewer={isViewer}
              userRole={user?.role}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-sm bg-card border-border max-w-md" data-testid="hotspot-user-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Rajdhani'] text-xl">{editing ? "Edit Hotspot User" : "Add Hotspot User"}</DialogTitle>
            <DialogDescription>{editing ? "Update hotspot user on MikroTik." : "Create a new hotspot user on MikroTik."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Username</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-sm bg-background" data-testid="hotspot-form-username" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <div className="relative">
                  <Input
                    type={showFormPwd ? "text" : "password"}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="rounded-sm bg-background pr-9"
                    placeholder={editing ? "(unchanged)" : ""}
                    data-testid="hotspot-form-password"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowFormPwd(!showFormPwd)}>
                    {showFormPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Profile</Label>
                <Input value={form.profile} onChange={e => setForm({ ...form, profile: e.target.value })} className="rounded-sm bg-background" data-testid="hotspot-form-profile" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Server</Label>
                <Input value={form.server} onChange={e => setForm({ ...form, server: e.target.value })} className="rounded-sm bg-background" data-testid="hotspot-form-server" />
              </div>
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.disabled} onValueChange={v => setForm({ ...form, disabled: v })}>
                  <SelectTrigger className="rounded-sm bg-background" data-testid="hotspot-form-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Enabled</SelectItem>
                    <SelectItem value="true">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Comment</Label>
              <Input value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className="rounded-sm bg-background" data-testid="hotspot-form-comment" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-sm" data-testid="hotspot-form-cancel">Cancel</Button>
            <Button onClick={handleSave} className="rounded-sm" data-testid="hotspot-form-save">{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
