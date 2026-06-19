import { useState, useMemo, useEffect, useCallback } from "react";

// ─── CONFIGURACIÓN SUPABASE ────────────────────────────────────────────────
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
// ────────────────────────────────────────────────────────────────────────────

const DEPARTAMENTOS = [
  "Alcaldía", "Secretaría Municipal", "Asesoría Jurídica", "SECPLA",
  "DAF", "DGP", "DOM", "DIDECO", "DAEM", "DESAM",
  "Medio Ambiente", "Tránsito"
];

const CATEGORIAS = [
  { id: "legal", label: "Legal / Normativo", icon: "⚖️" },
  { id: "operacional", label: "Operacional", icon: "⚙️" },
  { id: "financiero", label: "Financiero", icon: "💰" },
  { id: "reputacional", label: "Reputacional", icon: "📢" },
  { id: "seguridad", label: "Seguridad Laboral", icon: "🦺" },
];

function nivelRiesgo(p, i) {
  const score = p * i;
  if (score >= 15) return { nivel: "CRÍTICO", color: "#DC2626", bg: "#FEF2F2" };
  if (score >= 9)  return { nivel: "ALTO",    color: "#EA580C", bg: "#FFF7ED" };
  if (score >= 4)  return { nivel: "MEDIO",   color: "#CA8A04", bg: "#FEFCE8" };
  return             { nivel: "BAJO",    color: "#16A34A", bg: "#F0FDF4" };
}

const EMPTY_FORM = {
  depto: "", categoria: "legal", descripcion: "",
  probabilidad: 3, impacto: 3, mitigacion: "", responsable: "", estado: "activo"
};

// ─── SESIÓN (guardada en el navegador) ─────────────────────────────────────
function saveSession(s) { try { localStorage.setItem("riesgo_session", JSON.stringify(s)); } catch {} }
function loadSession() { try { const r = localStorage.getItem("riesgo_session"); return r ? JSON.parse(r) : null; } catch { return null; } }
function clearSession() { try { localStorage.removeItem("riesgo_session"); } catch {} }

// ─── HELPERS DE AUTENTICACIÓN (Supabase Auth via REST) ─────────────────────
async function authSignUp(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || "No se pudo crear la cuenta");
  return data;
}

async function authSignIn(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Correo o contraseña incorrectos");
  return data;
}

async function authSignOut(url, anonKey, accessToken) {
  try {
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    });
  } catch {}
}

// ─── API (REST con token del usuario, respeta seguridad por organización) ──
function useApi(url, anonKey, accessToken) {
  const headers = useMemo(() => ({
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  }), [anonKey, accessToken]);

  const select = useCallback(async (table, query = "") => {
    const res = await fetch(`${url}/rest/v1/${table}${query}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [url, headers]);

  const insert = useCallback(async (table, data) => {
    const res = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [url, headers]);

  const update = useCallback(async (table, id, data) => {
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [url, headers]);

  const remove = useCallback(async (table, id) => {
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers });
    if (!res.ok) throw new Error(await res.text());
  }, [url, headers]);

  const rpc = useCallback(async (fn, params) => {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(params) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Error");
    return data;
  }, [url, headers]);

  return useMemo(() => ({ select, insert, update, remove, rpc }), [select, insert, update, remove, rpc]);
}

// ─── PANTALLA DE LOGIN / REGISTRO ───────────────────────────────────────────
function AuthScreen({ supaUrl, supaKey, onLogged }) {
  const [modo, setModo] = useState("login"); // login | signup | invite
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);

  async function cargarPerfilYEntrar(session) {
    const api = { headers: { apikey: supaKey, Authorization: `Bearer ${session.access_token}` } };
    const res = await fetch(`${supaUrl}/rest/v1/profiles?id=eq.${session.user.id}&select=*`, { headers: api.headers });
    const perfiles = await res.json();
    if (!perfiles || perfiles.length === 0) {
      setPendingSession(session);
      setModo("invite");
      setLoading(false);
      return;
    }
    if (perfiles[0].active === false) {
      setError("Tu cuenta fue desactivada. Contacta a tu administrador.");
      setLoading(false);
      return;
    }
    saveSession(session);
    onLogged(session, perfiles[0]);
  }

  async function handleLogin() {
    if (!email || !password) { setError("Completa correo y contraseña."); return; }
    setLoading(true); setError("");
    try {
      const session = await authSignIn(supaUrl, supaKey, email, password);
      await cargarPerfilYEntrar(session);
    } catch (e) { setError(e.message); setLoading(false); }
  }

  async function handleSignup() {
    if (!email || !password || !nombre || !codigo) { setError("Completa todos los campos."); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true); setError("");
    try {
      let session;
      try {
        const su = await authSignUp(supaUrl, supaKey, email, password);
        if (su.access_token) session = su;
        else session = await authSignIn(supaUrl, supaKey, email, password);
      } catch (e) {
        throw e;
      }
      const headers = { apikey: supaKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
      const rpcRes = await fetch(`${supaUrl}/rest/v1/rpc/redeem_invite`, {
        method: "POST", headers, body: JSON.stringify({ p_code: codigo.trim(), p_nombre: nombre }),
      });
      const rpcData = await rpcRes.json();
      if (!rpcData.success) throw new Error(rpcData.message || "Código de invitación inválido.");
      await cargarPerfilYEntrar(session);
    } catch (e) { setError(e.message); setLoading(false); }
  }

  async function handleRedeemOnly() {
    if (!codigo || !nombre) { setError("Ingresa tu nombre y el código."); return; }
    setLoading(true); setError("");
    try {
      const headers = { apikey: supaKey, Authorization: `Bearer ${pendingSession.access_token}`, "Content-Type": "application/json" };
      const rpcRes = await fetch(`${supaUrl}/rest/v1/rpc/redeem_invite`, {
        method: "POST", headers, body: JSON.stringify({ p_code: codigo.trim(), p_nombre: nombre }),
      });
      const rpcData = await rpcRes.json();
      if (!rpcData.success) throw new Error(rpcData.message || "Código inválido.");
      await cargarPerfilYEntrar(pendingSession);
    } catch (e) { setError(e.message); setLoading(false); }
  }

  const inputStyle = { width: "100%", padding: "11px 14px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "#F8FAFC", fontSize: 14, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#94A3B8", display: "block", marginBottom: 6 };

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ background: "#1E293B", borderRadius: 16, padding: 40, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🛡️</div>
          <h1 style={{ color: "#F8FAFC", fontSize: 21, fontWeight: 800, margin: 0 }}>Riesgo Municipal</h1>
          <p style={{ color: "#64748B", fontSize: 13, marginTop: 6 }}>
            {modo === "login" && "Inicia sesión para continuar"}
            {modo === "signup" && "Crea tu cuenta con tu código de invitación"}
            {modo === "invite" && "Falta un paso: ingresa tu código de invitación"}
          </p>
        </div>

        {modo === "login" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Correo electrónico</label>
              <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Contraseña</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <div style={{ background: "#3B0D0D", color: "#FCA5A5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: "linear-gradient(135deg,#3B82F6,#06B6D4)", color: "#fff", border: "none", padding: 13, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              {loading ? "Entrando..." : "Iniciar sesión →"}
            </button>
            <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#64748B" }}>
              ¿No tienes cuenta?{" "}
              <span onClick={() => { setModo("signup"); setError(""); }} style={{ color: "#60A5FA", cursor: "pointer", fontWeight: 600 }}>Crear cuenta</span>
            </p>
          </>
        )}

        {modo === "signup" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tu nombre</label>
              <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Correo electrónico</label>
              <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Contraseña</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Código de invitación</label>
              <input style={inputStyle} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Te lo entrega tu administrador" />
            </div>
            {error && <div style={{ background: "#3B0D0D", color: "#FCA5A5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
            <button onClick={handleSignup} disabled={loading} style={{ width: "100%", background: "linear-gradient(135deg,#3B82F6,#06B6D4)", color: "#fff", border: "none", padding: 13, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              {loading ? "Creando cuenta..." : "Crear cuenta →"}
            </button>
            <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#64748B" }}>
              ¿Ya tienes cuenta?{" "}
              <span onClick={() => { setModo("login"); setError(""); }} style={{ color: "#60A5FA", cursor: "pointer", fontWeight: 600 }}>Iniciar sesión</span>
            </p>
          </>
        )}

        {modo === "invite" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tu nombre</label>
              <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Código de invitación</label>
              <input style={inputStyle} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Te lo entrega tu administrador" />
            </div>
            {error && <div style={{ background: "#3B0D0D", color: "#FCA5A5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
            <button onClick={handleRedeemOnly} disabled={loading} style={{ width: "100%", background: "linear-gradient(135deg,#3B82F6,#06B6D4)", color: "#fff", border: "none", padding: 13, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              {loading ? "Validando..." : "Continuar →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────
function MainApp({ supaUrl, supaKey, session, profile, onLogout }) {
  const api = useApi(supaUrl, supaKey, session.access_token);
  const isSuperAdmin = profile.role === "super_admin";
  const isAdmin = profile.role === "admin" || isSuperAdmin;

  const [vista, setVista] = useState("dashboard");
  const [riesgos, setRiesgos] = useState([]);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [orgSeleccionada, setOrgSeleccionada] = useState(profile.org_id || "todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroDepto, setFiltroDepto] = useState("Todos");
  const [filtroNivel, setFiltroNivel] = useState("Todos");
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null);
  const [nuevaOrgNombre, setNuevaOrgNombre] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const cargarRiesgos = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const data = await api.select("riesgos", "?select=*&order=created_at.desc");
      setRiesgos(data);
    } catch (e) { setError("Error al cargar datos: " + e.message); }
    finally { setLoading(false); }
  }, [api]);

  const cargarOrganizaciones = useCallback(async () => {
    try { setOrganizaciones(await api.select("organizations", "?select=*&order=created_at.desc")); }
    catch (e) { console.error(e); }
  }, [api]);

  const cargarUsuarios = useCallback(async () => {
    try { setUsuarios(await api.select("profiles", "?select=*&order=created_at.desc")); }
    catch (e) { console.error(e); }
  }, [api]);

  useEffect(() => { cargarRiesgos(); if (isAdmin) { cargarOrganizaciones(); cargarUsuarios(); } }, []);

  const riesgosVisibles = useMemo(() => {
    if (!isSuperAdmin) return riesgos;
    if (orgSeleccionada === "todas") return riesgos;
    return riesgos.filter(r => r.org_id === orgSeleccionada);
  }, [riesgos, isSuperAdmin, orgSeleccionada]);

  const riesgosFiltrados = useMemo(() => riesgosVisibles.filter(r => {
    const n = nivelRiesgo(r.probabilidad, r.impacto).nivel;
    return (filtroDepto === "Todos" || r.depto === filtroDepto) && (filtroNivel === "Todos" || n === filtroNivel);
  }), [riesgosVisibles, filtroDepto, filtroNivel]);

  const stats = useMemo(() => ({
    criticos: riesgosVisibles.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "CRÍTICO").length,
    altos:    riesgosVisibles.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "ALTO").length,
    medios:   riesgosVisibles.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "MEDIO").length,
    bajos:    riesgosVisibles.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "BAJO").length,
    total:    riesgosVisibles.length
  }), [riesgosVisibles]);

  const resumenDeptos = useMemo(() => DEPARTAMENTOS.map(d => {
    const rs = riesgosVisibles.filter(r => r.depto === d);
    if (rs.length === 0) return { depto: d, nivel: "SIN DATOS", color: "#6B7280", bg: "#F9FAFB", count: 0, score: 0 };
    const maxScore = Math.max(...rs.map(r => r.probabilidad * r.impacto));
    const n = nivelRiesgo(Math.ceil(maxScore / 5), Math.min(maxScore, 5));
    return { depto: d, ...n, count: rs.length, score: maxScore };
  }).sort((a, b) => b.score - a.score), [riesgosVisibles]);

  const celdasMatriz = useMemo(() => {
    const mapa = {};
    riesgosVisibles.forEach(r => {
      const key = `${r.probabilidad}-${r.impacto}`;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(r);
    });
    return mapa;
  }, [riesgosVisibles]);

  async function handleGuardar() {
    if (!form.depto || !form.descripcion) { showToast("⚠️ Completa departamento y descripción"); return; }
    const org_id = isSuperAdmin ? (orgSeleccionada !== "todas" ? orgSeleccionada : null) : profile.org_id;
    if (!org_id) { showToast("⚠️ Selecciona una organización primero"); return; }
    setSaving(true);
    try {
      const payload = { ...form, org_id };
      if (editId) { await api.update("riesgos", editId, payload); showToast("✅ Riesgo actualizado"); }
      else { await api.insert("riesgos", payload); showToast("✅ Riesgo registrado"); }
      await cargarRiesgos();
      setForm(EMPTY_FORM); setEditId(null); setShowForm(false);
    } catch (e) { showToast("❌ Error: " + e.message); }
    finally { setSaving(false); }
  }

  function handleEditar(r) {
    setForm({ depto: r.depto, categoria: r.categoria, descripcion: r.descripcion, probabilidad: r.probabilidad, impacto: r.impacto, mitigacion: r.mitigacion || "", responsable: r.responsable || "", estado: r.estado });
    setEditId(r.id); setShowForm(true); setVista("registros");
  }

  async function handleEliminar(id) {
    if (!window.confirm("¿Eliminar este riesgo?")) return;
    try { await api.remove("riesgos", id); showToast("🗑️ Eliminado"); await cargarRiesgos(); }
    catch (e) { showToast("❌ Error: " + e.message); }
  }

  async function handleCrearOrg() {
    if (!nuevaOrgNombre.trim()) return;
    try {
      await api.insert("organizations", { name: nuevaOrgNombre.trim() });
      showToast("✅ Organización creada");
      setNuevaOrgNombre("");
      await cargarOrganizaciones();
    } catch (e) { showToast("❌ Error: " + e.message); }
  }

  async function handleToggleOrgActiva(org) {
    try { await api.update("organizations", org.id, { active: !org.active }); await cargarOrganizaciones(); }
    catch (e) { showToast("❌ Error: " + e.message); }
  }

  async function handleToggleUsuarioActivo(u) {
    try { await api.update("profiles", u.id, { active: !u.active }); showToast("✅ Actualizado"); await cargarUsuarios(); }
    catch (e) { showToast("❌ Error: " + e.message); }
  }

  async function handleCambiarRolUsuario(u, nuevoRol) {
    try { await api.update("profiles", u.id, { role: nuevoRol }); showToast("✅ Rol actualizado"); await cargarUsuarios(); }
    catch (e) { showToast("❌ Error: " + e.message); }
  }

  async function handleEliminarUsuario(u) {
    if (!window.confirm(`¿Eliminar a ${u.nombre || u.email}?`)) return;
    try { await api.remove("profiles", u.id); showToast("🗑️ Usuario eliminado"); await cargarUsuarios(); }
    catch (e) { showToast("❌ Error: " + e.message); }
  }

  async function copiarCodigo(codigo) {
    try { await navigator.clipboard.writeText(codigo); showToast("📋 Código copiado"); } catch {}
  }

  async function handleLogout() {
    await authSignOut(supaUrl, supaKey, session.access_token);
    clearSession();
    onLogout();
  }

  const orgMap = useMemo(() => {
    const m = {};
    organizaciones.forEach(o => { m[o.id] = o.name; });
    return m;
  }, [organizaciones]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div><div style={{ color: "#64748B", fontSize: 14 }}>Cargando datos...</div></div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: "#F1F5F9", minHeight: "100vh", color: "#1E293B" }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: "#1E293B", color: "#fff", padding: "12px 20px", borderRadius: 10, zIndex: 9999, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{toast}</div>}

      <div style={{ background: "linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)", padding: "0 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#3B82F6,#06B6D4)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
            <div>
              <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 15 }}>RIESGO MUNICIPAL</div>
              <div style={{ color: "#94A3B8", fontSize: 11 }}>{profile.nombre || profile.email} · {profile.role === "super_admin" ? "Super Admin" : profile.role === "admin" ? "Administrador" : "Usuario"}</div>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            {[
              { id: "dashboard", label: "Dashboard", icon: "📊" },
              { id: "matriz", label: "Matriz", icon: "🗺️" },
              { id: "departamentos", label: "Departamentos", icon: "🏛️" },
              { id: "registros", label: "Registros", icon: "📋" },
              ...(isAdmin ? [{ id: "usuarios", label: "Usuarios", icon: "👥" }] : []),
              ...(isSuperAdmin ? [{ id: "organizaciones", label: "Organizaciones", icon: "🏢" }] : []),
            ].map(v => (
              <button key={v.id} onClick={() => setVista(v.id)} style={{
                background: vista === v.id ? "rgba(59,130,246,0.25)" : "transparent",
                border: vista === v.id ? "1px solid rgba(59,130,246,0.5)" : "1px solid transparent",
                color: vista === v.id ? "#93C5FD" : "#94A3B8",
                padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6
              }}>
                <span>{v.icon}</span><span>{v.label}</span>
              </button>
            ))}
            <button onClick={handleLogout} style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", color: "#FCA5A5", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500, marginLeft: 8 }}>
              Salir
            </button>
          </nav>
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "12px 24px", fontSize: 13, textAlign: "center" }}>⚠️ {error}</div>}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px" }}>

        {isSuperAdmin && vista !== "organizaciones" && (
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Ver organización:</span>
            <select value={orgSeleccionada} onChange={e => setOrgSeleccionada(e.target.value === "todas" ? "todas" : Number(e.target.value))}
              style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, background: "#fff" }}>
              <option value="todas">Todas las organizaciones</option>
              {organizaciones.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {/* DASHBOARD */}
        {vista === "dashboard" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Resumen General</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 24 }}>Período activo 2026</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Críticos", val: stats.criticos, color: "#DC2626", bg: "#FEF2F2", icon: "🔴" },
                { label: "Altos", val: stats.altos, color: "#EA580C", bg: "#FFF7ED", icon: "🟠" },
                { label: "Medios", val: stats.medios, color: "#CA8A04", bg: "#FEFCE8", icon: "🟡" },
                { label: "Bajos", val: stats.bajos, color: "#16A34A", bg: "#F0FDF4", icon: "🟢" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `4px solid ${k.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontSize: 36, fontWeight: 800, color: k.color }}>{k.val}</div><div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>Riesgos {k.label}</div></div>
                    <span style={{ fontSize: 26 }}>{k.icon}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🔥 Top riesgos más críticos</h3>
                {stats.total === 0 ? <p style={{ color: "#94A3B8", fontSize: 13 }}>No hay riesgos registrados aún.</p> :
                  [...riesgosVisibles].sort((a, b) => (b.probabilidad * b.impacto) - (a.probabilidad * a.impacto)).slice(0, 6).map(r => {
                    const n = nivelRiesgo(r.probabilidad, r.impacto);
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.descripcion}</div>
                          <div style={{ fontSize: 11, color: "#94A3B8" }}>{r.depto}{isSuperAdmin ? " · " + (orgMap[r.org_id] || "") : ""} · Score {r.probabilidad * r.impacto}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: n.color, background: n.bg, padding: "2px 8px", borderRadius: 20 }}>{n.nivel}</span>
                      </div>
                    );
                  })}
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🏛️ Estado por Departamento</h3>
                {resumenDeptos.filter(d => d.count > 0).slice(0, 7).map(d => (
                  <div key={d.depto} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{d.depto}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{d.count} riesgo{d.count !== 1 ? "s" : ""}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: d.color, background: d.bg, padding: "2px 8px", borderRadius: 20 }}>{d.nivel}</span>
                  </div>
                ))}
                {resumenDeptos.filter(d => d.count > 0).length === 0 && <p style={{ color: "#94A3B8", fontSize: 13 }}>Sin datos aún.</p>}
              </div>
            </div>
          </div>
        )}

        {/* MATRIZ */}
        {vista === "matriz" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Matriz de Riesgo 5×5</h2>
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex" }}>
                <div style={{ display: "flex", alignItems: "center", marginRight: 10 }}>
                  <span style={{ transform: "rotate(-90deg)", fontSize: 11, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" }}>PROBABILIDAD ↑</span>
                </div>
                <div style={{ flex: 1 }}>
                  {[5, 4, 3, 2, 1].map(prob => (
                    <div key={prob} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{prob}</div>
                      {[1, 2, 3, 4, 5].map(imp => {
                        const items = celdasMatriz[`${prob}-${imp}`] || [];
                        const score = prob * imp;
                        let bg = "#F0FDF4", border = "#86EFAC";
                        if (score >= 15) { bg = "#FEF2F2"; border = "#FCA5A5"; }
                        else if (score >= 9) { bg = "#FFF7ED"; border = "#FDC08A"; }
                        else if (score >= 4) { bg = "#FEFCE8"; border = "#FDE047"; }
                        return (
                          <div key={imp} style={{ flex: 1, minHeight: 72, background: bg, border: `2px solid ${border}`, borderRadius: 8, padding: 6 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", marginBottom: 3 }}>{score}</div>
                            {items.map(r => <div key={r.id} title={r.descripcion} style={{ fontSize: 9, background: "rgba(0,0,0,0.07)", borderRadius: 3, padding: "1px 4px", marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap" }}>{r.depto}</div>)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 4, marginTop: 4, paddingLeft: 24 }}>{[1, 2, 3, 4, 5].map(i => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{i}</div>)}</div>
                  <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, fontWeight: 700, color: "#64748B" }}>IMPACTO →</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DEPARTAMENTOS */}
        {vista === "departamentos" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Estado por Departamento</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {resumenDeptos.map(d => {
                const rs = riesgosVisibles.filter(r => r.depto === d.depto);
                const open = deptoSeleccionado === d.depto;
                return (
                  <div key={d.depto} onClick={() => setDeptoSeleccionado(open ? null : d.depto)} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", cursor: "pointer", border: `2px solid ${open ? d.color : "transparent"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{d.depto}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: d.color, background: d.bg || "#F9FAFB", padding: "3px 10px", borderRadius: 20 }}>{d.nivel}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>{d.count} riesgo{d.count !== 1 ? "s" : ""}</div>
                    {open && rs.map(r => {
                      const n = nivelRiesgo(r.probabilidad, r.impacto);
                      return <div key={r.id} style={{ fontSize: 11, padding: "4px 0", borderTop: "1px solid #F8FAFC", display: "flex", gap: 6, marginTop: 8 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: n.color, marginTop: 4 }} /><span>{r.descripcion}</span></div>;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REGISTROS */}
        {vista === "registros" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div><h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Registro de Riesgos</h2><p style={{ color: "#64748B", fontSize: 13 }}>{riesgosVisibles.length} riesgos</p></div>
              <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(!showForm); }} style={{ background: "#1E3A5F", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                {showForm ? "✕ Cerrar" : "+ Nuevo Riesgo"}
              </button>
            </div>

            {showForm && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 20, border: "2px solid #DBEAFE" }}>
                {isSuperAdmin && orgSeleccionada === "todas" && (
                  <div style={{ background: "#FEF2F2", color: "#DC2626", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 14 }}>⚠️ Selecciona una organización específica arriba antes de crear un riesgo.</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Departamento *</label>
                    <select value={form.depto} onChange={e => setForm(f => ({ ...f, depto: e.target.value }))} style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13 }}>
                      <option value="">Seleccionar...</option>
                      {DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Categoría</label>
                    <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13 }}>
                      {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Descripción *</label>
                    <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Probabilidad: <b style={{ color: "#3B82F6" }}>{form.probabilidad}</b>/5</label>
                    <input type="range" min={1} max={5} value={form.probabilidad} onChange={e => setForm(f => ({ ...f, probabilidad: +e.target.value }))} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Impacto: <b style={{ color: "#3B82F6" }}>{form.impacto}</b>/5</label>
                    <input type="range" min={1} max={5} value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: +e.target.value }))} style={{ width: "100%" }} />
                  </div>
                  <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: nivelRiesgo(form.probabilidad, form.impacto).bg }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: nivelRiesgo(form.probabilidad, form.impacto).color }} />
                    <span style={{ fontWeight: 700, color: nivelRiesgo(form.probabilidad, form.impacto).color }}>Nivel: {nivelRiesgo(form.probabilidad, form.impacto).nivel} · Score: {form.probabilidad * form.impacto}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Mitigación</label>
                    <input value={form.mitigacion} onChange={e => setForm(f => ({ ...f, mitigacion: e.target.value }))} style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Responsable</label>
                    <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={handleGuardar} disabled={saving} style={{ background: "#1E3A5F", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{saving ? "Guardando..." : editId ? "Actualizar" : "Registrar"}</button>
                  <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: "#F1F5F9", color: "#475569", border: "none", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13 }}>
                <option value="Todos">Todos los departamentos</option>{DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
              </select>
              <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13 }}>
                <option value="Todos">Todos los niveles</option>{["CRÍTICO", "ALTO", "MEDIO", "BAJO"].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              {riesgosFiltrados.length === 0 ? <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>Sin riesgos registrados.</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#F8FAFC" }}>{["Departamento", "Categoría", "Descripción", "P×I", "Nivel", "Responsable", "Acciones"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E2E8F0" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...riesgosFiltrados].sort((a, b) => (b.probabilidad * b.impacto) - (a.probabilidad * a.impacto)).map(r => {
                      const n = nivelRiesgo(r.probabilidad, r.impacto);
                      const cat = CATEGORIAS.find(c => c.id === r.categoria);
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>{r.depto}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12 }}>{cat?.icon} {cat?.label}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12, maxWidth: 220 }}>{r.descripcion}{r.mitigacion && <div style={{ fontSize: 11, color: "#94A3B8" }}>→ {r.mitigacion}</div>}</td>
                          <td style={{ padding: "11px 14px", fontWeight: 800, color: n.color, textAlign: "center" }}>{r.probabilidad * r.impacto}</td>
                          <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11, fontWeight: 700, color: n.color, background: n.bg, padding: "3px 10px", borderRadius: 20 }}>{n.nivel}</span></td>
                          <td style={{ padding: "11px 14px", fontSize: 12, color: "#64748B" }}>{r.responsable || "—"}</td>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => handleEditar(r)} style={{ background: "#EFF6FF", color: "#2563EB", border: "none", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Editar</button>
                              <button onClick={() => handleEliminar(r.id)} style={{ background: "#FEF2F2", color: "#DC2626", border: "none", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* USUARIOS */}
        {vista === "usuarios" && isAdmin && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Gestión de Usuarios</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>
              {isSuperAdmin ? "Usuarios de todas las organizaciones" : "Usuarios de tu organización"}
            </p>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#F8FAFC" }}>{["Nombre", "Correo", ...(isSuperAdmin ? ["Organización"] : []), "Rol", "Estado", "Acciones"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E2E8F0" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>{u.nombre || "—"}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#64748B" }}>{u.email}</td>
                      {isSuperAdmin && <td style={{ padding: "11px 14px", fontSize: 12 }}>{orgMap[u.org_id] || "—"}</td>}
                      <td style={{ padding: "11px 14px" }}>
                        {u.role === "super_admin" ? <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#F5F3FF", padding: "3px 10px", borderRadius: 20 }}>Super Admin</span> : (
                          <select value={u.role} onChange={e => handleCambiarRolUsuario(u, e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1" }}>
                            <option value="usuario">Usuario</option>
                            <option value="admin">Administrador</option>
                          </select>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: u.active ? "#16A34A" : "#94A3B8", background: u.active ? "#F0FDF4" : "#F1F5F9", padding: "3px 10px", borderRadius: 20 }}>{u.active ? "Activo" : "Inactivo"}</span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {u.role !== "super_admin" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleToggleUsuarioActivo(u)} style={{ background: "#F1F5F9", color: "#475569", border: "none", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{u.active ? "Desactivar" : "Activar"}</button>
                            <button onClick={() => handleEliminarUsuario(u)} style={{ background: "#FEF2F2", color: "#DC2626", border: "none", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Eliminar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usuarios.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Sin usuarios aún.</div>}
            </div>
            {!isSuperAdmin && profile.org_id && (
              <div style={{ marginTop: 20, background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Invita a más personas</h3>
                <p style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>Comparte el código de tu organización con quienes necesites agregar:</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <code style={{ background: "#F1F5F9", padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{organizaciones.find(o => o.id === profile.org_id)?.invite_code || "—"}</code>
                  <button onClick={() => copiarCodigo(organizaciones.find(o => o.id === profile.org_id)?.invite_code)} style={{ background: "#1E3A5F", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Copiar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ORGANIZACIONES (solo super_admin) */}
        {vista === "organizaciones" && isSuperAdmin && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Organizaciones (Clientes)</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>Cada organización es un cliente independiente con sus propios datos y usuarios.</p>

            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>+ Crear nueva organización</h3>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={nuevaOrgNombre} onChange={e => setNuevaOrgNombre(e.target.value)} placeholder="Ej: Municipalidad de Valdivia" style={{ flex: 1, padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13 }} />
                <button onClick={handleCrearOrg} style={{ background: "#1E3A5F", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Crear</button>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#F8FAFC" }}>{["Organización", "Código de invitación", "Usuarios", "Estado", "Acciones"].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E2E8F0" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {organizaciones.map(o => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>{o.name}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <code style={{ background: "#F1F5F9", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{o.invite_code}</code>
                        <button onClick={() => copiarCodigo(o.invite_code)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#2563EB" }}>Copiar</button>
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 12 }}>{usuarios.filter(u => u.org_id === o.id).length}</td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11, fontWeight: 700, color: o.active ? "#16A34A" : "#94A3B8", background: o.active ? "#F0FDF4" : "#F1F5F9", padding: "3px 10px", borderRadius: 20 }}>{o.active ? "Activa" : "Suspendida"}</span></td>
                      <td style={{ padding: "11px 14px" }}>
                        <button onClick={() => handleToggleOrgActiva(o)} style={{ background: "#F1F5F9", color: "#475569", border: "none", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{o.active ? "Suspender" : "Reactivar"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {organizaciones.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Crea tu primera organización arriba.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const s = loadSession();
    if (!s) { setChecking(false); return; }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${s.user.id}&select=*`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}` },
        });
        const perfiles = await res.json();
        if (perfiles && perfiles.length > 0 && perfiles[0].active !== false) {
          setSession(s); setProfile(perfiles[0]);
        } else { clearSession(); }
      } catch { clearSession(); }
      finally { setChecking(false); }
    })();
  }, []);

  if (checking) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9" }}>
      <div style={{ fontSize: 40 }}>🛡️</div>
    </div>
  );

  if (!session || !profile) {
    return <AuthScreen supaUrl={SUPABASE_URL} supaKey={SUPABASE_ANON_KEY} onLogged={(s, p) => { setSession(s); setProfile(p); }} />;
  }

  return <MainApp supaUrl={SUPABASE_URL} supaKey={SUPABASE_ANON_KEY} session={session} profile={profile} onLogout={() => { setSession(null); setProfile(null); }} />;
}
