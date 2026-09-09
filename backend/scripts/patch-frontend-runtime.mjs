import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..', '..');
const frontendPath = path.join(projectRoot, 'frontend');
const publicPath = path.join(projectRoot, 'backend', 'public');
const indexPath = path.join(frontendPath, 'index.html');

let indexHtml = await readFile(indexPath, 'utf8');
const assetMatch = indexHtml.match(/src="\/assets\/(index-[^"?]+\.js)(?:\?[^" ]+)?"/);

if (! assetMatch) {
    throw new Error('Bundle frontend utama tidak ditemukan di frontend/index.html.');
}

const bundlePath = path.join(projectRoot, 'frontend', 'assets', assetMatch[1]);
let bundle = await readFile(bundlePath, 'utf8');

function replaceOnce(source, search, replacement, label) {
    const occurrences = source.split(search).length - 1;

    if (occurrences === 0 && source.includes(replacement)) {
        console.log(`${label}: sudah diterapkan`);

        return source;
    }

    if (occurrences !== 1) {
        throw new Error(`${label}: diharapkan tepat 1 kecocokan, ditemukan ${occurrences}.`);
    }

    console.log(`${label}: diterapkan`);

    return source.replace(search, replacement);
}

function replaceOptionalOnce(source, search, replacement, label) {
    const occurrences = source.split(search).length - 1;

    if (occurrences > 1) {
        throw new Error(`${label}: ditemukan ${occurrences} kecocokan; migrasi dibatalkan.`);
    }

    if (occurrences === 0) {
        console.log(`${label}: tidak diperlukan`);

        return source;
    }

    console.log(`${label}: diterapkan`);

    return source.replace(search, replacement);
}

function replaceAll(source, search, replacement, label) {
    if (!source.includes(search)) {
        console.log(`${label}: tidak diperlukan`);
        return source;
    }
    console.log(`${label}: diterapkan`);
    return source.replaceAll(search, replacement);
}

bundle = replaceOnce(
    bundle,
    'function u7(){let e=`https://mj.pantaibsb.com/api`,t=window.location.hostname;return(e.includes(`localhost`)||e.includes(`127.0.0.1`))&&t&&t!==`localhost`&&t!==`127.0.0.1`?`${window.location.protocol}//${t}:8000/api`:e}',
    'function u7(){return `/api`}',
    'Endpoint API same-origin',
);
bundle = replaceOptionalOnce(
    bundle,
    'async function M7(e){let{data:t}=await d7.post(`/transactions/checkout`,{table_id:e.tableId,cashier_id:e.cashierId,payment_method:v7(e.paymentMethod),discount:e.discount??0,service_charge:e.serviceCharge,service_charge_percent:e.serviceChargePercent,duration_minutes:e.durationMinutes,reminder_interval_minutes:e.reminderIntervalMinutes,items:e.items.map(e=>({product_id:e.productId,qty:e.qty,discount:e.discount??0}))});return C7(t)}',
    'async function M7(e){let{data:t}=await d7.post(`/transactions/checkout`,{table_id:e.tableId,cashier_id:e.cashierId,payment_method:v7(e.paymentMethod),discount:e.discount??0,tax_percent:e.taxPercent,service_charge:e.serviceCharge,service_charge_percent:e.serviceChargePercent,duration_minutes:e.durationMinutes,reminder_interval_minutes:e.reminderIntervalMinutes,items:e.items.map(e=>({product_id:e.productId,qty:e.qty,discount:e.discount??0}))});return C7(t)}',
    'Persentase pajak dikirim saat checkout',
);
bundle = replaceOptionalOnce(
    bundle,
    '[P,F]=(0,v.useState)(0),[I,L]=(0,v.useState)(5),[R,z]=',
    '[P,F]=(0,v.useState)(0),[I,L]=(0,v.useState)(5),[taxOn,setTaxOn]=(0,v.useState)(()=>localStorage.getItem(`pos_billing_tax_enabled`)!==`off`),[serviceOn,setServiceOn]=(0,v.useState)(()=>localStorage.getItem(`pos_billing_service_enabled`)!==`off`),[R,z]=',
    'State sakelar pajak dan service',
);
bundle = replaceOnce(
    bundle,
    '(0,v.useEffect)(()=>{localStorage.setItem(`pos_billing_auto_print`,B?`on`:`off`)},[B]),(0,v.useEffect)(()=>{let e=Qe.current;',
    '(0,v.useEffect)(()=>{localStorage.setItem(`pos_billing_auto_print`,B?`on`:`off`)},[B]),(0,v.useEffect)(()=>{localStorage.setItem(`pos_billing_tax_enabled`,taxOn?`on`:`off`)},[taxOn]),(0,v.useEffect)(()=>{localStorage.setItem(`pos_billing_service_enabled`,serviceOn?`on`:`off`)},[serviceOn]),(0,v.useEffect)(()=>{let e=Qe.current;',
    'Persistensi pengaturan pajak dan service',
);
bundle = replaceOptionalOnce(
    bundle,
    'ft=Math.round(Math.max(0,dt-P)*(I/100)),pt=Math.round(Math.max(0,dt-P)*.1),mt=Math.max(0,dt-P+pt+ft)',
    'pt=taxOn?Math.round(Math.max(0,dt-P)*.1):0,ft=serviceOn?Math.round((Math.max(0,dt-P)+pt)*(I/100)):0,mt=Math.max(0,Math.round(dt-P+pt+ft))',
    'Perhitungan total mengikuti sakelar pajak dan service',
);
bundle = replaceOptionalOnce(
    bundle,
    'function Mt(e=R){let n=new Date,r=p[0];jt({id:0,invoice:`TEST-${xr(n,`yyyyMMdd-HHmmss`)}`,tableId:K.id,cashierId:t?.id??0,items:r?[{productId:r.id,qty:1,discount:0}]:[],subtotal:r?.sellPrice??0,discount:0,tax:Math.round((r?.sellPrice??0)*.1),serviceCharge:Math.round((r?.sellPrice??0)*.05),grandTotal:Math.round((r?.sellPrice??0)*1.15),paymentMethod:M,createdAt:n.toISOString(),status:`paid`},e),X.success(`Test print ${e} dibuka. Pilih printer Bluetooth/USB di dialog Chrome.`)}',
    'function Mt(e=R){let n=new Date,r=p[0],i=r?.sellPrice??0,a=taxOn?Math.round(i*.1):0,o=serviceOn?Math.round((i+a)*(I/100)):0;jt({id:0,invoice:`TEST-${xr(n,`yyyyMMdd-HHmmss`)}`,tableId:K.id,cashierId:t?.id??0,items:r?[{productId:r.id,qty:1,discount:0}]:[],subtotal:i,discount:0,tax:a,serviceCharge:o,grandTotal:Math.round(i+a+o),paymentMethod:M,createdAt:n.toISOString(),status:`paid`},e),X.success(`Test print ${e} dibuka. Pilih printer Bluetooth/USB di dialog Chrome.`)}',
    'Test struk mengikuti pajak dan service',
);
bundle = replaceOnce(
    bundle,
    '(0,Q.jsx)(QQ,{id:`service-charge`,className:`w-24`,min:0,type:`number`,value:I,onChange:e=>L(Math.max(0,Number(e.target.value)||0))})',
    '(0,Q.jsx)(QQ,{id:`service-charge`,className:`w-24`,min:0,type:`number`,disabled:!serviceOn,value:I,onChange:e=>L(Math.max(0,Number(e.target.value)||0))})',
    'Input service nonaktif saat service dimatikan',
);
bundle = replaceOnce(
    bundle,
    '(0,Q.jsx)(`span`,{children:`Pajak 10%`})',
    '(0,Q.jsx)(`span`,{children:taxOn?`Pajak 10%`:`Pajak (Nonaktif)`})',
    'Label status pajak pada ringkasan',
);
bundle = replaceOnce(
    bundle,
    '(0,Q.jsx)(`span`,{children:`Service`}),(0,Q.jsx)(`span`,{className:`num`,children:BJ(ft)})',
    '(0,Q.jsx)(`span`,{children:serviceOn?`Service`:`Service (Nonaktif)`}),(0,Q.jsx)(`span`,{className:`num`,children:BJ(ft)})',
    'Label status service pada ringkasan',
);
const themeSetting = '(0,Q.jsxs)(`div`,{className:`flex items-center justify-between rounded-md border p-3`,children:[(0,Q.jsx)(`span`,{children:`Mode Dark / Light`}),(0,Q.jsx)(z3,{checked:a,onCheckedChange:o})]})';
const taxSetting = '(0,Q.jsxs)(`div`,{className:`flex items-center justify-between rounded-md border p-3`,children:[(0,Q.jsxs)(`div`,{children:[(0,Q.jsx)(`p`,{className:`font-medium`,children:`Aktifkan Pajak 10%`}),(0,Q.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:`Matikan agar pajak bernilai Rp 0 saat checkout.`})]}),(0,Q.jsx)(z3,{checked:taxOn,onCheckedChange:setTaxOn})]})';
const serviceSetting = '(0,Q.jsxs)(`div`,{className:`flex items-center justify-between rounded-md border p-3`,children:[(0,Q.jsxs)(`div`,{children:[(0,Q.jsx)(`p`,{className:`font-medium`,children:`Aktifkan Service`}),(0,Q.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:`Matikan agar service charge bernilai Rp 0 saat checkout.`})]}),(0,Q.jsx)(z3,{checked:serviceOn,onCheckedChange:setServiceOn})]})';
const popupSetting = '(0,Q.jsxs)(`div`,{className:`flex items-center justify-between rounded-md border p-3`,children:[(0,Q.jsx)(`span`,{children:`Popup Notification`}),(0,Q.jsx)(z3,{checked:Ae,onCheckedChange:je})]})';

bundle = replaceOptionalOnce(
    bundle,
    themeSetting + ',' + taxSetting + ',' + serviceSetting + ',' + taxSetting + ',' + serviceSetting + ',' + popupSetting,
    themeSetting + ',' + taxSetting + ',' + serviceSetting + ',' + popupSetting,
    'Hapus duplikasi sakelar pajak dan service',
);
bundle = replaceOnce(
    bundle,
    themeSetting + ',' + popupSetting,
    themeSetting + ',' + taxSetting + ',' + serviceSetting + ',' + popupSetting,
    'Sakelar pajak dan service di Pengaturan',
);

const originalSync = 'async function Nt(e=!1){try{let t=await j7();u(t.users),f(t.categories),m(t.products),c(t.tables),g(t.orders),x(t.transactions),y(t.timers),C(t.tableHistories),T(t.cashierShifts),D(t.backupLogs),k(t.activityLogs),e&&X.success(`Data berhasil disinkronkan dari server`)}catch(e){if(f7(e)){localStorage.removeItem(`mahjong_pos_user`),localStorage.removeItem(`mahjong_pos_token`),n(null),X.error(`Sesi login sudah tidak valid. Silakan login ulang.`);return}X.error(`Backend belum aktif. Jalankan BUKA-POS-BILLING.bat agar mode launching tersambung ke database.`)}}';
const resilientSync = 'async function Nt(e=!1){if(window.__mjStateSyncInFlight)return;window.__mjStateSyncInFlight=!0;try{let t=await j7();u(t.users),f(t.categories),m(t.products),c(t.tables),g(t.orders),x(t.transactions),y(t.timers),C(t.tableHistories),T(t.cashierShifts),D(t.backupLogs),k(t.activityLogs),window.__mjLastSyncErrorAt=0,e&&X.success(`Data berhasil disinkronkan dari server`)}catch(e){if(f7(e)){localStorage.removeItem(`mahjong_pos_user`),localStorage.removeItem(`mahjong_pos_token`),n(null),X.error(`Sesi login sudah tidak valid. Silakan login ulang.`);return}let t=Date.now();t-(window.__mjLastSyncErrorAt??0)>6e4&&(window.__mjLastSyncErrorAt=t,e?.response?.status===503?X.error(`Server sedang sibuk. Data terakhir tetap ditampilkan dan sinkronisasi akan dicoba kembali.`):X.error(`Koneksi ke server terganggu. Data terakhir tetap ditampilkan dan sinkronisasi akan dicoba kembali.`))}finally{window.__mjStateSyncInFlight=!1}}';

bundle = replaceOnce(bundle, originalSync, resilientSync, 'Sinkronisasi single-flight dan penanganan 503');
bundle = replaceOnce(
    bundle,
    'window.setInterval(()=>{Nt()},1e4)',
    'window.setInterval(()=>{Nt()},3e4)',
    'Interval polling 30 detik',
);
bundle = replaceOnce(
    bundle,
    'async function Pt(e,t,r){try{let i=await A7(e,t);n(i),r&&(localStorage.setItem(`mahjong_pos_user`,String(i.id)),localStorage.setItem(`mahjong_pos_remember`,i.username)),await Nt(),X.success(`Selamat datang, ${i.name}`)}catch{X.error(`Login backend gagal. Pastikan server Laravel dan database berjalan.`)}}',
    'async function Pt(e,t,r){try{let i=await A7(e,t);n(i),r&&(localStorage.setItem(`mahjong_pos_user`,String(i.id)),localStorage.setItem(`mahjong_pos_remember`,i.username)),await Nt(),X.success(`Selamat datang, ${i.name}`)}catch(e){X.error(b9(e,`Login gagal. Periksa username dan password.`))}}',
    'Pesan error login dari API',
);
bundle = replaceOptionalOnce(
    bundle,
    'async function It(){Qe.current.forEach(e=>e()),Qe.current.clear();try{await J7(),await Nt(),j(1),X.success(`Data transaksi, order aktif, timer, dan status meja sudah dimulai dari 0`)}catch(e){X.error(b9(e,`Reset data gagal. Tidak ada data lokal yang diubah.`))}}',
    'async function It(){Qe.current.forEach(e=>e()),Qe.current.clear();try{await J7(),await Nt(),j(1),X.success(`Data operasional berhasil direset. Semua meja kembali Available.`)}catch(e){X.error(b9(e,`Reset data gagal. Tidak ada data lokal yang diubah.`))}}',
    'Migrasi pesan reset operasional',
);
bundle = replaceOnce(
    bundle,
    'async function It(){Qe.current.forEach(e=>e()),Qe.current.clear();try{await J7(),await Nt()}catch{x([]),k([]),g([]),y([]),c(e=>e.map(e=>({...e,status:`Available`})))}finally{j(1),X.success(`Data transaksi, order aktif, timer, dan status meja sudah dimulai dari 0`)}}',
    'async function It(){Qe.current.forEach(e=>e()),Qe.current.clear();try{await J7(),await Nt(),j(1),X.success(`Data operasional berhasil direset. Semua meja kembali Available.`)}catch(e){X.error(b9(e,`Reset data gagal. Tidak ada data lokal yang diubah.`))}}',
    'Reset operasional fail-closed',
);
const checkoutWithoutTaxToggles = 'async function Jt(){if(!et||et.cart.length===0){X.error(`Keranjang masih kosong`);return}if(Sn&&!ht){X.error(`Buka shift dulu sebelum checkout`),ie(!0);return}if(M===`Cash`&&ge<mt){X.error(`Uang diterima kurang dari total tagihan`);return}let e=M===`Cash`?{received:ge,change:Math.max(0,ge-mt)}:void 0,n=B?window.open(``,`receipt-checkout`,`width=420,height=720`):null;B&&!n&&X.error(`Popup print diblokir browser. Izinkan popup untuk Mahjong Billing System.`);let a=P,u;try{u=await M7({tableId:K.id,cashierId:t?.id??et.cashierId,paymentMethod:M,items:et.cart,discount:a,serviceChargePercent:I}),await Nt()}catch(e){n?.close(),X.error(b9(e,`Checkout gagal. Transaksi tidak disimpan dan struk tidak dicetak.`));return}g(e=>e.filter(e=>e.id!==et.id)),c(e=>e.map(e=>e.id===K.id?{...e,status:`Occupied`}:e)),F(0),_e(0),Ot(`Checkout ${u.invoice} ${K.name}`,`Transaksi`),n&&At(n,u,R,e),X.success(`Checkout ${K.name} berhasil disimpan${n?` dan struk siap dicetak`:``}.`)}';
const checkoutWithTaxToggles = 'async function Jt(){if(!et||et.cart.length===0){X.error(`Keranjang masih kosong`);return}if(Sn&&!ht){X.error(`Buka shift dulu sebelum checkout`),ie(!0);return}if(M===`Cash`&&ge<mt){X.error(`Uang diterima kurang dari total tagihan`);return}let e=M===`Cash`?{received:ge,change:Math.max(0,ge-mt)}:void 0,n=B?window.open(``,`receipt-checkout`,`width=420,height=720`):null;B&&!n&&X.error(`Popup print diblokir browser. Izinkan popup untuk Mahjong Billing System.`);let a=P,u;try{u=await M7({tableId:K.id,cashierId:t?.id??et.cashierId,paymentMethod:M,items:et.cart,discount:a,serviceChargePercent:serviceOn?I:0,taxPercent:taxOn?10:0}),await Nt()}catch(e){n?.close(),X.error(b9(e,`Checkout gagal. Transaksi tidak disimpan dan struk tidak dicetak.`));return}g(e=>e.filter(e=>e.id!==et.id)),c(e=>e.map(e=>e.id===K.id?{...e,status:`Occupied`}:e)),F(0),_e(0),Ot(`Checkout ${u.invoice} ${K.name}`,`Transaksi`),n&&At(n,u,R,e),X.success(`Checkout ${K.name} berhasil disimpan${n?` dan struk siap dicetak`:``}.`)}';

bundle = replaceOptionalOnce(
    bundle,
    checkoutWithoutTaxToggles,
    checkoutWithTaxToggles,
    'Checkout mengikuti sakelar pajak dan service',
);
bundle = replaceOptionalOnce(
    bundle,
    'async function Jt(){if(!et||et.cart.length===0){X.error(`Keranjang masih kosong`);return}if(Sn&&!ht){X.error(`Buka shift dulu sebelum checkout`),ie(!0);return}if(M===`Cash`&&ge<mt){X.error(`Uang diterima kurang dari total tagihan`);return}let e=M===`Cash`?{received:ge,change:Math.max(0,ge-mt)}:void 0,n=B?window.open(``,`receipt-checkout`,`width=420,height=720`):null;B&&!n&&X.error(`Popup print diblokir browser. Izinkan popup untuk Mahjong Billing System.`);let r=new Date,i=dt,a=P,o=pt,s=ft,l=mt,u;try{u=await M7({tableId:K.id,cashierId:t?.id??et.cashierId,paymentMethod:M,items:et.cart,discount:a,serviceChargePercent:I}),await Nt()}catch{u={id:Math.max(0,...b.map(e=>e.id))+1,invoice:qt(r),tableId:K.id,cashierId:t?.id??et.cashierId,items:et.cart,subtotal:i,discount:a,tax:o,serviceCharge:s,grandTotal:l,paymentMethod:M,createdAt:r.toISOString()},x(e=>[u,...e]),m(e=>e.map(e=>{let t=et.cart.find(t=>t.productId===e.id);return t?{...e,stock:Math.max(0,e.stock-t.qty)}:e}));let e=et.cart.reduce((e,t)=>e+(p.find(e=>e.id===t.productId)?.durationMinutes??0)*t.qty,0);!tt&&e>0&&y(t=>[...t.filter(e=>e.tableId!==K.id),{id:Math.max(0,...t.map(e=>e.id))+1,tableId:K.id,durationMinutes:e,startedAt:r.toISOString(),endsAt:new Date(r.getTime()+e*6e4).toISOString(),reminderIntervalMinutes:5,acknowledged:!1}])}g(e=>e.filter(e=>e.id!==et.id)),c(e=>e.map(e=>e.id===K.id?{...e,status:`Occupied`}:e)),F(0),_e(0),Ot(`Checkout ${u.invoice} ${K.name}`,`Transaksi`),n&&At(n,u,R,e),X.success(`Checkout & cetak ${K.name} berhasil. Timer meja berjalan sekarang.`)}',
    checkoutWithTaxToggles,
    'Checkout fail-closed',
);
bundle = replaceOnce(
    bundle,
    'async function Qt(e){let t=ce.trim()||window.prompt(`Alasan void transaksi?`)||``;if(t.trim()){try{await z7(e.id,t),await Nt(),X.success(`Transaksi ${e.invoice} berhasil di-void`)}catch{x(n=>n.map(n=>n.id===e.id?{...n,status:`cancelled`,voidReason:t}:n)),X.success(`Transaksi ${e.invoice} ditandai void secara lokal`)}le(``)}}',
    'async function Qt(e){let t=ce.trim()||window.prompt(`Alasan void transaksi?`)||``;if(t.trim()){try{await z7(e.id,t),await Nt(),X.success(`Transaksi ${e.invoice} berhasil di-void`)}catch(n){X.error(b9(n,`Void gagal. Transaksi tidak diubah.`));return}le(``)}}',
    'Void fail-closed',
);
bundle = replaceOnce(
    bundle,
    'async function $t(e){let t=ue>0?ue:Number(window.prompt(`Nominal refund?`)??0),n=ce.trim()||window.prompt(`Alasan refund?`)||``;if(!(!t||!n.trim())){try{await B7(e.id,t,n),await Nt(),X.success(`Refund ${e.invoice} berhasil dicatat`)}catch{x(r=>r.map(r=>r.id===e.id?{...r,refundAmount:t,refundReason:n}:r)),X.success(`Refund ${e.invoice} dicatat secara lokal`)}de(0),le(``)}}',
    'async function $t(e){let t=ue>0?ue:Number(window.prompt(`Nominal refund?`)??0),n=ce.trim()||window.prompt(`Alasan refund?`)||``;if(!(!t||!n.trim())){try{await B7(e.id,t,n),await Nt(),X.success(`Refund ${e.invoice} berhasil dicatat`)}catch(r){X.error(b9(r,`Refund gagal. Transaksi tidak diubah.`));return}de(0),le(``)}}',
    'Refund fail-closed',
);
bundle = replaceOnce(
    bundle,
    'async function p7(e,t,n){try{await d7.patch(`/tables/${e}/position`,{position_x:t,position_y:n})}catch{localStorage.setItem(`table_position_${e}`,JSON.stringify({x:t,y:n}))}}',
    'async function p7(e,t,n){await d7.patch(`/tables/${e}/position`,{position_x:t,position_y:n})}',
    'Penyimpanan posisi meja tanpa klaim lokal',
);
bundle = replaceOnce(
    bundle,
    'function Lt(e){let{active:t,delta:n}=e,r=Number(t.id);c(e=>e.map(e=>{if(e.id!==r)return e;let t={...e,x:Math.max(10,Math.round(e.x+n.x)),y:Math.max(10,Math.round(e.y+n.y))};return p7(r,t.x,t.y),t})),X.success(`Posisi meja tersimpan otomatis`)}',
    'async function Lt(e){let{active:t,delta:n}=e,r=Number(t.id),i=s.find(e=>e.id===r);if(!i)return;let a={...i,x:Math.max(10,Math.round(i.x+n.x)),y:Math.max(10,Math.round(i.y+n.y))};c(e=>e.map(e=>e.id===r?a:e));try{await p7(r,a.x,a.y),X.success(`Posisi ${a.name} berhasil disimpan di server.`)}catch(e){c(t=>t.map(e=>e.id===r?i:e)),X.error(b9(e,`Posisi meja gagal disimpan. Posisi sebelumnya dipulihkan.`))}}',
    'Pesan penyimpanan posisi meja',
);
bundle = replaceOnce(
    bundle,
    'async function Ut(e,n,r=`Open`){try{let i=await N7({tableId:e,cashierId:t?.id??3,items:n,status:r===`Hold`?`Hold`:`Open`});g(t=>t.some(t=>t.tableId===e)?t.map(t=>t.tableId===e?i:t):[...t,i])}catch{}}',
    'async function Ut(e,n,r=`Open`){try{let i=await N7({tableId:e,cashierId:t?.id??3,items:n,status:r===`Hold`?`Hold`:`Open`});g(t=>t.some(t=>t.tableId===e)?t.map(t=>t.tableId===e?i:t):[...t,i])}catch(e){X.error(b9(e,`Order gagal disimpan ke server. Perubahan lokal akan dipulihkan.`)),await Nt()}}',
    'Pesan kegagalan penyimpanan order',
);
bundle = replaceOnce(
    bundle,
    'async function Xt(){if(!tt&&K.status!==`Occupied`&&K.status!==`Time Expired`){X.error(`Table ini belum aktif`);return}try{tt?await L7(tt.id):await W7(K.id,`Available`),await Nt()}catch{y(e=>e.filter(e=>e.tableId!==K.id)),c(e=>e.map(e=>e.id===K.id?{...e,status:`Available`}:e))}g(e=>e.filter(e=>e.tableId!==K.id)),Ot(`Selesaikan ${K.name}`,`Timer`),X.success(`${K.name} selesai lebih awal dan kembali Available`)}',
    'async function Xt(){if(!tt&&K.status!==`Occupied`&&K.status!==`Time Expired`){X.error(`Meja ini belum memiliki sesi aktif.`);return}try{tt?await L7(tt.id):await W7(K.id,`Available`),await Nt()}catch(e){X.error(b9(e,`Sesi meja gagal diselesaikan. Status meja tidak diubah.`));return}g(e=>e.filter(e=>e.tableId!==K.id)),Ot(`Selesaikan ${K.name}`,`Timer`),X.success(`Sesi ${K.name} berhasil diselesaikan. Status meja kembali Available.`)}',
    'Penyelesaian sesi meja fail-closed',
);
bundle = replaceOnce(
    bundle,
    'async function Zt(e){if(!tt){X.error(`Timer belum aktif`);return}try{let t=await R7(tt.id,e);y(e=>e.map(e=>e.id===t.id?t:e)),await Nt()}catch{y(t=>t.map(t=>t.id===tt.id?{...t,durationMinutes:t.durationMinutes+e,endsAt:new Date(new Date(t.endsAt).getTime()+e*6e4).toISOString(),acknowledged:!1}:t))}X.success(`Timer ${K.name} ditambah ${VJ(e)}`)}',
    'async function Zt(e){if(!tt){X.error(`Timer meja belum aktif.`);return}try{let t=await R7(tt.id,e);y(e=>e.map(e=>e.id===t.id?t:e)),await Nt()}catch(t){X.error(b9(t,`Penambahan waktu gagal. Timer tidak diubah.`));return}X.success(`Waktu ${K.name} berhasil ditambah ${VJ(e)}.`)}',
    'Penambahan waktu fail-closed',
);
bundle = replaceOnce(
    bundle,
    'X.info(`Order ${K.name} dibatalkan`)',
    'X.info(`Order ${K.name} berhasil dibatalkan di server.`)',
    'Pesan pembatalan order',
);
bundle = replaceOnce(
    bundle,
    'X.info(`Order disimpan sebagai hold`)',
    'X.info(`Status Hold dipilih dan sedang disimpan ke server.`)',
    'Pesan status Hold',
);
bundle = replaceOptionalOnce(
    bundle,
    'X.info(`${e.name} ditambahkan. Pilih metode bayar lalu Checkout & Cetak.`)',
    'X.info(`${e.name} ditambahkan ke keranjang. Selesaikan checkout untuk mengaktifkan waktunya.`)',
    'Pesan penambahan paket waktu',
);
bundle = replaceOptionalOnce(
    bundle,
    'function rn(){let e=p.length+1;m(t=>[{id:e,sku:`NEW-${e}`,barcode:`8991002${String(e).padStart(5,`0`)}`,name:`Produk Baru ${e}`,photo:`/placeholder-product.svg`,categoryId:2,costPrice:1e4,sellPrice:25e3,stock:12,trackStock:!0,active:!0},...t]),X.info(`Draft produk contoh dibuat. Lengkapi datanya lalu tekan Simpan.`)}function on(e){Ve({...e}),ze(!0)}',
    'function rn(){Ve({id:-Date.now(),sku:``,barcode:``,name:``,photo:`/placeholder-product.svg`,categoryId:d.find(e=>e.active)?.id??d[0]?.id??0,costPrice:0,sellPrice:`0.00`,stock:0,trackStock:!0,active:!0}),ze(!0)}function on(e){Ve({...e,sellPrice:Number(e.sellPrice).toFixed(2)}),ze(!0)}',
    'Migrasi draft produk lokal',
);
bundle = replaceOnce(
    bundle,
    'function rn(){let e=p.length+1;m(t=>[{id:e,sku:`NEW-${e}`,barcode:`8991002${String(e).padStart(5,`0`)}`,name:`Produk Baru ${e}`,photo:`/placeholder-product.svg`,categoryId:2,costPrice:1e4,sellPrice:25e3,stock:12,trackStock:!0,active:!0},...t]),X.success(`Produk sample ditambahkan`)}function on(e){Ve({...e}),ze(!0)}',
    'function rn(){Ve({id:-Date.now(),sku:``,barcode:``,name:``,photo:`/placeholder-product.svg`,categoryId:d.find(e=>e.active)?.id??d[0]?.id??0,costPrice:0,sellPrice:`0.00`,stock:0,trackStock:!0,active:!0}),ze(!0)}function on(e){Ve({...e,sellPrice:Number(e.sellPrice).toFixed(2)}),ze(!0)}',
    'Alur penambahan produk melalui modal dan POST',
);
bundle = replaceOnce(
    bundle,
    'onClick:()=>X.success(`Password ${e.name} direset ke: password`)',
    'onClick:()=>X.info(`Gunakan tombol Edit, isi password baru, lalu tekan Simpan untuk mereset password ${e.name}.`)',
    'Panduan reset password pada menu User',
);
bundle = replaceOnce(
    bundle,
    'onClick:()=>X.info(`Reset password diproses dari menu User oleh Super Admin`)',
    'onClick:()=>X.info(`Hubungi Super Admin untuk mengatur ulang password melalui menu User.`)',
    'Panduan reset password pada halaman Login',
);
bundle = replaceOnce(
    bundle,
    'async function en(){if(yt){X.error(`Shift hari ini sudah penuh (maksimal 2 shift per hari).`);return}try{let e=await V7(H);T(t=>[e,...t]),ie(!1),X.success(`Shift ${e.shiftNumber} kasir dibuka`)}catch{X.error(`Shift tidak dapat dibuka. Mungkin sudah ada shift aktif atau kuota harian sudah penuh.`)}}',
    'async function en(){if(yt){X.error(`Shift hari ini sudah penuh (maksimal 2 shift per hari).`);return}try{let e=await V7(H);T(t=>[e,...t]),ie(!1),X.success(`Shift ${e.shiftNumber} berhasil dibuka.`)}catch(e){X.error(b9(e,`Shift gagal dibuka.`))}}',
    'Pesan buka shift',
);
bundle = replaceOnce(
    bundle,
    'async function tn(){if(!ht){X.error(`Belum ada shift aktif`);return}try{let e=await H7(ht.id,ee);T(t=>t.map(t=>t.id===e.id?e:t)),ne(!1),X.success(`Shift kasir ditutup`)}catch{X.error(`Shift tidak dapat ditutup`)}}',
    'async function tn(){if(!ht){X.error(`Tidak ada shift aktif yang dapat ditutup.`);return}try{let e=await H7(ht.id,ee);T(t=>t.map(t=>t.id===e.id?e:t)),ne(!1),X.success(`Shift berhasil ditutup dan kas telah direkonsiliasi.`)}catch(e){X.error(b9(e,`Shift gagal ditutup.`))}}',
    'Pesan tutup shift',
);
bundle = replaceOnce(
    bundle,
    'async function nn(){try{let e=await U7();D(t=>[e,...t]),X.success(`Backup dibuat: ${e.filename}`)}catch{X.error(`Backup gagal dibuat. Pastikan backend dan database aktif.`)}}',
    'async function nn(){try{let e=await U7();D(t=>[e,...t]),X.success(`Backup database berhasil dibuat: ${e.filename}`)}catch(e){X.error(b9(e,`Backup database gagal dibuat.`))}}',
    'Pesan backup database',
);

bundle = replaceOnce(
    bundle,
    'async function Bt(){try{await G7(K),await Nt(),X.success(`${K.name} disimpan`)}catch{X.error(`Gagal menyimpan. Pastikan nomor meja unik.`)}}',
    'async function Bt(){try{await G7(K),await Nt(),X.success(`Perubahan ${K.name} berhasil disimpan di server.`)}catch(e){X.error(b9(e,`Perubahan meja gagal disimpan.`))}}',
    'Pesan penyimpanan data meja',
);
bundle = replaceOptionalOnce(
    bundle,
    'async function Vt(){let e=new Set(s.map(e=>e.number)),t=s.length+1;for(;e.has(String(t));)t+=1;try{let e=await K7({name:`Meja ${t}`,number:String(t),x:24,y:24});await Nt(),j(e.id),X.success(`${e.name} ditambahkan. Geser ke posisi yang diinginkan.`)}catch{X.error(`Gagal menambah meja`)}}',
    'async function Vt(){let e=new Set(s.map(e=>e.number)),t=s.length+1;for(;e.has(String(t));)t+=1;try{let e=await K7({name:`Meja ${t}`,number:String(t),x:24,y:24});await Nt(),j(e.id),X.success(`${e.name} berhasil dibuat di server. Geser untuk mengatur posisinya.`)}catch(e){X.error(b9(e,`Meja baru gagal dibuat.`))}}',
    'Pesan penambahan meja',
);
bundle = replaceOnce(
    bundle,
    'async function Ht(){try{await q7(K.id),await Nt(),se(!1),j(e=>s.filter(e=>e.id!==K.id)[0]?.id??e),X.success(`Meja dihapus`)}catch(e){let t=e?.response?.data?.message;X.error(t??`Meja tidak bisa dihapus (mungkin sudah punya transaksi).`)}}',
    'async function Ht(){try{await q7(K.id),await Nt(),se(!1),j(e=>s.filter(e=>e.id!==K.id)[0]?.id??e),X.success(`${K.name} berhasil dihapus dari server.`)}catch(e){X.error(b9(e,`Meja gagal dihapus. Meja yang sudah memiliki transaksi tidak dapat dihapus.`))}}',
    'Pesan penghapusan meja',
);
bundle = replaceOnce(
    bundle,
    'async function Yt(){if(!et){X.error(`Belum ada order aktif`);return}try{await P7(K.id),await Nt()}catch{X.error(`Gagal membatalkan order`);return}g(e=>e.filter(e=>e.tableId!==K.id)),F(0),Ot(`Batal order ${K.name}`,`POS`),X.info(`Order ${K.name} berhasil dibatalkan di server.`)}',
    'async function Yt(){if(!et){X.error(`Tidak ada order aktif yang dapat dibatalkan.`);return}try{await P7(K.id),await Nt()}catch(e){X.error(b9(e,`Order gagal dibatalkan. Data tidak diubah.`));return}g(e=>e.filter(e=>e.tableId!==K.id)),F(0),Ot(`Batal order ${K.name}`,`POS`),X.info(`Order ${K.name} berhasil dibatalkan di server.`)}',
    'Pesan kegagalan pembatalan order',
);
bundle = replaceOnce(
    bundle,
    'X.success(`Kategori berhasil disimpan`)',
    'X.success(`Kategori berhasil disimpan di server.`)',
    'Pesan sukses kategori',
);
bundle = replaceOnce(
    bundle,
    'onClick:()=>X.info(`Hubungi Super Admin untuk mengatur ulang password melalui menu User.`),children:`Reset Password`',
    'onClick:()=>X.info(`Hubungi Super Admin untuk mengatur ulang password melalui menu User.`),children:`Lupa Password?`',
    'Label bantuan password pada Login',
);
bundle = replaceOnce(
    bundle,
    'onClick:()=>X.info(`Gunakan tombol Edit, isi password baru, lalu tekan Simpan untuk mereset password ${e.name}.`),children:`Reset Password`',
    'onClick:()=>X.info(`Gunakan tombol Edit, isi password baru, lalu tekan Simpan untuk mereset password ${e.name}.`),children:`Cara Reset`',
    'Label panduan reset pada menu User',
);
bundle = replaceOnce(
    bundle,
    'Tambah, edit, hapus, reset password, role dan hak akses. Fitur edit hanya untuk Super Admin.',
    'Kelola nama, username, password, role, dan status user. Perubahan hanya dapat dilakukan oleh Super Admin.',
    'Deskripsi halaman User',
);
bundle = replaceOptionalOnce(
    bundle,
    'Nama, username, role, dan status wajib diisi. Password wajib untuk user baru; saat edit boleh dikosongkan jika tidak berubah.',
    'Nama, username, role, dan status wajib diisi. Password minimal 8 karakter bila diisi; saat edit boleh dikosongkan jika tidak berubah.',
    'Migrasi deskripsi modal User',
);
bundle = replaceOnce(
    bundle,
    'Field wajib: nama, username, password, role, status aktif/nonaktif.',
    'Nama, username, role, dan status wajib diisi. Password minimal 8 karakter bila diisi; saat edit boleh dikosongkan jika tidak berubah.',
    'Deskripsi modal User',
);
bundle = replaceOptionalOnce(
    bundle,
    'children:`Data Produk`}),(0,Q.jsx)(ZQ,{children:`Lengkapi data produk, lalu tekan Simpan Produk untuk menyimpannya ke server.`',
    'children:Be&&p.some(e=>e.id===Be.id)?`Edit Produk`:`Tambah Produk`}),(0,Q.jsx)(ZQ,{children:`Lengkapi data produk, lalu tekan Simpan Produk untuk menyimpannya ke server.`',
    'Migrasi judul modal Produk',
);
bundle = replaceOnce(
    bundle,
    'children:`Edit Produk`}),(0,Q.jsx)(ZQ,{children:`Admin dan Super Admin dapat memperbarui data produk yang sudah ada.`',
    'children:Be&&p.some(e=>e.id===Be.id)?`Edit Produk`:`Tambah Produk`}),(0,Q.jsx)(ZQ,{children:`Lengkapi data produk, lalu tekan Simpan Produk untuk menyimpannya ke server.`',
    'Judul dan deskripsi modal Produk',
);
bundle = replaceOnce(
    bundle,
    '`Selesaikan Table`',
    '`Selesaikan Meja`',
    'Label penyelesaian meja',
);
bundle = replaceOnce(
    bundle,
    'children:`Pengaturan lokal untuk operasional LAN.`',
    'children:`Pengaturan operasional aplikasi dan perangkat kasir.`',
    'Deskripsi pengaturan sistem',
);
bundle = replaceOnce(
    bundle,
    'Mengosongkan transaksi, order aktif, timer, laporan, dan mengembalikan semua meja ke Available.',
    'Menghapus transaksi, pembayaran, order aktif, timer, dan riwayat meja; seluruh meja dikembalikan ke Available. Shift dan log aktivitas tetap disimpan.',
    'Deskripsi reset data operasional',
);
bundle = replaceOnce(
    bundle,
    'children:`Backup Database Lokal`',
    'children:`Backup Database`',
    'Judul backup database',
);
bundle = replaceOnce(
    bundle,
    'File backup disimpan di folder backend/storage/app/backups.',
    'File SQL disimpan oleh server di backend/storage/app/private/backups.',
    'Lokasi file backup',
);
bundle = replaceOnce(
    bundle,
    'Perhatian, waktu penggunaan Table A01 akan berakhir dalam 10 menit',
    'Perhatian, waktu penggunaan Meja A01 akan berakhir dalam 10 menit',
    'Contoh pesan alarm meja',
);

bundle = replaceOnce(
    bundle,
    'function x7(e){let t=e.photo?String(e.photo):``;return{id:Number(e.id),sku:String(e.sku??``),barcode:String(e.barcode??``),name:String(e.name??``),photo:t?`${d7.defaults.baseURL?.replace(`/api`,``)}/storage/${t}`:`/placeholder-product.svg`,categoryId:Number(e.category_id),costPrice:Number(e.cost_price),sellPrice:Number(e.sell_price),stock:Number(e.stock),trackStock:!!(e.track_stock??!0),durationMinutes:e.duration_minutes?Number(e.duration_minutes):0,active:!!e.is_active}}',
    'function x7(e){let t=e.photo?String(e.photo):``;return t=t.includes(`placeholder-product.svg`)?`/placeholder-product.svg`:t.includes(`products/`)?`/storage/products/${t.split(`products/`).pop()}`:/^https?:\\/\\//.test(t)||t.startsWith(`/storage/`)?t:t?`/storage/${t.replace(/^\\/+/,``)}`:`/placeholder-product.svg`,{id:Number(e.id),sku:String(e.sku??``),barcode:String(e.barcode??``),name:String(e.name??``),photo:t,categoryId:Number(e.category_id),costPrice:Number(e.cost_price),sellPrice:Number(e.sell_price),stock:Number(e.stock),trackStock:!!(e.track_stock??!0),active:!!e.is_active}}',
    'Normalisasi URL foto produk',
);
bundle = replaceOnce(
    bundle,
    'photo:e.photo?.startsWith(`data:`)?null:e.photo,cost_price:e.costPrice',
    'photo:e.photo?.startsWith(`data:`)||e.photo?.includes(`placeholder-product.svg`)?null:e.photo?.includes(`products/`)?`products/${e.photo.split(`products/`).pop()}`:e.photo,cost_price:e.costPrice',
    'Normalisasi path foto saat produk disimpan',
);
bundle = replaceOptionalOnce(
    bundle,
    'dt=ut.reduce((e,t)=>e+t.total,0),ft=serviceOn?Math.round(Math.max(0,dt-P)*(I/100)):0,pt=taxOn?Math.round(Math.max(0,dt-P)*.1):0,mt=Math.max(0,dt-P+pt+ft)',
    'dt=ut.reduce((e,t)=>e+t.total,0),pt=taxOn?Math.round(Math.max(0,dt-P)*.1):0,ft=serviceOn?Math.round((Math.max(0,dt-P)+pt)*(I/100)):0,mt=Math.max(0,Math.round(dt-P+pt+ft))',
    'Service dihitung setelah pajak dan grand total dibulatkan',
);
bundle = replaceOptionalOnce(
    bundle,
    'a=taxOn?Math.round(i*.1):0,o=serviceOn?Math.round(i*(I/100)):0;',
    'a=taxOn?Math.round(i*.1):0,o=serviceOn?Math.round((i+a)*(I/100)):0;',
    'Rumus service pada test print',
);
bundle = replaceOptionalOnce(
    bundle,
    'grandTotal:i+a+o,paymentMethod:M',
    'grandTotal:Math.round(i+a+o),paymentMethod:M',
    'Pembulatan grand total pada test print',
);

bundle = replaceOnce(
    bundle,
    'trackStock:!!(e.track_stock??!0),durationMinutes:e.duration_minutes?Number(e.duration_minutes):0,active:!!e.is_active',
    'trackStock:!!(e.track_stock??!0),active:!!e.is_active',
    'Hapus durasi dari model frontend produk',
);
bundle = replaceOnce(
    bundle,
    'function S7(e){return{id:Number(e.id),name:String(e.name??``),number:String(e.number??``),x:Number(e.position_x),y:Number(e.position_y),status:g7(String(e.status??`available`)),notes:String(e.notes??``)}}',
    'function S7(e){return{id:Number(e.id),name:String(e.name??``),number:String(e.number??``),x:Number(e.position_x),y:Number(e.position_y),status:g7(String(e.status??`available`)),durationMinutes:Math.max(1,Number(e.duration_minutes??60)),notes:String(e.notes??``)}}',
    'Durasi pada model frontend meja',
);
bundle = replaceOnce(
    bundle,
    'function D7(e){return{id:Number(e.id),tableId:Number(e.table_id),transactionId:e.transaction_id?Number(e.transaction_id):void 0,cashierId:e.cashier_id?Number(e.cashier_id):void 0,startedAt:e.started_at?String(e.started_at):void 0,endedAt:e.ended_at?String(e.ended_at):void 0,durationMinutes:Number(e.duration_minutes??0),status:String(e.status??``),notes:e.notes?String(e.notes):void 0}}',
    'function D7(e){let t=l7(e.items??c7(e.transaction).details).map(e=>{let t=c7(e.product);return{productId:Number(e.product_id??e.productId??0),sku:String(e.sku??t.sku??``),name:String(e.name??t.name??`Produk`),qty:Number(e.qty??0)}});return{id:Number(e.id),tableId:Number(e.table_id),transactionId:e.transaction_id?Number(e.transaction_id):void 0,cashierId:e.cashier_id?Number(e.cashier_id):void 0,startedAt:e.started_at?String(e.started_at):void 0,endedAt:e.ended_at?String(e.ended_at):void 0,durationMinutes:Number(e.duration_minutes??0),items:t,status:String(e.status??``),notes:e.notes?String(e.notes):void 0}}',
    'Produk pada model frontend riwayat meja',
);
bundle = replaceOnce(
    bundle,
    'async function M7(e){let{data:t}=await d7.post(`/transactions/checkout`,{table_id:e.tableId,cashier_id:e.cashierId,payment_method:v7(e.paymentMethod),discount:e.discount??0,tax_percent:e.taxPercent,service_charge:e.serviceCharge,service_charge_percent:e.serviceChargePercent,duration_minutes:e.durationMinutes,reminder_interval_minutes:e.reminderIntervalMinutes,items:e.items.map(e=>({product_id:e.productId,qty:e.qty,discount:e.discount??0}))});return C7(t)}',
    'async function M7(e){let{data:t}=await d7.post(`/transactions/checkout`,{table_id:e.tableId,cashier_id:e.cashierId,payment_method:v7(e.paymentMethod),discount:e.discount??0,tax_percent:e.taxPercent,service_charge:e.serviceCharge,service_charge_percent:e.serviceChargePercent,reminder_interval_minutes:e.reminderIntervalMinutes,items:e.items.map(e=>({product_id:e.productId,qty:e.qty,discount:e.discount??0}))});return C7(t)}',
    'Checkout tanpa durasi produk',
);
bundle = replaceOnce(
    bundle,
    'async function G7(e){let{data:t}=await d7.patch(`/tables/${e.id}`,{name:e.name,number:e.number,status:_7(e.status),notes:e.notes??``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}async function K7(e){let{data:t}=await d7.post(`/tables`,{name:e.name,number:e.number,status:`available`,notes:``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}',
    'async function G7(e){let{data:t}=await d7.patch(`/tables/${e.id}`,{name:e.name,number:e.number,status:_7(e.status),duration_minutes:Math.max(1,Number(e.durationMinutes??60)),notes:e.notes??``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}async function K7(e){let{data:t}=await d7.post(`/tables`,{name:e.name,number:e.number,status:`available`,duration_minutes:Math.max(1,Number(e.durationMinutes??60)),notes:``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}',
    'Simpan durasi per meja',
);
bundle = replaceOnce(
    bundle,
    'async function X7(e,t=!0){let n={category_id:e.categoryId,sku:e.sku,barcode:e.barcode,name:e.name,photo:e.photo?.startsWith(`data:`)||e.photo?.includes(`placeholder-product.svg`)?null:e.photo?.includes(`products/`)?`products/${e.photo.split(`products/`).pop()}`:e.photo,cost_price:e.costPrice,sell_price:e.sellPrice,stock:e.stock,track_stock:e.trackStock,duration_minutes:e.durationMinutes&&e.durationMinutes>0?e.durationMinutes:null,is_active:e.active},{data:r}=await(t?d7.patch(`/products/${e.id}`,n):d7.post(`/products`,n));return x7(r)}',
    'async function X7(e,t=!0){let n={category_id:e.categoryId,sku:e.sku,barcode:e.barcode,name:e.name,photo:e.photo?.startsWith(`data:`)||e.photo?.includes(`placeholder-product.svg`)?null:e.photo?.includes(`products/`)?`products/${e.photo.split(`products/`).pop()}`:e.photo,cost_price:e.costPrice,sell_price:e.sellPrice,stock:e.stock,track_stock:e.trackStock,is_active:e.active},{data:r}=await(t?d7.patch(`/products/${e.id}`,n):d7.post(`/products`,n));return x7(r)}',
    'Simpan produk tanpa durasi',
);
bundle = replaceOnce(
    bundle,
    'costPrice:0,sellPrice:`0.00`,stock:0,trackStock:!0,durationMinutes:0,active:!0',
    'costPrice:0,sellPrice:`0.00`,stock:0,trackStock:!0,active:!0',
    'Produk baru tanpa durasi',
);
bundle = replaceOnce(
    bundle,
    ',Cn=p.filter(e=>e.active&&(e.durationMinutes??0)>0),Tn=p.filter',
    ',Tn=p.filter',
    'Hapus filter paket waktu produk',
);
bundle = replaceOnce(
    bundle,
    'Tn.filter(e=>me===`all`||e.categoryId===me).map(e=>{let t=(e.durationMinutes??0)>0;return',
    'Tn.filter(e=>me===`all`||e.categoryId===me).map(e=>{return',
    'Kartu produk tanpa status paket waktu',
);
bundle = replaceOnce(
    bundle,
    'children:t?VJ(e.durationMinutes??0):e.trackStock?`Stok ${e.stock}`:`Stok tak terbatas`',
    'children:e.trackStock?`Stok ${e.stock}`:`Stok tak terbatas`',
    'Label kartu produk tanpa durasi',
);
bundle = replaceOnce(
    bundle,
    'children:t?(0,Q.jsx)(_m,{className:`h-5 w-5`}):(0,Q.jsx)(fm,{className:`h-5 w-5`})',
    'children:(0,Q.jsx)(fm,{className:`h-5 w-5`})',
    'Ikon produk tanpa indikator waktu',
);
bundle = replaceOnce(
    bundle,
    '(0,Q.jsxs)(`div`,{className:`flex flex-col gap-2`,children:[(0,Q.jsx)(r$,{htmlFor:`product-duration`,children:`Durasi Paket Waktu (menit)`}),(0,Q.jsx)(QQ,{id:`product-duration`,type:`number`,min:0,placeholder:`0 = bukan paket waktu`,value:Be.durationMinutes??0,onChange:e=>Ve({...Be,durationMinutes:Math.max(0,Number(e.target.value)||0)})}),(0,Q.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:`Isi mis. 60 untuk "Sewa 1 Jam". Menjual produk ini akan memulai/menambah timer meja sesuai menit ini.`})]})',
    '',
    'Hapus input durasi produk',
);
const tableNumberField = '(0,Q.jsxs)(`div`,{className:`flex flex-col gap-2`,children:[(0,Q.jsx)(r$,{htmlFor:`table-number`,children:`Nomor meja`}),(0,Q.jsx)(QQ,{id:`table-number`,value:K.number,onChange:e=>zt({number:e.target.value})})]})';
const tableDurationField = '(0,Q.jsxs)(`div`,{className:`flex flex-col gap-2`,children:[(0,Q.jsx)(r$,{htmlFor:`table-duration`,children:`Durasi meja (menit)`}),(0,Q.jsx)(QQ,{id:`table-duration`,type:`number`,min:1,max:1440,value:K.durationMinutes??60,onChange:e=>zt({durationMinutes:Math.max(1,Number(e.target.value)||1)})}),(0,Q.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:`Timer sesi baru pada meja ini memakai durasi tersebut.`})]})';

bundle = replaceOptionalOnce(
    bundle,
    `${tableNumberField},${tableDurationField},${tableDurationField}`,
    `${tableNumberField},${tableDurationField}`,
    'Hapus duplikasi input durasi meja',
);

if (! bundle.includes('id:`table-duration`')) {
    bundle = replaceOnce(
        bundle,
        tableNumberField,
        `${tableNumberField},${tableDurationField}`,
        'Input durasi pada pengaturan meja',
    );
} else {
    console.log('Input durasi pada pengaturan meja: sudah diterapkan');
}
bundle = replaceOnce(
    bundle,
    'let e=await K7({name:`Meja ${t}`,number:String(t),x:24,y:24})',
    'let e=await K7({name:`Meja ${t}`,number:String(t),durationMinutes:60,x:24,y:24})',
    'Durasi awal meja baru',
);
bundle = replaceOptionalOnce(
    bundle,
    'Klik Simpan agar perubahan nama/nomor/catatan tersimpan ke database.',
    'Klik Simpan agar nama, nomor, durasi, dan catatan meja tersimpan ke database.',
    'Petunjuk penyimpanan durasi meja',
);
bundle = replaceOnce(
    bundle,
    '(0,Q.jsx)(W3,{children:`Table`}),(0,Q.jsx)(W3,{children:`Kasir`}),(0,Q.jsx)(W3,{children:`Mulai`})',
    '(0,Q.jsx)(W3,{children:`Table`}),(0,Q.jsx)(W3,{children:`Kasir`}),(0,Q.jsx)(W3,{children:`Produk`}),(0,Q.jsx)(W3,{children:`Mulai`})',
    'Kolom produk pada header riwayat meja',
);
bundle = replaceOnce(
    bundle,
    '(0,Q.jsx)(G3,{children:l.find(t=>t.id===e.cashierId)?.name??`-`}),(0,Q.jsx)(G3,{className:`num`,children:e.startedAt?',
    '(0,Q.jsx)(G3,{children:l.find(t=>t.id===e.cashierId)?.name??`-`}),(0,Q.jsx)(G3,{className:`max-w-[280px] whitespace-normal`,children:e.items?.length?e.items.map(e=>`${e.name} ×${e.qty}`).join(`, `):`-`}),(0,Q.jsx)(G3,{className:`num`,children:e.startedAt?',
    'Isi produk pada riwayat meja',
);
bundle = replaceOnce(
    bundle,
    'colSpan:6,className:`py-6 text-center text-sm text-muted-foreground`,children:[`Tidak ada riwayat`',
    'colSpan:7,className:`py-6 text-center text-sm text-muted-foreground`,children:[`Tidak ada riwayat`',
    'Lebar status kosong riwayat meja',
);
bundle = replaceOptionalOnce(
    bundle,
    'var v9={password:`Password`,username:`Username`,name:`Nama`,role_id:`Role`,status:`Status`,sku:`SKU`,barcode:`Barcode`,sell_price:`Harga jual`,cost_price:`Harga modal`,stock:`Stok`,category_id:`Kategori`,duration_minutes:`Durasi`,number:`Nomor meja`}',
    'var v9={password:`Password`,username:`Username`,name:`Nama`,role_id:`Role`,status:`Status`,sku:`SKU`,barcode:`Barcode`,sell_price:`Harga jual`,cost_price:`Harga modal`,stock:`Stok`,category_id:`Kategori`,duration_minutes:`Durasi meja`,number:`Nomor meja`}',
    'Label validasi durasi meja',
);

// Durasi sesi ditentukan kasir ketika membuka meja dari Outlet.
bundle = replaceOnce(
    bundle,
    'function S7(e){return{id:Number(e.id),name:String(e.name??``),number:String(e.number??``),x:Number(e.position_x),y:Number(e.position_y),status:g7(String(e.status??`available`)),durationMinutes:Math.max(1,Number(e.duration_minutes??60)),notes:String(e.notes??``)}}',
    'function S7(e){return{id:Number(e.id),name:String(e.name??``),number:String(e.number??``),x:Number(e.position_x),y:Number(e.position_y),status:g7(String(e.status??`available`)),notes:String(e.notes??``)}}',
    'Hapus durasi dari model frontend meja',
);
bundle = replaceOnce(
    bundle,
    'async function G7(e){let{data:t}=await d7.patch(`/tables/${e.id}`,{name:e.name,number:e.number,status:_7(e.status),duration_minutes:Math.max(1,Number(e.durationMinutes??60)),notes:e.notes??``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}async function K7(e){let{data:t}=await d7.post(`/tables`,{name:e.name,number:e.number,status:`available`,duration_minutes:Math.max(1,Number(e.durationMinutes??60)),notes:``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}',
    'async function G7(e){let{data:t}=await d7.patch(`/tables/${e.id}`,{name:e.name,number:e.number,status:_7(e.status),notes:e.notes??``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}async function K7(e){let{data:t}=await d7.post(`/tables`,{name:e.name,number:e.number,status:`available`,notes:``,position_x:Math.max(0,Math.round(e.x)),position_y:Math.max(0,Math.round(e.y))});return S7(t)}',
    'Meja disimpan tanpa durasi',
);
bundle = replaceOnce(
    bundle,
    tableDurationField,
    '',
    'Hapus input durasi dari pengaturan meja',
);
bundle = replaceOnce(
    bundle,
    'let e=await K7({name:`Meja ${t}`,number:String(t),durationMinutes:60,x:24,y:24})',
    'let e=await K7({name:`Meja ${t}`,number:String(t),x:24,y:24})',
    'Meja baru tanpa durasi bawaan',
);
bundle = replaceOnce(
    bundle,
    'Klik Simpan agar nama, nomor, durasi, dan catatan meja tersimpan ke database.',
    'Klik Simpan agar perubahan nama, nomor, posisi, status, dan catatan meja tersimpan ke database.',
    'Petunjuk pengaturan meja tanpa durasi',
);
bundle = replaceOnce(
    bundle,
    'async function M7(e){let{data:t}=await d7.post(`/transactions/checkout`,{table_id:e.tableId,cashier_id:e.cashierId,payment_method:v7(e.paymentMethod),discount:e.discount??0,tax_percent:e.taxPercent,service_charge:e.serviceCharge,service_charge_percent:e.serviceChargePercent,reminder_interval_minutes:e.reminderIntervalMinutes,items:e.items.map(e=>({product_id:e.productId,qty:e.qty,discount:e.discount??0}))});return C7(t)}',
    'async function M7(e){let{data:t}=await d7.post(`/transactions/checkout`,{table_id:e.tableId,cashier_id:e.cashierId,payment_method:v7(e.paymentMethod),discount:e.discount??0,tax_percent:e.taxPercent,service_charge:e.serviceCharge,service_charge_percent:e.serviceChargePercent,duration_minutes:e.durationMinutes,reminder_interval_minutes:e.reminderIntervalMinutes,items:e.items.map(e=>({product_id:e.productId,qty:e.qty,discount:e.discount??0}))});return C7(t)}',
    'Durasi sesi kasir dikirim saat checkout',
);
bundle = replaceOnce(
    bundle,
    '[serviceOn,setServiceOn]=(0,v.useState)(()=>localStorage.getItem(`pos_billing_service_enabled`)!==`off`),[R,z]=',
    '[serviceOn,setServiceOn]=(0,v.useState)(()=>localStorage.getItem(`pos_billing_service_enabled`)!==`off`),[sessionDuration,setSessionDuration]=(0,v.useState)(60),[R,z]=',
    'State durasi sesi di Outlet',
);
bundle = replaceOnce(
    bundle,
    'tt=_.find(e=>e.tableId===K.id);(0,v.useEffect)(()=>{document.documentElement.classList.toggle(`dark`,a)',
    'tt=_.find(e=>e.tableId===K.id);(0,v.useEffect)(()=>{setSessionDuration(60)},[A]),(0,v.useEffect)(()=>{document.documentElement.classList.toggle(`dark`,a)',
    'Reset durasi ketika kasir memilih meja',
);

const sessionDurationField = '!tt&&(0,Q.jsxs)(`div`,{className:`grid gap-2 rounded-md border border-primary/30 bg-primary/5 p-3`,children:[(0,Q.jsx)(r$,{htmlFor:`session-duration`,children:`Durasi penggunaan (menit)`}),(0,Q.jsx)(QQ,{id:`session-duration`,type:`number`,inputMode:`numeric`,min:1,max:1440,value:sessionDuration,onChange:e=>setSessionDuration(Math.min(1440,Math.max(1,Number(e.target.value)||1)))}),(0,Q.jsx)(`p`,{className:`text-xs text-muted-foreground`,children:`Tentukan durasi, pilih produk, lalu tekan Buka Meja & Checkout. Contoh: 60 untuk 1 jam.`})]})';
const subtotalRow = '(0,Q.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,Q.jsx)(`span`,{children:`Subtotal`}),(0,Q.jsx)(`span`,{className:`num`,children:BJ(dt)})]})';

if (! bundle.includes('id:`session-duration`')) {
    bundle = replaceOnce(
        bundle,
        subtotalRow,
        `${sessionDurationField},${subtotalRow}`,
        'Input durasi sesi di Outlet',
    );
} else {
    console.log('Input durasi sesi di Outlet: sudah diterapkan');
}
bundle = replaceOptionalOnce(
    bundle,
    'Kasir menentukan durasi saat membuka sesi meja. Contoh: 60 untuk 1 jam.',
    'Tentukan durasi, pilih produk, lalu tekan Buka Meja & Checkout. Contoh: 60 untuk 1 jam.',
    'Petunjuk membuka meja dari Outlet',
);

const checkoutWithCashierDuration = 'async function Jt(){if(!et||et.cart.length===0){X.error(`Keranjang masih kosong`);return}if(Sn&&!ht){X.error(`Buka shift dulu sebelum checkout`),ie(!0);return}if(!tt&&(!Number.isInteger(sessionDuration)||sessionDuration<1||sessionDuration>1440)){X.error(`Tentukan durasi penggunaan antara 1 dan 1440 menit`);return}if(M===`Cash`&&ge<mt){X.error(`Uang diterima kurang dari total tagihan`);return}let e=M===`Cash`?{received:ge,change:Math.max(0,ge-mt)}:void 0,n=B?window.open(``,`receipt-checkout`,`width=420,height=720`):null;B&&!n&&X.error(`Popup print diblokir browser. Izinkan popup untuk Mahjong Billing System.`);let a=P,u;try{u=await M7({tableId:K.id,cashierId:t?.id??et.cashierId,paymentMethod:M,items:et.cart,discount:a,serviceChargePercent:serviceOn?I:0,taxPercent:taxOn?10:0,durationMinutes:tt?void 0:sessionDuration}),await Nt()}catch(e){n?.close(),X.error(b9(e,`Checkout gagal. Transaksi tidak disimpan dan struk tidak dicetak.`));return}g(e=>e.filter(e=>e.id!==et.id)),c(e=>e.map(e=>e.id===K.id?{...e,status:`Occupied`}:e)),F(0),_e(0),setSessionDuration(60),Ot(`Checkout ${u.invoice} ${K.name}`,`Transaksi`),n&&At(n,u,R,e),X.success(`Checkout ${K.name} berhasil disimpan${n?` dan struk siap dicetak`:``}.`)}';
bundle = replaceOptionalOnce(
    bundle,
    checkoutWithTaxToggles,
    checkoutWithCashierDuration,
    'Checkout memakai durasi yang ditentukan kasir',
);
bundle = replaceOnce(
    bundle,
    'Pilih meja untuk mulai order, perpanjang, atau selesaikan.',
    'Pilih meja untuk mulai order dan tentukan durasi sesi; meja aktif dapat diperpanjang atau diselesaikan.',
    'Petunjuk durasi pada Outlet',
);
bundle = replaceOnce(
    bundle,
    'children:`Order Table`',
    'children:`Open Table / Order`',
    'Judul panel open table',
);
bundle = replaceOnce(
    bundle,
    'Sn&&!ht?`Buka shift dulu`:`Checkout & Cetak`',
    'Sn&&!ht?`Buka shift dulu`:tt?`Checkout Tambahan`:`Buka Meja & Checkout`',
    'Label tombol buka meja',
);
bundle = replaceOnce(
    bundle,
    'duration_minutes:`Durasi meja`',
    'duration_minutes:`Durasi penggunaan`',
    'Label validasi durasi sesi',
);

bundle = replaceOptionalOnce(
    bundle,
    'function BJ(e){return new Intl.NumberFormat(`id-ID`,{style:`currency`,currency:`IDR`,maximumFractionDigits:0}).format(e)}function VJ(e)',
    'function BJ(e){return new Intl.NumberFormat(`id-ID`,{style:`currency`,currency:`IDR`,maximumFractionDigits:0}).format(e)}function PJ(e){return new Intl.NumberFormat(`id-ID`,{style:`currency`,currency:`IDR`,minimumFractionDigits:2,maximumFractionDigits:2}).format(e)}function VJ(e)',
    'Formatter harga jual dua desimal',
);
bundle = replaceOptionalOnce(
    bundle,
    '(0,Q.jsx)(r$,{htmlFor:`product-sell`,children:`Harga Jual`}),(0,Q.jsx)(QQ,{id:`product-sell`,type:`number`,min:0,value:Be.sellPrice,onChange:e=>Ve({...Be,sellPrice:Number(e.target.value)})})',
    '(0,Q.jsx)(r$,{htmlFor:`product-sell`,children:`Harga Jual (2 desimal)`}),(0,Q.jsx)(QQ,{id:`product-sell`,type:`number`,inputMode:`decimal`,min:0,step:.01,value:Be.sellPrice,onChange:e=>Ve({...Be,sellPrice:e.target.value}),onBlur:e=>Ve({...Be,sellPrice:Number(e.target.value||0).toFixed(2)})})',
    'Input harga jual dua desimal',
);
bundle = replaceOptionalOnce(
    bundle,
    '(0,Q.jsx)(G3,{children:BJ(e.costPrice)}),(0,Q.jsx)(G3,{children:BJ(e.sellPrice)})',
    '(0,Q.jsx)(G3,{children:BJ(e.costPrice)}),(0,Q.jsx)(G3,{children:PJ(e.sellPrice)})',
    'Tampilan harga jual dua desimal',
);

bundle = replaceOptionalOnce(
    bundle,
    '(0,Q.jsx)(`h1`,{className:`text-lg font-semibold lg:text-xl`,children:`POS Mahjong BSBXperience`})',
    '(0,Q.jsx)(`img`,{src:`/bsbxperience-logo.png`,alt:`BSBXperience`,className:`h-8 w-auto object-contain`}),(0,Q.jsx)(`h1`,{className:`text-lg font-semibold lg:text-xl`,children:`POS PLAYHUB BSBXperience`})',
    'Judul dan logo icon Foto 1 POS PLAYHUB BSBXperience',
);
bundle = replaceOptionalOnce(
    bundle,
    '(0,Q.jsx)(`h1`,{className:`text-2xl font-bold tracking-tight`,children:`Mahjong Billing System`})',
    '(0,Q.jsx)(`h1`,{className:`text-2xl font-bold tracking-tight`,children:`Playhub Billing System`})',
    'Judul modal login Playhub Billing System',
);
bundle = replaceOptionalOnce(
    bundle,
    'children:`BSBXperience by The Bay · Mahjong Lounge`',
    'children:`BSBXperience by The Bay`',
    'Hapus Mahjong Lounge di footer modal login',
);
bundle = replaceOptionalOnce(
    bundle,
    'e.text(`Laporan Mahjong Billing System`,14,16)',
    'e.text(`Laporan Playhub Billing System`,14,16)',
    'Judul laporan PDF Playhub Billing System',
);
bundle = replaceOptionalOnce(
    bundle,
    '<div class="strong">Mahjong Billing System</div>',
    '<div class="strong">Playhub Billing System</div>',
    'Header struk Playhub Billing System',
);
bundle = replaceAll(
    bundle,
    'Izinkan popup untuk Mahjong Billing System.',
    'Izinkan popup untuk Playhub Billing System.',
    'Pesan popup print Playhub Billing System',
);
bundle = replaceOptionalOnce(
    bundle,
    '(0,Q.jsx)(`div`,{className:`mb-3 flex h-12 w-full items-center justify-center px-2`,children:(0,Q.jsx)(`img`,{src:`/bsbxperience-logo.png`,alt:`BSBXperience by The Bay`,className:`h-9 w-auto max-w-full object-contain`})})',
    '(0,Q.jsx)(`div`,{className:`mb-3 flex h-12 w-full items-center justify-center px-2`,children:(0,Q.jsx)(`img`,{src:`/playhub-logo.png`,alt:`BSB Playhub`,className:`h-11 w-11 object-contain`})})',
    'Logo navigasi sidebar BSB Playhub',
);
bundle = replaceOptionalOnce(
    bundle,
    '(0,Q.jsx)(`img`,{src:`/bsbxperience-logo.png`,alt:`BSBXperience by The Bay`,className:`h-14 w-auto max-w-[220px] object-contain`})',
    '(0,Q.jsx)(`img`,{src:`/playhub-logo.png`,alt:`BSB Playhub`,className:`h-24 w-24 object-contain`})',
    'Logo modal login BSB Playhub',
);

await writeFile(bundlePath, bundle, 'utf8');

indexHtml = indexHtml.replace(
    /<title>.*?<\/title>/,
    '<title>Playhub Billing System</title>',
);
indexHtml = indexHtml.replace(
    /(?:<link rel="(?:icon|apple-touch-icon)"[^>]*>\s*)+/,
    '<link rel="icon" type="image/png" href="/playhub-logo.png?v=20260909" />\n    <link rel="apple-touch-icon" href="/playhub-logo.png?v=20260909" />\n    ',
);
indexHtml = indexHtml.replace(
    /src="\/assets\/(index-[^"?]+\.js)(?:\?[^" ]+)?"/,
    'src="/assets/$1?v=20260909-playhub-logo-v2"',
);
await writeFile(indexPath, indexHtml, 'utf8');

await mkdir(publicPath, { recursive: true });
for (const entry of await readdir(frontendPath)) {
    await cp(path.join(frontendPath, entry), path.join(publicPath, entry), {
        force: true,
        recursive: true,
    });
}

console.log(`Bundle diperbarui: ${bundlePath}`);
console.log(`Cache-busting diperbarui: ${indexPath}`);
console.log(`Frontend disinkronkan ke Laravel public: ${publicPath}`);
