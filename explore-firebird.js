const Firebird = require('node-firebird');
const opts = {
  host:'DISROGA-SVR', port:3050,
  database:'C:\\Program Files (x86)\\Common Files\\Aspel\\Sistemas Aspel\\SAE9.00\\Empresa03\\Datos\\SAE90EMPRE03.FDB',
  user:'sysdba', password:'masterkey', lowercase_keys:true
};
function q(db,sql,params=[]) {
  return new Promise((res,rej)=>db.query(sql,params,(e,r)=>e?rej(e):res(r)));
}
Firebird.attach(opts, async(err,db)=>{
  if(err){console.error(err.message);process.exit(1);}

  // 1. Cuántos productos ACTIVOS tienen CVE_PRODSERV lleno
  const total = await q(db,`SELECT COUNT(*) AS n FROM inve03 WHERE status='A' AND cve_prodserv IS NOT NULL AND TRIM(cve_prodserv)<>''`);
  const sinClave = await q(db,`SELECT COUNT(*) AS n FROM inve03 WHERE status='A' AND (cve_prodserv IS NULL OR TRIM(cve_prodserv)='')`);
  console.log(`Productos activos CON cve_prodserv : ${total[0].n}`);
  console.log(`Productos activos SIN cve_prodserv : ${sinClave[0].n}`);

  // 2. Ver muestra de valores
  console.log('\n=== Muestra de CVE_PRODSERV en productos activos ===');
  const muestra = await q(db,`SELECT FIRST 10 TRIM(cve_art) AS cve, TRIM(descr) AS nombre, TRIM(cve_prodserv) AS sat FROM inve03 WHERE status='A' AND cve_prodserv IS NOT NULL AND TRIM(cve_prodserv)<>''`);
  muestra.forEach(r=>console.log(`  ${r.sat}  →  ${r.nombre}`));

  // 3. Ver campo CVE_UNIDADMEDIDA (unidad SAT) si existe en INVE03
  const unidadSat = await q(db,`SELECT RF.RDB$FIELD_NAME AS c FROM RDB$RELATION_FIELDS RF WHERE RF.RDB$RELATION_NAME='INVE03' AND (RF.RDB$FIELD_NAME CONTAINING 'UNIDAD' OR RF.RDB$FIELD_NAME CONTAINING 'UNISAT' OR RF.RDB$FIELD_NAME CONTAINING 'CVEUNI')`);
  console.log('\n=== Campos INVE03 de unidad SAT ===');
  unidadSat.forEach(r=>console.log(' •',r.c.trim()));

  db.detach();
  console.log('\nListo.');
});
