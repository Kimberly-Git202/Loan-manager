const firebaseConfig = {
    apiKey: "AIzaSyAEMpC9oczMDYybbkZirDkY9a25d8ZqjJw",
    authDomain: "jml-loans-560d8.firebaseapp.com",
    databaseURL: "https://jml-loans-560d8-default-rtdb.europe-west1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let clients = {};
let user = "";

// LOGIN
function login() {
    auth.signInWithEmailAndPassword(email.value, password.value)
        .then(res => {
            user = res.user.email;
            document.getElementById("login").style.display = "none";
            document.getElementById("app").classList.remove("hidden");
            load();
        });
}

function logout() {
    auth.signOut();
    location.reload();
}

// LOAD DATA
function load() {
    db.ref("clients").on("value", snap => {
        clients = snap.val() || {};
        render();
        calc();
        debts();
        settled();
        reports();
    });
}

// ADD CLIENT
function addClient() {
    let id = document.getElementById("id").value;
    let now = new Date();

    let data = {
        name: name.value,
        id,
        phone: phone.value,
        location: location.value,
        occupation: occupation.value,
        referral: referral.value,
        principal: Number(amount.value),
        balance: Number(amount.value),
        paid: 0,
        officer: user,
        loanMonth: now.toISOString().slice(0, 7),
        week: Math.ceil(now.getDate() / 7),
        history: [],
        archived: []
    };

    db.ref("clients/" + id).set(data);
}

// RENDER CLIENTS
function render() {
    let html = "";
    let i = 1;

    for (let id in clients) {
        let c = clients[id];
        html += `
        <tr>
        <td>${i++}</td>
        <td>${c.name}</td>
        <td>${c.id}</td>
        <td>${c.phone}</td>
        <td>${c.paid}</td>
        <td>${c.balance}</td>
        </tr>`;
    }

    document.getElementById("clientTable").innerHTML = html;
}

// FINANCIALS
function calc() {
    let out = 0, paid = 0;

    for (let id in clients) {
        out += clients[id].principal || 0;
        paid += clients[id].paid || 0;
    }

    document.getElementById("out").innerText = out;
    document.getElementById("paid").innerText = paid;
}

function calcMonth() {
    let m = month.value;
    let total = 0;

    for (let id in clients) {
        (clients[id].history || []).forEach(h => {
            if (h.date && h.date.includes(m)) total += Number(h.details) || 0;
        });
    }

    document.getElementById("monthly").innerText = total;
}

function calcYear() {
    let y = year.value;
    let total = 0;

    for (let id in clients) {
        (clients[id].history || []).forEach(h => {
            if (h.date && h.date.includes(y)) total += Number(h.details) || 0;
        });
    }

    document.getElementById("yearly").innerText = total;
}

// LOANS FILTER
function filterLoans() {
    let m = loanMonth.value;
    let w = week.value;

    document.getElementById("loanList").innerHTML =
        Object.values(clients)
            .filter(c => c.loanMonth == m && (w == "all" || c.week == w))
            .map(c => `<div>${c.name} - KSH ${c.principal}</div>`)
            .join("");
}

// DEBTS
function debts() {
    document.getElementById("debtList").innerHTML =
        Object.values(clients)
            .filter(c => c.balance > 0)
            .map(c => `<div>${c.name} - KSH ${c.balance}</div>`)
            .join("");
}

// SETTLED
function settled() {
    document.getElementById("settledList").innerHTML =
        Object.values(clients)
            .flatMap(c => c.archived || [])
            .map(a => `<div>KSH ${a.amount}</div>`)
            .join("");
}

// REPORTS
function reports() {
    document.getElementById("reportList").innerHTML =
        Object.values(clients)
            .map(c => `<div>${c.officer} handled ${c.name}</div>`)
            .join("");
}

// SEARCH
function search(q) {
    q = q.toLowerCase();

    document.querySelectorAll("#clientTable tr").forEach(row => {
        row.style.display =
            row.innerText.toLowerCase().includes(q) ? "" : "none";
    });
}

// NAVIGATION
function show(id) {
    document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
}

// THEME
function toggleMode() {
    document.getElementById("body").classList.toggle("dark");
                    }
