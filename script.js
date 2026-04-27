const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jml-loans-560d8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const app = {
    clients: [],
    activeKey: null,

    init() {
        db.ref('jml_v4_data').on('value', snap => {
            const data = snap.val();
            this.clients = data ? Object.keys(data).map(k => ({ key: k, ...data[k] })) : [];
            this.renderList();
            this.populateSelectors();
        });
    },

    // 1. ENROLL WITH 1.25 RULE & REDIRECT
    enroll() {
        const id = document.getElementById('e-id').value;
        const princ = parseFloat(document.getElementById('e-princ').value);
        if(!id || isNaN(princ)) return alert("Missing ID/Principal");

        const payload = {
            name: document.getElementById('e-name').value,
            phone: document.getElementById('e-phone').value,
            idNo: id, location: document.getElementById('e-loc').value,
            occupation: document.getElementById('e-occ').value,
            referral: document.getElementById('e-ref').value,
            principal: princ, balance: princ * 1.25, totalPaid: 0,
            start: document.getElementById('e-start').value,
            end: document.getElementById('e-end').value,
            status: 'Active', updated: new Date().toLocaleString(),
            history: [], notes: ""
        };

        db.ref('jml_v4_data/' + id).set(payload).then(() => {
            alert("Enrolled!");
            document.querySelectorAll('#enroll-sec input').forEach(i => i.value = '');
            switchTab('list-sec', document.querySelector('.nav-item'));
        });
    },

    // 2. SKIPPED DAY & 6PM LOGIC
    renderDossierHistory(c) {
        const body = document.getElementById('d-hist-body');
        if(!c.history) { body.innerHTML = ""; return; }
        
        const historyArr = Object.values(c.history).sort((a,b) => new Date(b.date) - new Date(a.date));
        let html = "";
        
        // Logical Gap Check: Compare dates to find skipped days
        historyArr.forEach((h, i) => {
            const isLate = h.time > "18:00" ? "late-time" : "";
            const isNew = h.activity === "New Loan" ? "new-loan-row" : "";
            
            // Check for a date gap with the next entry
            let skippedClass = "";
            if(i < historyArr.length - 1) {
                const d1 = new Date(h.date);
                const d2 = new Date(historyArr[i+1].date);
                const diff = (d1 - d2) / (1000 * 60 * 60 * 24);
                if(diff > 1) skippedClass = "skipped-day"; 
            }

            html += `<tr class="${isLate} ${isNew} ${skippedClass}">
                <td>${h.date}</td><td>${h.activity}</td><td>${h.details}</td>
                <td>${h.time}</td><td>${h.by || 'Admin'}</td>
            </tr>`;
        });
        body.innerHTML = html;
    },

    // 3. SATURDAY WEEKLY LOAN SORTING
    renderLoansByWeek() {
        const m = document.getElementById('loan-month').value;
        const w = document.getElementById('loan-week').value;
        const body = document.getElementById('loanSortBody');
        
        const filtered = this.clients.filter(c => {
            const date = new Date(c.start);
            const monthStr = ("0" + (date.getMonth() + 1)).slice(-2);
            const day = date.getDate();
            let week = 1;
            if(day > 7) week = 2; if(day > 14) week = 3; if(day > 21) week = 4;
            return monthStr === m && week == w;
        });

        body.innerHTML = filtered.map((c, i) => `
            <tr><td>${i+1}</td><td>${c.name}</td><td>${c.idNo}</td><td>${c.phone}</td><td>${c.principal}</td><td>${c.start}</td></tr>
        `).join('');
    },

    // 4. SECURE OPERATIONS
    execute(type) {
        if(!confirm("Are you sure?")) return;
        const amt = parseFloat(document.getElementById('o-amt').value);
        const time = document.getElementById('o-time').value;
        const c = this.clients.find(x => x.key === this.activeKey);

        if(type === 'pay') {
            const newPaid = (c.totalPaid || 0) + amt;
            const newBal = (c.balance || 0) - amt;
            db.ref(`jml_v4_data/${this.activeKey}`).update({
                totalPaid: newPaid, balance: newBal, updated: new Date().toLocaleString()
            });
            db.ref(`jml_v4_data/${this.activeKey}/history`).push({
                date: new Date().toLocaleDateString(), activity: 'Payment',
                details: document.getElementById('o-det').value, time: time, by: 'Admin'
            });
        }
    },

    renderList() {
        const b = document.getElementById('clientList');
        b.innerHTML = this.clients.map((c, i) => `
            <tr><td>${i+1}</td><td><strong>${c.name}</strong></td><td>${c.idNo}</td><td>${c.phone}</td>
            <td style="color:green">KSH ${c.totalPaid}</td><td style="color:red">KSH ${c.balance}</td>
            <td><button class="btn btn-primary btn-sm" onclick="app.openDossier('${c.key}')">VIEW</button></td></tr>
        `).join('');
    },

    openDossier(key) {
        this.activeKey = key;
        const c = this.clients.find(x => x.key === key);
        switchTab('dossier-sec');
        document.getElementById('d-name').innerText = c.name;
        document.getElementById('d-id').innerText = c.idNo;
        document.getElementById('d-up').innerText = c.updated;
        this.renderDossierHistory(c);
    }
};

function switchTab(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
}

app.init();
