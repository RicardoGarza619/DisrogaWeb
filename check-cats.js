const fs = require('fs');
const filtered = JSON.parse(fs.readFileSync('c_ClaveProdServ_filtered.json','utf8'));
console.log('Total registros:', filtered.length);
const dist = {};
filtered.forEach(r => { dist[r.categoria] = (dist[r.categoria]||0)+1; });
console.log('\nTodas las categorías en el archivo:');
Object.entries(dist).sort((a,b)=>b[1]-a[1]).forEach(([c,n])=>console.log(String(n).padStart(6),'  ',c));

// Categorías pedidas por el usuario
const CATS_PEDIDAS = ['Frutas','Carnes','Pescados','Lácteos','Aceites','Dulces','Condimentos','Panadería','Alimentos','Bebidas','Papel'];
console.log('\nCategorías pedidas que SÍ existen en el archivo:');
CATS_PEDIDAS.forEach(c => {
  const n = dist[c] || 0;
  console.log(`  ${n > 0 ? '✅' : '❌'}  ${c}: ${n} registros`);
});
