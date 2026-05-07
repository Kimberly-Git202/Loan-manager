import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    projectId: "jml-loans-560d8",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

let clients = [];
let activeClientId = null;

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-overlay').classList.add('hidden');
        initApp();
    }
});

function initApp() {
    onValue(ref(db, 'jml_data/'), snap => {
        const data = snap.val();
        clients = data ? Object.values(data) : [];
        app.render();
        app.updateFinancials();
        app.renderDebts();
    });
    populateSelectors();
}

const app = {
    render(data = clients) {
        const tbody = document.getElementById('clientTableBody');
        tbody.innerHTML = data.map((c, i) => {
            const totalDue = Number(c.principal) * 1.25;
            const paid = Number(c.totalPaid || 0);
            return `
            <tr onclick="app.openDossier('${c.id}')">
                <td>${i+1}</td>
                <td><b>${c.name}</b></td>
                <td>${c.id}</td>
                <td>${c.phone}</td>
                <td style="color:green">KSh ${paid.toLocaleString()}</td>
                <td style="color:red">KSh ${(totalDue - paid).toLocaleString()}</td>
                <td><button class="view-btn">VIEW</button></td>
            </tr>`;
        }).join('');
    },

    openDossier(id) {
        activeClientId = id;
        const c = clients.find(x => x.id === id);
        if(!c) return;

        const totalDue = Number(c.principal) * 1.25;
        const paid = Number(c.totalPaid || 0);

        document.getElementById('d-name').innerText = c.name;
        document.getElementById('d-id').innerText = c.id;
        document.getElementById('d-up').innerText = c.updatedAt || 'New';
        document.getElementById('v-p').innerText = Number(c.principal).toLocaleString();
        document.getElementById('v-tp').innerText = paid.toLocaleString();
        document.getElementById('v-bal').innerText = (totalDue - paid).toLocaleString();
        document.getElementById('d-notes').value = c.notes || '';
        document.getElementById('d-info-box').innerHTML = `<p>Phone: ${c.phone}</p><p>Loc: ${c.location}</p><p>Ref: ${c.referral}</p>`;

        const hBody = document.getElementById('historyBody');
        hBody.innerHTML = (c.history || []).slice().reverse().map((h, idx, arr) => {
            const isLate = h.time > "18:00" ? 'class="late-row"' : '';
            const isNew = h.act === "New Loan" ? 'class="new-row"' : '';
            
            // Logic for missed payment gaps
            let isGap = '';
            if(idx < arr.length - 1) {
                const diff = (new Date(h.date) - new Date(arr[idx+1].date)) / (1000*60*24);
                if(diff > 1.5) isGap = 'class="gap-row"';
            }

            return `<tr ${isLate || isNew || isGap}>
                <td>${h.date}</td><td>${h.act}</td><td>${h.time}</td><td>${h.by}</td>
            </tr>`;
        }).join('');

        document.getElementById('dossierModal').classList.remove('hidden');
    },

    processPayment() {
        const amt = parseFloat(document.getElementById('payAmt').value);
        const time = document.getElementById('payTime').value;
        if(!amt || !time || !confirm(`Record KSh ${amt}?`)) return;

        const c = clients.find(x => x.id === activeClientId);
        const newPaid = (Number(c.totalPaid) || 0) + amt;
        const history = c.history || [];

        history.push({
            date: new Date().toLocaleDateString('en-GB'),
            time: time,
            act: `Payment: KSh ${amt}`,
            by: auth.currentUser.email.split('@')[0]
        });

        update(ref(db, `jml_data/${activeClientId}`), {
            totalPaid: newPaid,
            history: history,
            updatedAt: new Date().toLocaleString()
        });
        document.getElementById('payAmt').value = '';
    },

    updateFinancials() {
        const m = document.getElementById('fin-month').value;
        const y = document.getElementById('fin-year').value;
        
        let totalOut = 0, monthlyPaid = 0, todayPaid = 0;
        const today = new Date().toLocaleDateString('en-GB');

        clients.forEach(c => {
            const bal = (Number(c.principal) * 1.25) - Number(c.totalPaid || 0);
            totalOut += bal;

            (c.history || []).forEach(h => {
                if(h.date === today && h.act.includes("Payment")) {
                    todayPaid += parseFloat(h.act.split('KSh ')[1]);
                }
                const [hD, hM, hY] = h.date.split('/');
                if(parseInt(hM) == m && hY == y && h.act.includes("Payment")) {
                    monthlyPaid += parseFloat(h.act.split('KSh ')[1]);
                }
            });
        });

        document.getElementById('top-today').innerText = `KSh ${todayPaid.toLocaleString()}`;
        document.getElementById('finance-display').innerHTML = `
            <div class="stat-card"><h4>Grand Total Out</h4><h2>KSh ${totalOut.toLocaleString()}</h2></div>
            <div class="stat-card"><h4>Monthly Total Paid</h4><h2>KSh ${monthlyPaid.toLocaleString()}</h2></div>
            <div class="stat-card"><h4>Monthly Profit (20% of 1.25)</h4><h2>KSh ${(monthlyPaid * 0.2).toLocaleString()}</h2></div>
        `;
    }
};

window.app = app;
window.handleLogin = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Error"));
};

document.getElementById('enrollForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('f-id').value;
    const princ = parseFloat(document.getElementById('f-loan').value);
    
    set(ref(db, `jml_data/${id}`), {
        id: id,
        name: document.getElementById('f-name').value,
        phone: document.getElementById('f-phone').value,
        location: document.getElementById('f-loc').value,
        principal: princ,
        totalPaid: 0,
        history: [{
            date: new Date().toLocaleDateString('en-GB'),
            time: "08:00",
            act: "New Loan",
            by: "System"
        }]
    }).then(() => {
        alert("Enrolled!");
        e.target.reset();
        showSection('list-sec', document.querySelector('.nav-item'));
    });
});

function populateSelectors() {
    const m = document.getElementById('fin-month');
    const y = document.getElementById('fin-year');
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    months.forEach((name, i) => m.innerHTML += `<option value="${i+1}">${name}</option>`);
    for(let i=2024; i<=2026; i++) y.innerHTML += `<option value="${i}">${i}</option>`;
    m.value = new Date().getMonth() + 1;
    y.value = new Date().getFullYear();
}

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');
window.toggleDarkMode = () => document.body.classList.toggle('dark-mode');
window.showSection = (id, el) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
};
