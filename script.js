function showPage(page){

document.querySelectorAll(".page").forEach(p=>{
p.style.display="none"
})

document.getElementById(page).style.display="block"

}

let pedidos=[]

function guardarPedido(){

let cliente=document.getElementById("cliente").value
let telefono=document.getElementById("telefono").value
let descripcion=document.getElementById("descripcion").value
let vendedor=document.getElementById("vendedor").value
let valor=parseFloat(document.getElementById("valor").value)||0
let abono=parseFloat(document.getElementById("abono").value)||0
let estado=document.getElementById("estado").value

let saldo=valor-abono

let pedido={

id:pedidos.length+1,
cliente,
telefono,
descripcion,
vendedor,
valor,
abono,
saldo,
estado

}

pedidos.push(pedido)

actualizarTabla()
actualizarDashboard()

}

function actualizarTabla(){

let tabla=document.getElementById("tablaPedidos")
tabla.innerHTML=""

pedidos.forEach(p=>{

tabla.innerHTML+=`

<tr>

<td>${p.id}</td>
<td>${p.cliente}</td>
<td>${p.telefono}</td>
<td>${p.descripcion}</td>
<td>${p.vendedor}</td>
<td>$${p.valor}</td>
<td>$${p.abono}</td>
<td>$${p.saldo}</td>
<td>${p.estado}</td>

</tr>

`

})

}

function actualizarDashboard(){

let ingresos=0
let abonos=0

pedidos.forEach(p=>{

if(p.estado=="Entregado" || p.estado=="Retirado"){
ingresos+=p.valor
}else{
abonos+=p.abono
}

})

document.getElementById("ingresos").innerText="$"+ingresos
document.getElementById("abonos").innerText="$"+abonos
document.getElementById("totalPedidos").innerText=pedidos.length

}
