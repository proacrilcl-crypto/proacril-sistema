import { auth, db, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, runTransaction, setDoc } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const FINAL_STATES = ["Entregado", "Retirado"];
const LOCKED_STATES = ["Entregado", "Retirado"];
let pedidos = [];
let gastos = [];
let vendedores = [];
let isAdmin = false;

const $ = (id) => document.getElementById(id);
const money = (n = 0) => "$" + Number(n || 0).toLocaleString("es-CL");
const today = () => new Date().toISOString().slice(0, 10);

function setStatus(msg){ $("statusMsg").textContent = msg || ""; }
function switchPage(pageId){
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(pageId).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.nav-btn[data-page="${pageId}"]`)?.classList.add("active");
}
function setDefaultDates(){
  $("fechaIngreso").value = today();
  $("fechaEntrega").value = today();
  $("gastoFecha").value = today();
}
function calcPedidoForm(){
  const valor = Number($("valorPedido").value || 0);
  const delivery = Number($("valorDelivery").value || 0);
  const abono = Number($("abono").value || 0);
  const total = valor + delivery;
  const saldo = Math.max(total - abono, 0);
  $("totalPedido").value = total;
  $("saldoPendiente").value = saldo;
}
function applyRoleUI(){
  document.querySelectorAll(".admin-only,.admin-only-page").forEach(el => {
    if (isAdmin) el.classList.remove("hidden-by-role"); else el.classList.add("hidden-by-role");
  });
  $("gastosNavBtn").style.display = isAdmin ? "block" : "none";
}
async function ensureConfigDoc(){
  const ref = doc(db, "configuracion", "sistema");
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { numeroPedidoActual: 1, comisionVendedor: 10 });
}
async function loadVendedores(){
  const snap = await getDocs(collection(db, "vendedores"));
  vendedores = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  const activos = vendedores.filter(v => v.activo !== false);
  const options = activos.map(v => `<option value="${v.nombre || v.id}">${v.nombre || v.id}</option>`).join("");
  $("vendedor").innerHTML = options || '<option value="">Sin vendedores</option>';
  $("filtroVendedor").innerHTML = '<option value="">Todos</option>' + options;
  $("comisionVendedor").innerHTML = '<option value="">Seleccione</option>' + options;
}
async function loadPedidos(){
  const snap = await getDocs(query(collection(db, "pedidos"), orderBy("numeroPedido", "desc")));
  pedidos = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  renderPedidos();
  renderDashboard();
}
async function loadGastos(){
  const snap = await getDocs(collection(db, "gastos"));
  gastos = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  renderGastos();
  renderDashboard();
}
function renderDashboard(){
  const ingresos = pedidos.filter(p => FINAL_STATES.includes(p.estado)).reduce((a,p)=>a+Number(p.total||0),0);
  const abonos = pedidos.filter(p => !FINAL_STATES.includes(p.estado) && p.estado !== "Cancelado").reduce((a,p)=>a+Number(p.abono||0),0);
  const gastosTotal = gastos.reduce((a,g)=>a+Number(g.monto||0),0);
  const activos = pedidos.filter(p => !FINAL_STATES.includes(p.estado) && p.estado !== "Cancelado").length;
  const hoy = today();
  const pedidosHoy = pedidos.filter(p => p.fechaEntrega === hoy && p.estado !== "Cancelado");
  $("dashIngresos").textContent = money(ingresos);
  $("dashAbonos").textContent = money(abonos);
  $("dashGastos").textContent = money(gastosTotal);
  $("dashGanancia").textContent = money(ingresos - gastosTotal);
  $("dashActivos").textContent = activos;
  $("dashHoy").textContent = pedidosHoy.length;
  $("tablaHoy").innerHTML = pedidosHoy.map(p => `<tr><td>${String(p.numeroPedido).padStart(2,"0")}</td><td>${p.cliente||""}</td><td>${p.descripcion||""}</td><td><span class="badge">${p.estado||""}</span></td><td>${p.fechaEntrega||""}</td></tr>`).join("") || `<tr><td colspan="5">Sin pedidos para hoy</td></tr>`;
}
function pedidoMatchesFilters(p){
  const desde = $("filtroDesde").value;
  const hasta = $("filtroHasta").value;
  const estado = $("filtroEstado").value;
  const vendedor = $("filtroVendedor").value;
  const cliente = $("filtroCliente").value.trim().toLowerCase();
  if (desde && (p.fechaEntrega || "") < desde) return false;
  if (hasta && (p.fechaEntrega || "") > hasta) return false;
  if (estado && p.estado !== estado) return false;
  if (vendedor && p.vendedor !== vendedor) return false;
  if (cliente && !(p.cliente || "").toLowerCase().includes(cliente)) return false;
  return true;
}
function renderPedidos(){
  const html = pedidos.filter(pedidoMatchesFilters).map(p => {
    const locked = LOCKED_STATES.includes(p.estado);
    return `<tr>
      <td>${String(p.numeroPedido).padStart(2,"0")}</td>
      <td>${p.cliente||""}</td>
      <td>${p.vendedor||""}</td>
      <td>${money(p.total)}</td>
      <td>${money(p.abono)}</td>
      <td>${money(p.saldo)}</td>
      <td><span class="badge">${p.estado||""}</span></td>
      <td>${p.tipoEntrega||""}</td>
      <td><div class="action-group">
        <button data-id="${p.id}" class="btn-pdf">Orden</button>
        <button data-id="${p.id}" class="btn-edit" ${locked ? "disabled" : ""}>Editar</button>
        <button data-id="${p.id}" class="btn-delete danger" ${locked ? "disabled" : ""}>Eliminar</button>
      </div></td>
    </tr>`;
  }).join("");
  $("tablaPedidos").innerHTML = html || `<tr><td colspan="9">Sin resultados</td></tr>`;
  document.querySelectorAll(".btn-edit").forEach(b => b.addEventListener("click", ()=>editPedido(b.dataset.id)));
  document.querySelectorAll(".btn-delete").forEach(b => b.addEventListener("click", ()=>removePedido(b.dataset.id)));
  document.querySelectorAll(".btn-pdf").forEach(b => b.addEventListener("click", ()=>downloadOrdenTrabajo(b.dataset.id)));
}
function renderGastos(){
  if (!isAdmin){ $("tablaGastos").innerHTML = `<tr><td colspan="5">Solo administrador</td></tr>`; return; }
  $("tablaGastos").innerHTML = gastos.map(g => `<tr>
    <td>${g.fecha||""}</td><td>${g.descripcion||""}</td><td>${g.categoria||""}</td><td>${money(g.monto)}</td>
    <td><div class="action-group"><button data-id="${g.id}" class="btn-edit-gasto">Editar</button><button data-id="${g.id}" class="btn-delete-gasto danger">Eliminar</button></div></td>
  </tr>`).join("") || `<tr><td colspan="5">Sin gastos</td></tr>`;
  document.querySelectorAll(".btn-edit-gasto").forEach(b => b.addEventListener("click", ()=>editGasto(b.dataset.id)));
  document.querySelectorAll(".btn-delete-gasto").forEach(b => b.addEventListener("click", ()=>removeGasto(b.dataset.id)));
}
async function nextNumeroPedido(){
  const configRef = doc(db, "configuracion", "sistema");
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(configRef);
    if (!snap.exists()){
      transaction.set(configRef, { numeroPedidoActual: 2, comisionVendedor: 10 });
      return 1;
    }
    const current = Number((snap.data() || {}).numeroPedidoActual || 1);
    transaction.update(configRef, { numeroPedidoActual: current + 1 });
    return current;
  });
}
function formPedidoData(){
  const valorPedido = Number($("valorPedido").value || 0);
  const valorDelivery = Number($("valorDelivery").value || 0);
  let abono = Number($("abono").value || 0);
  const total = valorPedido + valorDelivery;
  let saldo = Math.max(total - abono, 0);
  const estado = $("estado").value;
  if (FINAL_STATES.includes(estado)){ saldo = 0; abono = 0; }
  return {
    cliente:$("cliente").value.trim(), telefono:$("telefono").value.trim(), tipoEntrega:$("tipoEntrega").value,
    direccion:$("direccion").value.trim(), comuna:$("comuna").value.trim(), referencia:$("referencia").value.trim(),
    descripcion:$("descripcion").value.trim(), vendedor:$("vendedor").value, fechaIngreso:$("fechaIngreso").value,
    fechaEntrega:$("fechaEntrega").value, valorPedido, valorDelivery, total, abono, saldo, estado
  };
}
function resetPedidoForm(){
  $("pedidoForm").reset(); $("pedidoDocId").value = ""; $("pedidoFormTitle").textContent = "Nuevo Pedido";
  $("btnCancelarEdicion").classList.add("hidden"); setDefaultDates();
  $("valorPedido").value = 0; $("valorDelivery").value = 0; $("abono").value = 0; $("estado").value = "Agendado"; $("tipoEntrega").value = "Retiro"; calcPedidoForm();
}
async function savePedido(ev){
  ev.preventDefault();
  const docId = $("pedidoDocId").value;
  const data = formPedidoData();
  if (!data.cliente || !data.descripcion || !data.fechaIngreso || !data.fechaEntrega){ setStatus("Completa los campos obligatorios del pedido."); return; }
  try{
    if (docId){
      const original = pedidos.find(p => p.id === docId);
      if (original && LOCKED_STATES.includes(original.estado)){ setStatus("Ese pedido ya está finalizado y no puede editarse."); return; }
      await updateDoc(doc(db, "pedidos", docId), data);
      setStatus("Pedido actualizado.");
    } else {
      const numeroPedido = await nextNumeroPedido();
      await addDoc(collection(db, "pedidos"), { numeroPedido, ...data });
      setStatus("Pedido guardado.");
    }
    resetPedidoForm(); await loadPedidos(); switchPage("pedidosPage");
  }catch(e){ console.error(e); setStatus("No se pudo guardar el pedido."); }
}
function editPedido(id){
  const p = pedidos.find(x => x.id === id); if (!p) return;
  if (LOCKED_STATES.includes(p.estado)){ setStatus("Ese pedido ya está finalizado y no puede editarse."); return; }
  $("pedidoDocId").value = p.id; $("pedidoFormTitle").textContent = `Editar Pedido ${String(p.numeroPedido).padStart(2,"0")}`;
  $("cliente").value = p.cliente||""; $("telefono").value = p.telefono||""; $("tipoEntrega").value = p.tipoEntrega||"Retiro";
  $("direccion").value = p.direccion||""; $("comuna").value = p.comuna||""; $("referencia").value = p.referencia||"";
  $("descripcion").value = p.descripcion||""; $("vendedor").value = p.vendedor||""; $("fechaIngreso").value = p.fechaIngreso||today();
  $("fechaEntrega").value = p.fechaEntrega||today(); $("valorPedido").value = p.valorPedido||0; $("valorDelivery").value = p.valorDelivery||0;
  $("abono").value = p.abono||0; $("estado").value = p.estado||"Agendado"; calcPedidoForm(); $("btnCancelarEdicion").classList.remove("hidden"); switchPage("nuevoPedidoPage");
}
async function removePedido(id){
  const p = pedidos.find(x => x.id === id); if (!p) return;
  if (LOCKED_STATES.includes(p.estado)){ setStatus("Ese pedido ya está finalizado y no puede eliminarse."); return; }
  if (!confirm("¿Seguro que deseas eliminar este pedido?")) return;
  try{ await deleteDoc(doc(db, "pedidos", id)); setStatus("Pedido eliminado."); await loadPedidos(); }catch(e){ console.error(e); setStatus("No se pudo eliminar el pedido."); }
}
function editGasto(id){
  const g = gastos.find(x => x.id === id); if (!g) return;
  $("gastoDocId").value = g.id; $("gastoFecha").value = g.fecha||today(); $("gastoDescripcion").value = g.descripcion||""; $("gastoCategoria").value = g.categoria||"Otros"; $("gastoMonto").value = g.monto||0; $("btnCancelarGasto").classList.remove("hidden"); switchPage("gastosPage");
}
function resetGastoForm(){
  $("gastoForm").reset(); $("gastoDocId").value = ""; $("gastoFecha").value = today(); $("gastoMonto").value = 0; $("btnCancelarGasto").classList.add("hidden");
}
async function saveGasto(ev){
  ev.preventDefault(); if (!isAdmin){ setStatus("Solo el administrador puede gestionar gastos."); return; }
  const id = $("gastoDocId").value;
  const data = { fecha:$("gastoFecha").value, descripcion:$("gastoDescripcion").value.trim(), categoria:$("gastoCategoria").value, monto:Number($("gastoMonto").value||0) };
  try{
    if (id){ await updateDoc(doc(db, "gastos", id), data); setStatus("Gasto actualizado."); }
    else { await addDoc(collection(db, "gastos"), data); setStatus("Gasto guardado."); }
    resetGastoForm(); await loadGastos();
  }catch(e){ console.error(e); setStatus("No se pudo guardar el gasto."); }
}
async function removeGasto(id){
  if (!isAdmin) return;
  if (!confirm("¿Seguro que deseas eliminar este gasto?")) return;
  try{ await deleteDoc(doc(db, "gastos", id)); setStatus("Gasto eliminado."); await loadGastos(); }catch(e){ console.error(e); setStatus("No se pudo eliminar el gasto."); }
}
function calcComision(ev){
  if (ev) ev.preventDefault();
  const inicio = $("comisionInicio").value, fin = $("comisionFin").value, vendedor = $("comisionVendedor").value;
  const filtered = pedidos.filter(p => {
    if (!FINAL_STATES.includes(p.estado)) return false;
    if (inicio && (p.fechaEntrega||"") < inicio) return false;
    if (fin && (p.fechaEntrega||"") > fin) return false;
    if (vendedor && p.vendedor !== vendedor) return false;
    return true;
  });
  const total = filtered.reduce((a,p)=>a+Number(p.total||0),0);
  $("comisionTotal").textContent = money(total);
  $("comisionMonto").textContent = money(total * 0.10);
  $("tablaComisiones").innerHTML = filtered.map(p => `<tr><td>${String(p.numeroPedido).padStart(2,"0")}</td><td>${p.cliente||""}</td><td>${p.vendedor||""}</td><td>${p.estado||""}</td><td>${money(p.total)}</td></tr>`).join("") || `<tr><td colspan="5">Sin resultados</td></tr>`;
}
function downloadOrdenTrabajo(id){
  const p = pedidos.find(x => x.id === id); if (!p) return;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.setFontSize(18); pdf.text("Asociados P&A", 14, 18);
  pdf.setFontSize(11); pdf.text("Orden de trabajo", 14, 26);
  const rows = [
    ["Pedido", String(p.numeroPedido).padStart(2,"0")], ["Cliente", p.cliente||""], ["Teléfono", p.telefono||""], ["Vendedor", p.vendedor||""],
    ["Tipo de entrega", p.tipoEntrega||""], ["Dirección", p.direccion||""], ["Comuna", p.comuna||""], ["Referencia", p.referencia||""],
    ["Descripción", p.descripcion||""], ["Fecha ingreso", p.fechaIngreso||""], ["Fecha entrega", p.fechaEntrega||""],
    ["Valor pedido", money(p.valorPedido)], ["Delivery", money(p.valorDelivery)], ["Total", money(p.total)], ["Abono", money(p.abono)], ["Saldo", money(p.saldo)], ["Estado", p.estado||""]
  ];
  let y = 38;
  rows.forEach(([k,v]) => { const lines = pdf.splitTextToSize(`${k}: ${v}`, 180); pdf.text(lines, 14, y); y += lines.length * 7; });
  pdf.save(`orden-trabajo-${String(p.numeroPedido).padStart(2,"0")}.pdf`);
}
async function login(){
  try{ await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value); $("loginMsg").textContent = ""; }
  catch(e){ console.error(e); $("loginMsg").textContent = "No se pudo iniciar sesión."; }
}
async function initApp(user){
  isAdmin = (user.email || "").toLowerCase().startsWith("admin@");
  $("userInfoLabel").textContent = `${user.email} · ${isAdmin ? "Administrador" : "Usuario"}`;
  applyRoleUI(); await ensureConfigDoc(); await loadVendedores(); await loadPedidos(); await loadGastos(); setDefaultDates(); resetPedidoForm(); resetGastoForm(); switchPage("dashboardPage");
}
function bind(){
  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", ()=>switchPage(btn.dataset.page)));
  $("loginBtn").addEventListener("click", login);
  $("logoutBtn").addEventListener("click", async ()=>{ await signOut(auth); });
  $("btnIrNuevoPedido").addEventListener("click", ()=>switchPage("nuevoPedidoPage"));
  $("pedidoForm").addEventListener("submit", savePedido);
  $("gastoForm").addEventListener("submit", saveGasto);
  $("btnCancelarEdicion").addEventListener("click", ()=>{ resetPedidoForm(); switchPage("pedidosPage"); });
  $("btnCancelarGasto").addEventListener("click", resetGastoForm);
  ["valorPedido","valorDelivery","abono"].forEach(id => $(id).addEventListener("input", calcPedidoForm));
  $("btnFiltrarPedidos").addEventListener("click", renderPedidos);
  $("btnLimpiarFiltros").addEventListener("click", ()=>{ $("filtroDesde").value=""; $("filtroHasta").value=""; $("filtroEstado").value=""; $("filtroVendedor").value=""; $("filtroCliente").value=""; renderPedidos(); });
  $("btnCalcularComision").addEventListener("click", calcComision);
}
onAuthStateChanged(auth, async user => {
  if (user){ $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden"); await initApp(user); }
  else { $("loginView").classList.remove("hidden"); $("appView").classList.add("hidden"); }
});
bind(); setDefaultDates(); calcPedidoForm();
