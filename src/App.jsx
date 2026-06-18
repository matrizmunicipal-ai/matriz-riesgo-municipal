import { useState, useMemo, useEffect, useCallback } from "react";

// ─── CONFIGURACIÓN SUPABASE ───────────────────────────────────────────────────
// Pega aquí tus credenciales de supabase.com → Settings → API
const SUPABASE_URL = "https://rgoepwpgqdsniscknsga.supabase.co";       // ej: https://xyzxyz.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnb2Vwd3BncWRzbmlzY2tuc2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDg0NzEsImV4cCI6MjA5NzM4NDQ3MX0.YSJV9-gPbv7SaB_3pWjm4Pd77IXvcdDJlwxNlvHgG9A";  // ej: eyJhbGci...
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── API Supabase via REST ────────────────────────────────────────────────────
function useSupabase(url, key) {
  const headers = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };

  const getAll = useCallback(async () => {
    const res = await fetch(`${url}/rest/v1/riesgos?select=*&order=created_at.desc`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [url, key]);

  const insert = useCallback(async (data) => {
    const res = await fetch(`${url}/rest/v1/riesgos`, {
      method: "POST", headers, body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [url, key]);

  const update = useCallback(async (id, data) => {
    const res = await fetch(`${url}/rest/v1/riesgos?id=eq.${id}`, {
      method: "PATCH", headers, body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [url, key]);

  const remove = useCallback(async (id) => {
    const res = await fetch(`${url}/rest/v1/riesgos?id=eq.${id}`, {
      method: "DELETE", headers
    });
    if (!res.ok) throw new Error(await res.text());
  }, [url, key]);

  return { getAll, insert, update, remove };
}

// ─── PANTALLA DE CONFIGURACIÓN ────────────────────────────────────────────────
function SetupScreen({ onConnect }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (!url || !key) { setError("Debes ingresar ambos campos."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${url}/rest/v1/riesgos?select=id&limit=1`, {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` }
      });
      if (!res.ok) throw new Error("Credenciales incorrectas o tabla no existe.");
      onConnect(url.replace(/\/$/, ""), key);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#1E293B", borderRadius: 16, padding: 40, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛡️</div>
          <h1 style={{ color: "#F8FAFC", fontSize: 22, fontWeight: 800, margin: 0 }}>Riesgo Municipal</h1>
          <p style={{ color: "#64748B", fontSize: 13, marginTop: 6 }}>Conecta tu base de datos para comenzar</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", display: "block", marginBottom: 6 }}>Supabase Project URL</label>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://xxxxxxxx.supabase.co"
            style={{ width: "100%", padding: "10px 12px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "#F8FAFC", fontSize: 13, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", display: "block", marginBottom: 6 }}>Anon Public Key</label>
          <input value={key} onChange={e => setKey(e.target.value)} type="password"
            placeholder="eyJhbGciOiJIUzI1NiI..."
            style={{ width: "100%", padding: "10px 12px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "#F8FAFC", fontSize: 13, boxSizing: "border-box" }} />
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleConnect} disabled={loading}
          style={{ width: "100%", background: "linear-gradient(135deg, #3B82F6, #06B6D4)", color: "#fff", border: "none", padding: "12px", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14 }}>
          {loading ? "Conectando..." : "Conectar y Entrar →"}
        </button>

        <p style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 16 }}>
          Las credenciales solo se usan en tu navegador y no se almacenan en ningún servidor externo.
        </p>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function MainApp({ supabaseUrl, supabaseKey }) {
  const api = useSupabase(supabaseUrl, supabaseKey);
  const [riesgos, setRiesgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("dashboard");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [filtroDepto, setFiltroDepto] = useState("Todos");
  const [filtroNivel, setFiltroNivel] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null);
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const cargar = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const data = await api.getAll();
      setRiesgos(data);
    } catch (e) { setError("Error al cargar datos: " + e.message); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);

  const riesgosFiltrados = useMemo(() => riesgos.filter(r => {
    const n = nivelRiesgo(r.probabilidad, r.impacto).nivel;
    return (filtroDepto === "Todos" || r.depto === filtroDepto) &&
           (filtroNivel === "Todos" || n === filtroNivel);
  }), [riesgos, filtroDepto, filtroNivel]);

  const stats = useMemo(() => ({
    criticos: riesgos.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "CRÍTICO").length,
    altos:    riesgos.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "ALTO").length,
    medios:   riesgos.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "MEDIO").length,
    bajos:    riesgos.filter(r => nivelRiesgo(r.probabilidad, r.impacto).nivel === "BAJO").length,
    total:    riesgos.length
  }), [riesgos]);

  const resumenDeptos = useMemo(() => DEPARTAMENTOS.map(d => {
    const rs = riesgos.filter(r => r.depto === d);
    if (rs.length === 0) return { depto: d, nivel: "SIN DATOS", color: "#6B7280", bg: "#F9FAFB", count: 0, score: 0 };
    const maxScore = Math.max(...rs.map(r => r.probabilidad * r.impacto));
    const n = nivelRiesgo(Math.ceil(maxScore / 5), Math.min(maxScore, 5));
    return { depto: d, ...n, count: rs.length, score: maxScore };
  }).sort((a, b) => b.score - a.score), [riesgos]);

  const celdasMatriz = useMemo(() => {
    const mapa = {};
    riesgos.forEach(r => {
      const key = `${r.probabilidad}-${r.impacto}`;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(r);
    });
    return mapa;
  }, [riesgos]);

  async function handleGuardar() {
    if (!form.depto || !form.descripcion) { showToast("⚠️ Completa departamento y descripción"); return; }
    setSaving(true);
    try {
      const payload = { depto: form.depto, categoria: form.categoria, descripcion: form.descripcion, probabilidad: form.probabilidad, impacto: form.impacto, mitigacion: form.mitigacion, responsable: form.responsable, estado: form.estado };
      if (editId) {
        await api.update(editId, payload);
        showToast("✅ Riesgo actualizado");
      } else {
        await api.insert(payload);
        showToast("✅ Riesgo registrado");
      }
      await cargar();
      setForm(EMPTY_FORM); setEditId(null); setShowForm(false);
    } catch (e) { showToast("❌ Error: " + e.message); }
    finally { setSaving(false); }
  }

  function handleEditar(r) {
    setForm({ depto: r.depto, categoria: r.categoria, descripcion: r.descripcion, probabilidad: r.probabilidad, impacto: r.impacto, mitigacion: r.mitigacion || "", responsable: r.responsable || "", estado: r.estado });
    setEditId(r.id); setShowForm(true); setVista("registros");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  }

  async function handleEliminar(id) {
    if (!window.confirm("¿Eliminar este riesgo?")) return;
    try { await api.remove(id); showToast("🗑️ Riesgo eliminado"); await cargar(); }
    catch (e) { showToast("❌ Error: " + e.message); }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
        <div style={{ color: "#64748B", fontSize: 14 }}>Cargando datos...</div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: "#F1F5F9", minHeight: "100vh", color: "#1E293B" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#1E293B", color: "#fff", padding: "12px 20px", borderRadius: 10, zIndex: 9999, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)", padding: "0 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#3B82F6,#06B6D4)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
            <div>
              <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 15 }}>RIESGO MUNICIPAL</div>
              <div style={{ color: "#94A3B8", fontSize: 11 }}>{stats.total} riesgos registrados</div>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[
              { id: "dashboard", label: "Dashboard", icon: "📊" },
              { id: "matriz", label: "Matriz", icon: "🗺️" },
              { id: "departamentos", label: "Departamentos", icon: "🏛️" },
              { id: "registros", label: "Registros", icon: "📋" },
            ].map(v => (
              <button key={v.id} onClick={() => setVista(v.id)} style={{
                background: vista === v.id ? "rgba(59,130,246,0.25)" : "transparent",
                border: vista === v.id ? "1px solid rgba(59,130,246,0.5)" : "1px solid transparent",
                color: vista === v.id ? "#93C5FD" : "#94A3B8",
                padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 6
              }}>
                <span>{v.icon}</span><span>{v.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "12px 24px", fontSize: 13, textAlign: "center" }}>
          ⚠️ {error} <button onClick={cargar} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Reintentar</button>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>

        {/* ── DASHBOARD ── */}
        {vista === "dashboard" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Resumen General</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 24 }}>Municipalidad · Período activo 2026</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Críticos", val: stats.criticos, color: "#DC2626", bg: "#FEF2F2", icon: "🔴" },
                { label: "Altos",    val: stats.altos,    color: "#EA580C", bg: "#FFF7ED", icon: "🟠" },
                { label: "Medios",   val: stats.medios,   color: "#CA8A04", bg: "#FEFCE8", icon: "🟡" },
                { label: "Bajos",    val: stats.bajos,    color: "#16A34A", bg: "#F0FDF4", icon: "🟢" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `4px solid ${k.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 36, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.val}</div>
                      <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>Riesgos {k.label}</div>
                    </div>
                    <span style={{ fontSize: 26 }}>{k.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🔥 Top riesgos más críticos</h3>
                {stats.total === 0 ? <p style={{ color: "#94A3B8", fontSize: 13 }}>No hay riesgos registrados aún.</p> :
                  [...riesgos].sort((a, b) => (b.probabilidad * b.impacto) - (a.probabilidad * a.impacto)).slice(0, 6).map(r => {
                    const n = nivelRiesgo(r.probabilidad, r.impacto);
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.descripcion}</div>
                          <div style={{ fontSize: 11, color: "#94A3B8" }}>{r.depto} · Score {r.probabilidad * r.impacto}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: n.color, background: n.bg, padding: "2px 8px", borderRadius: 20 }}>{n.nivel}</span>
                      </div>
                    );
                  })
                }
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
                {resumenDeptos.filter(d => d.count > 0).length === 0 &&
                  <p style={{ color: "#94A3B8", fontSize: 13 }}>Sin datos aún. Registra el primer riesgo.</p>}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 Por categoría</h3>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {CATEGORIAS.map(cat => {
                  const count = riesgos.filter(r => r.categoria === cat.id).length;
                  const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={cat.id} style={{ flex: "1 1 160px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>{cat.icon} {cat.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{count}</span>
                      </div>
                      <div style={{ background: "#F1F5F9", borderRadius: 4, height: 6 }}>
                        <div style={{ background: "#3B82F6", borderRadius: 4, height: 6, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── MATRIZ 5×5 ── */}
        {vista === "matriz" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Matriz de Riesgo 5×5</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 24 }}>Probabilidad × Impacto · Pasa el cursor sobre cada celda para ver los riesgos</p>
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", gap: 0 }}>
                <div style={{ display: "flex", alignItems: "center", marginRight: 10 }}>
                  <span style={{ transform: "rotate(-90deg)", fontSize: 11, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap", display: "block" }}>PROBABILIDAD ↑</span>
                </div>
                <div style={{ flex: 1 }}>
                  {[5, 4, 3, 2, 1].map(prob => (
                    <div key={prob} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "stretch" }}>
                      <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#64748B", flexShrink: 0 }}>{prob}</div>
                      {[1, 2, 3, 4, 5].map(imp => {
                        const key = `${prob}-${imp}`;
                        const items = celdasMatriz[key] || [];
                        const score = prob * imp;
                        let bg = "#F0FDF4", border = "#86EFAC";
                        if (score >= 15) { bg = "#FEF2F2"; border = "#FCA5A5"; }
                        else if (score >= 9) { bg = "#FFF7ED"; border = "#FDC08A"; }
                        else if (score >= 4) { bg = "#FEFCE8"; border = "#FDE047"; }
                        return (
                          <div key={imp} style={{ flex: 1, minHeight: 72, background: bg, border: `2px solid ${border}`, borderRadius: 8, padding: 6 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", marginBottom: 3 }}>{score}</div>
                            {items.map(r => (
                              <div key={r.id} title={`${r.depto}: ${r.descripcion}`}
                                style={{ fontSize: 9, background: "rgba(0,0,0,0.07)", borderRadius: 3, padding: "1px 4px", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "help" }}>
                                {r.depto}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 4, marginTop: 4, paddingLeft: 24 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{i}</div>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, fontWeight: 700, color: "#64748B" }}>IMPACTO →</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
                {[
                  { label: "Crítico (≥15)", color: "#DC2626", bg: "#FEF2F2" },
                  { label: "Alto (9-14)",   color: "#EA580C", bg: "#FFF7ED" },
                  { label: "Medio (4-8)",   color: "#CA8A04", bg: "#FEFCE8" },
                  { label: "Bajo (1-3)",    color: "#16A34A", bg: "#F0FDF4" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 16, height: 16, background: l.bg, border: `2px solid ${l.color}`, borderRadius: 3 }} />
                    <span style={{ fontSize: 12, color: "#475569" }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DEPARTAMENTOS ── */}
        {vista === "departamentos" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Estado por Departamento</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 24 }}>Haz clic en una tarjeta para ver los riesgos detallados</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {resumenDeptos.map(d => {
                const rs = riesgos.filter(r => r.depto === d.depto);
                const open = deptoSeleccionado === d.depto;
                return (
                  <div key={d.depto} onClick={() => setDeptoSeleccionado(open ? null : d.depto)}
                    style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", cursor: "pointer", border: `2px solid ${open ? d.color : "transparent"}`, transition: "all 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{d.depto}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: d.color, background: d.bg || "#F9FAFB", padding: "3px 10px", borderRadius: 20 }}>{d.nivel}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>{d.count} riesgo{d.count !== 1 ? "s" : ""}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {CATEGORIAS.map(cat => {
                        const c = rs.filter(r => r.categoria === cat.id).length;
                        if (!c) return null;
                        return <span key={cat.id} style={{ fontSize: 10, background: "#F1F5F9", color: "#475569", padding: "2px 6px", borderRadius: 10 }}>{cat.icon} {c}</span>;
                      })}
                    </div>
                    {open && rs.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
                        {rs.map(r => {
                          const n = nivelRiesgo(r.probabilidad, r.impacto);
                          return (
                            <div key={r.id} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid #F8FAFC", display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, color: "#334155" }}>{r.descripcion}</span>
                              <span style={{ color: "#94A3B8", fontSize: 10 }}>P{r.probabilidad}×I{r.impacto}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {open && rs.length === 0 && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#94A3B8" }}>Sin riesgos registrados aún.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── REGISTROS ── */}
        {vista === "registros" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Registro de Riesgos</h2>
                <p style={{ color: "#64748B", fontSize: 13 }}>{riesgos.length} riesgo{riesgos.length !== 1 ? "s" : ""} en base de datos</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={cargar} style={{ background: "#F1F5F9", color: "#475569", border: "none", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  🔄 Actualizar
                </button>
                <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(!showForm); }}
                  style={{ background: "#1E3A5F", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  {showForm ? "✕ Cerrar" : "+ Nuevo Riesgo"}
                </button>
              </div>
            </div>

            {showForm && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 20, border: "2px solid #DBEAFE" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1E3A5F" }}>
                  {editId ? "✏️ Editar Riesgo" : "➕ Registrar Nuevo Riesgo"}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Departamento *</label>
                    <select value={form.depto} onChange={e => setForm(f => ({ ...f, depto: e.target.value }))}
                      style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, background: "#fff" }}>
                      <option value="">Seleccionar...</option>
                      {DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Categoría</label>
                    <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                      style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, background: "#fff" }}>
                      {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Descripción del Riesgo *</label>
                    <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Ej: Incumplimiento de plazos en rendición de cuentas..."
                      style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                      Probabilidad: <span style={{ color: "#3B82F6", fontWeight: 800 }}>{form.probabilidad}</span> / 5
                    </label>
                    <input type="range" min={1} max={5} value={form.probabilidad} onChange={e => setForm(f => ({ ...f, probabilidad: +e.target.value }))} style={{ width: "100%" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8" }}><span>Raro</span><span>Muy probable</span></div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                      Impacto: <span style={{ color: "#3B82F6", fontWeight: 800 }}>{form.impacto}</span> / 5
                    </label>
                    <input type="range" min={1} max={5} value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: +e.target.value }))} style={{ width: "100%" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8" }}><span>Leve</span><span>Catastrófico</span></div>
                  </div>
                  <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: nivelRiesgo(form.probabilidad, form.impacto).bg }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: nivelRiesgo(form.probabilidad, form.impacto).color }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: nivelRiesgo(form.probabilidad, form.impacto).color }}>
                      Nivel: {nivelRiesgo(form.probabilidad, form.impacto).nivel} · Score: {form.probabilidad * form.impacto}
                    </span>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Medida de Mitigación</label>
                    <input value={form.mitigacion} onChange={e => setForm(f => ({ ...f, mitigacion: e.target.value }))}
                      placeholder="Acción para reducir el riesgo..."
                      style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Responsable</label>
                    <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                      placeholder="Nombre o cargo..."
                      style={{ width: "100%", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={handleGuardar} disabled={saving}
                    style={{ background: "#1E3A5F", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13 }}>
                    {saving ? "Guardando..." : editId ? "Actualizar" : "Registrar Riesgo"}
                  </button>
                  <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }}
                    style={{ background: "#F1F5F9", color: "#475569", border: "none", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Filtros */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, background: "#fff" }}>
                <option value="Todos">Todos los departamentos</option>
                {DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
              </select>
              <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, background: "#fff" }}>
                <option value="Todos">Todos los niveles</option>
                {["CRÍTICO", "ALTO", "MEDIO", "BAJO"].map(n => <option key={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: 13, color: "#64748B" }}>{riesgosFiltrados.length} resultado{riesgosFiltrados.length !== 1 ? "s" : ""}</span>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              {riesgosFiltrados.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <div style={{ color: "#94A3B8", fontSize: 14 }}>
                    {stats.total === 0 ? "Aún no hay riesgos. Registra el primero." : "Sin resultados con estos filtros."}
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Departamento", "Categoría", "Descripción / Mitigación", "P×I", "Nivel", "Responsable", "Acciones"].map(h => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E2E8F0", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...riesgosFiltrados].sort((a, b) => (b.probabilidad * b.impacto) - (a.probabilidad * a.impacto)).map(r => {
                      const n = nivelRiesgo(r.probabilidad, r.impacto);
                      const cat = CATEGORIAS.find(c => c.id === r.categoria);
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>{r.depto}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{cat?.icon} {cat?.label}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12, maxWidth: 240 }}>
                            <div style={{ color: "#334155" }}>{r.descripcion}</div>
                            {r.mitigacion && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>→ {r.mitigacion}</div>}
                          </td>
                          <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 800, color: n.color, textAlign: "center" }}>{r.probabilidad * r.impacto}</td>
                          <td style={{ padding: "11px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: n.color, background: n.bg, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{n.nivel}</span>
                          </td>
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
      </div>
    </div>
  );
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState(
    SUPABASE_URL && SUPABASE_ANON_KEY
      ? { url: SUPABASE_URL, key: SUPABASE_ANON_KEY }
      : null
  );

  if (!config) return <SetupScreen onConnect={(url, key) => setConfig({ url, key })} />;
  return <MainApp supabaseUrl={config.url} supabaseKey={config.key} />;
}
