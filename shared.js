// =====================================================================
// TESCOM · Base compartida por todas las páginas
// Incluir con una etiqueta <script> apuntando a este archivo (después
// de cargar el script de Supabase).
//
// Cada página debe tener en su HTML:
//   <div id="navMount"></div>      <- aquí se dibuja el menú de arriba
//   <div id="appRoot" style="display:none;"> ... contenido de la página ... </div>
// y al final de su propio script, llamar:
//   TescomAuth.init('captura', async (session) => { ... lo que esa página necesita cargar ... });
// El primer argumento es la clave de esa página en NAV_LINKS (para marcarla activa).
// =====================================================================

// ---------------------------------------------------------------------
// CONFIGURA AQUÍ tus credenciales de Supabase (Project Settings > API)
// ---------------------------------------------------------------------
const SUPABASE_URL = 'https://vfrysdtutjcwnzoukwea.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uZyEjpZEpX1yykpH-q4FeA_GSiKeIg_';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------
// Helpers generales
// ---------------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const money = n => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0);
function round2(n){ return Math.round(n * 100) / 100; }
function formatDate(d){
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function fillSelect(selector, items, placeholder){
  const sel = $(selector);
  if (!sel) return;
  const ph = placeholder || 'Seleccionar…';
  sel.innerHTML = `<option value="">${ph}</option>` + items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
}

// ---------------------------------------------------------------------
// Menú de navegación — agrega aquí una línea cuando exista una página nueva
// ---------------------------------------------------------------------
const NAV_LINKS = [
  { key: 'inicio',        label: 'Inicio',        href: 'index.html' },
  { key: 'captura',       label: 'Captura',       href: 'captura.html' },
  { key: 'seguimiento',   label: 'Seguimiento',   href: 'seguimiento.html',   soon: true },
  { key: 'liquidaciones', label: 'Liquidaciones', href: 'liquidaciones.html', soon: true },
  { key: 'calendario',    label: 'Calendario',    href: 'calendario.html',   soon: true },
];

function renderNav(activeKey){
  const mount = document.getElementById('navMount');
  if (!mount) return;
  const links = NAV_LINKS.map(l => {
    if (l.soon) return `<span class="nav-link soon" title="Próximamente">${l.label}</span>`;
    const cls = 'nav-link' + (l.key === activeKey ? ' active' : '');
    return `<a class="${cls}" href="${l.href}">${l.label}</a>`;
  }).join('');
  mount.innerHTML = `
    <nav class="topnav">
      <div class="topnav-brand">TESCOM</div>
      <div class="topnav-links">${links}</div>
      <div class="user-bar">
        <span id="userEmail"></span>
        <button type="button" class="btn-secondary" id="btnLogout">Salir</button>
      </div>
    </nav>`;
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => sb.auth.signOut());
}

// ---------------------------------------------------------------------
// Pantalla de login (se inyecta sola, ninguna página tiene que repetirla)
// ---------------------------------------------------------------------
function loginErrorMessage(error){
  const raw = error?.message || '';
  if (raw.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (raw.includes('Email not confirmed')) return 'El usuario no está confirmado. En Supabase → Authentication → Users, edítalo y confírmalo (o vuelve a crearlo marcando "Auto Confirm User").';
  return raw || 'No se pudo iniciar sesión.';
}

function injectLoginScreen(){
  if (document.getElementById('loginScreen')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="login-screen" id="loginScreen">
      <div class="login-card">
        <div class="brand-eyebrow">TESCOM</div>
        <h1>Iniciar sesión</h1>
        <div class="sub">Ingresa con el usuario que te crearon en Supabase.</div>
        <form id="loginForm" novalidate>
          <div class="field">
            <label for="login_email">Correo</label>
            <input type="email" id="login_email" required autocomplete="username">
          </div>
          <div class="field">
            <label for="login_password">Contraseña</label>
            <input type="password" id="login_password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn-primary" id="btnLogin">Iniciar sesión</button>
          <div class="login-error" id="loginError"></div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#login_email').value.trim();
    const password = $('#login_password').value;
    const btn = $('#btnLogin');
    const errEl = $('#loginError');
    errEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Entrando…';
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = 'Iniciar sesión';
    if (error){ errEl.textContent = loginErrorMessage(error); return; }
    if (data?.session) await TescomAuth._enter(data.session);
  });
}

// ---------------------------------------------------------------------
// Guardia de autenticación: cada página llama TescomAuth.init(key, onReady)
// ---------------------------------------------------------------------
const TescomAuth = (function(){
  let currentUser = null;
  let entered = false;
  let onReadyCb = null;

  function showLogin(){
    const ls = document.getElementById('loginScreen');
    const ar = document.getElementById('appRoot');
    if (ls) ls.style.display = 'flex';
    if (ar) ar.style.display = 'none';
  }
  function showApp(){
    const ls = document.getElementById('loginScreen');
    const ar = document.getElementById('appRoot');
    if (ls) ls.style.display = 'none';
    if (ar) ar.style.display = 'block';
  }

  async function enter(session){
    currentUser = session.user;
    showApp();
    const emailEl = document.getElementById('userEmail');
    if (emailEl) emailEl.textContent = currentUser.email || '';
    if (entered) return;
    entered = true;
    if (onReadyCb){
      try { await onReadyCb(session); }
      catch (err){ console.error(err); }
    }
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) enter(session);
    if (event === 'SIGNED_OUT'){ currentUser = null; entered = false; showLogin(); }
  });

  async function init(navKey, onReady){
    injectLoginScreen();
    renderNav(navKey);
    onReadyCb = onReady;
    try{
      const { data: { session } } = await sb.auth.getSession();
      if (session) await enter(session);
      else showLogin();
    } catch (err){
      console.error(err);
      showLogin();
    }
  }

  return { init, get currentUser(){ return currentUser; }, _enter: enter };
})();
