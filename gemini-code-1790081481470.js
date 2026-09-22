// إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyDlvXAVdYZcfjTYynLMlieR5JBTS4JmNK8",
  authDomain: "gggg-2904f.firebaseapp.com",
  databaseURL: "https://gggg-2904f-default-rtdb.firebaseio.com",
  projectId: "gggg-2904f",
  storageBucket: "gggg-2904f.firebasestorage.app",
  messagingSenderId: "646285342822",
  appId: "1:646285342822:web:4cde1778807473f78255a7",
  measurementId: "G-RL1R1XWVNE"
};

let db = null;
let useFirebase = false;

// محاولة الاتصال بـ Firebase بأمان دون توقف الموقع إذا تعذر الاتصال
try {
  if (typeof firebase !== 'undefined' && firebase.apps) {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
    useFirebase = true;
    console.log("تم الاتصال بـ Firebase بنجاح.");
  }
} catch (e) {
  console.warn("تنبيه: سيتم الاعتماد على التخزين المحلي الآمن:", e);
  useFirebase = false;
}

// مصفوفات البيانات المؤقتة
let localVolunteers = [];
let localCampaigns = [];
let localAttendance = [];
let html5QrScanner = null;

// وظائف فتح وغلق النوافذ
window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "flex";
    if (id === 'mycard-modal') {
      window.generateSelectedVolunteerQR();
    }
  }
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "none";
    if (id === 'scanner-modal' && html5QrScanner) {
      const stopBtn = document.getElementById('stop-scanner-btn');
      if (stopBtn) stopBtn.click();
    }
  }
};

window.onclick = function(event) {
  if (event.target && event.target.classList.contains('modal-overlay')) {
    event.target.style.display = "none";
  }
};

// مزامنة وعرض البيانات
function syncData() {
  if (useFirebase && db) {
    // 1. المتطوعين من Firebase
    db.ref("volunteers").on("value", (snap) => {
      localVolunteers = [];
      const val = snap.val();
      if (val) Object.keys(val).forEach(k => localVolunteers.push({ id: k, ...val[k] }));
      updateAllUI();
    }, (err) => fallbackToLocalStorage());

    // 2. الحملات من Firebase
    db.ref("campaigns").on("value", (snap) => {
      localCampaigns = [];
      const val = snap.val();
      if (val) Object.keys(val).forEach(k => localCampaigns.push({ id: k, ...val[k] }));
      updateAllUI();
    }, (err) => fallbackToLocalStorage());

    // 3. الحضور من Firebase
    db.ref("attendance").on("value", (snap) => {
      localAttendance = [];
      const val = snap.val();
      if (val) Object.keys(val).forEach(k => localAttendance.push({ id: k, ...val[k] }));
      updateAllUI();
    }, (err) => fallbackToLocalStorage());

  } else {
    fallbackToLocalStorage();
  }
}

function fallbackToLocalStorage() {
  localVolunteers = JSON.parse(localStorage.getItem("ba_volunteers") || "[]");
  localCampaigns = JSON.parse(localStorage.getItem("ba_campaigns") || "[]");
  localAttendance = JSON.parse(localStorage.getItem("ba_attendance") || "[]");
  updateAllUI();
}

function updateAllUI() {
  // تحديث العدادات (صفر في البداية)
  const volCount = document.getElementById("stat-volunteers");
  const campCount = document.getElementById("stat-campaigns");
  const hoursCount = document.getElementById("stat-hours");
  const badgesCount = document.getElementById("stat-badges");

  if (volCount) volCount.textContent = localVolunteers.length;
  if (campCount) campCount.textContent = localCampaigns.filter(c => c.status === "مكتملة").length;
  
  const totalHours = localAttendance.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
  if (hoursCount) hoursCount.textContent = totalHours;
  if (badgesCount) badgesCount.textContent = Math.floor(totalHours / 10);

  renderOpportunities();
  updateVolunteerSelect();
  updateCampaignSelectUI();
}

// عرض بطاقات الفرص
function renderOpportunities() {
  const container = document.getElementById("opp-cards-container");
  if (!container) return;
  container.innerHTML = "";

  if (localCampaigns.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <i class="fa-solid fa-mountain-sun empty-icon"></i>
        <h3>المنصة جاهزة لخدمة بلديات ولاية بني عباس</h3>
        <p>لا توجد مبادرات مسجلة حتى الآن. انقر على "أنشئ مبادرة جديدة" لإطلاق أول نشاط تطوعي ببلديتك!</p>
        <button class="btn-apply" onclick="openModal('campaign-modal')" style="margin-top: 1rem;">إضافة أول مبادرة الآن</button>
      </div>
    `;
    return;
  }

  localCampaigns.forEach(camp => {
    let tagClass = "tag-green";
    if (camp.skill && (camp.skill.includes("إسعاف") || camp.skill.includes("إنقاذ"))) tagClass = "tag-red";
    if (camp.skill && (camp.skill.includes("تعليم") || camp.skill.includes("إعلام"))) tagClass = "tag-blue";

    const card = document.createElement("article");
    card.className = "opp-card";
    card.innerHTML = `
      <div class="opp-card-top">
        <span class="tag-category ${tagClass}">${camp.skill || "عام"}</span>
        <span class="tag-hours"><i class="fa-solid fa-bell"></i> أولوية ${camp.urgency || "عادية"}</span>
      </div>
      <h3 class="opp-card-title">${camp.title}</h3>
      <div class="opp-card-footer">
        <span class="opp-location"><i class="fa-solid fa-location-dot"></i> بلدية ${camp.city}</span>
        <button class="btn-apply" onclick="applyToCampaign('${camp.id}', '${camp.title}', '${camp.city}')">تطوع الآن</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// إضافة مبادرة جديدة
const campaignForm = document.getElementById("campaign-form");
if (campaignForm) {
  campaignForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newCamp = {
      id: "camp_" + Date.now(),
      title: document.getElementById("camp-title").value.trim(),
      city: document.getElementById("camp-city").value,
      skill: document.getElementById("camp-skill").value,
      urgency: document.getElementById("camp-urgency").value,
      status: "نشطة",
      createdAt: Date.now()
    };

    if (useFirebase && db) {
      db.ref("campaigns").push(newCamp).then(() => {
        finishCampaignAdd(newCamp);
      }).catch(err => {
        saveCampaignLocally(newCamp);
      });
    } else {
      saveCampaignLocally(newCamp);
    }
  });
}

function saveCampaignLocally(camp) {
  localCampaigns.push(camp);
  localStorage.setItem("ba_campaigns", JSON.stringify(localCampaigns));
  finishCampaignAdd(camp);
}

function finishCampaignAdd(camp) {
  campaignForm.reset();
  closeModal('campaign-modal');
  alert(`تم نشر المبادرة ببلدية ${camp.city} بنجاح!`);
  updateAllUI();
}

// تسجيل متطوع جديد
const volunteerForm = document.getElementById("volunteer-form");
if (volunteerForm) {
  volunteerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const practicalSkills = document.getElementById("vol-practical-skills").value.trim();
    const hobbies = document.getElementById("vol-hobbies").value.trim();

    const newVol = {
      id: "vol_" + Date.now(),
      name: document.getElementById("vol-name").value.trim(),
      phone: document.getElementById("vol-phone").value.trim(),
      city: document.getElementById("vol-city").value,
      skill: document.getElementById("vol-skill").value,
      practicalSkills: practicalSkills ? practicalSkills.split(',').map(s => s.trim()) : [],
      hobbies: hobbies ? hobbies.split(',').map(h => h.trim()) : [],
      hours: Number(document.getElementById("vol-hours").value),
      availability: document.getElementById("vol-availability").value,
      verifiedHours: 0,
      createdAt: Date.now()
    };

    if (useFirebase && db) {
      db.ref("volunteers").push(newVol).then(() => {
        finishVolAdd(newVol);
      }).catch(err => {
        saveVolLocally(newVol);
      });
    } else {
      saveVolLocally(newVol);
    }
  });
}

function saveVolLocally(vol) {
  localVolunteers.push(vol);
  localStorage.setItem("ba_volunteers", JSON.stringify(localVolunteers));
  finishVolAdd(vol);
}

function finishVolAdd(vol) {
  volunteerForm.reset();
  alert(`مرحباً بك! تم تسجيلك كمتطوع ببلدية ${vol.city} بنجاح.`);
  updateAllUI();
  const sel = document.getElementById("volunteer-select-qr");
  if (sel) {
    sel.value = vol.id;
    window.generateSelectedVolunteerQR();
  }
}

// تحديث قوائم الاختيار
function updateVolunteerSelect() {
  const sel = document.getElementById("volunteer-select-qr");
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = `<option value="">-- اختر المتطوع لعرض هويته --</option>`;
  
  localVolunteers.forEach(v => {
    sel.innerHTML += `<option value="${v.id}">${v.name} (بلدية ${v.city})</option>`;
  });

  if (currentVal) sel.value = currentVal;
  else if (localVolunteers.length > 0) {
    sel.selectedIndex = 1;
    window.generateSelectedVolunteerQR();
  }
}

// توليد رمز الـ QR
window.generateSelectedVolunteerQR = function() {
  const sel = document.getElementById("volunteer-select-qr");
  const canvas = document.getElementById("qrcode-canvas");
  const previewArea = document.getElementById("qr-preview-area");
  if (!sel || !canvas) return;

  const volId = sel.value;
  canvas.innerHTML = "";

  if (!volId) {
    if (previewArea) previewArea.style.display = "none";
    return;
  }

  const vol = localVolunteers.find(v => v.id === volId);
  if (vol) {
    if (previewArea) previewArea.style.display = "flex";
    document.getElementById("qr-volunteer-name").textContent = vol.name;
    document.getElementById("qr-volunteer-municipality").textContent = `بلدية ${vol.city} - ولاية بني عباس`;

    const tagsBox = document.getElementById("qr-volunteer-skills-tags");
    tagsBox.innerHTML = `<span class="skill-tag-pill">${vol.skill}</span>`;
    
    if (vol.practicalSkills && vol.practicalSkills.length > 0) {
      vol.practicalSkills.slice(0, 3).forEach(s => {
        tagsBox.innerHTML += `<span class="skill-tag-pill" style="background:#fef3c7; color:#b45309;">${s}</span>`;
      });
    }

    if (vol.hobbies && vol.hobbies.length > 0) {
      vol.hobbies.slice(0, 2).forEach(h => {
        tagsBox.innerHTML += `<span class="skill-tag-pill" style="background:#f3e8ff; color:#6b21a8;">هواية: ${h}</span>`;
      });
    }

    try {
      new QRCode(canvas, {
        text: JSON.stringify({ volId: vol.id, name: vol.name, municipality: vol.city }),
        width: 140,
        height: 140,
        colorDark: "#0d382d",
        colorLight: "#ffffff"
      });
    } catch (e) {
      console.error(e);
    }
  }
};

function updateCampaignSelectUI() {
  const sel = document.getElementById("att-campaign-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">-- اختر المبادرة لتسجيل الحضور --</option>`;
  localCampaigns.filter(c => c.status === "نشطة").forEach(c => {
    sel.innerHTML += `<option value="${c.title}">${c.title} (بلدية ${c.city})</option>`;
  });
}

// تشغيل ماسح الـ QR
const startBtn = document.getElementById("start-scanner-btn");
const stopBtn = document.getElementById("stop-scanner-btn");

if (startBtn) {
  startBtn.addEventListener("click", () => {
    const campVal = document.getElementById("att-campaign-select").value;
    if (!campVal) {
      alert("يرجى اختيار المبادرة أولاً!");
      return;
    }

    try {
      html5QrScanner = new Html5Qrcode("qr-reader");
      html5QrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        onScanSuccess
      ).then(() => {
        startBtn.style.display = "none";
        stopBtn.style.display = "block";
      }).catch(err => {
        alert("تنبيه الكاميرا: يرجى السماح بالإذن أو تشغيل الموقع عبر HTTPS أو localhost. تفاصيل: " + err);
      });
    } catch(err) {
      alert("تعذر تشغيل الماسح: " + err);
    }
  });
}

if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    if (html5QrScanner) {
      html5QrScanner.stop().then(() => {
        startBtn.style.display = "block";
        stopBtn.style.display = "none";
      }).catch(e => console.log(e));
    }
  });
}

function onScanSuccess(decodedText) {
  try {
    const data = JSON.parse(decodedText);
    const campaignTitle = document.getElementById("att-campaign-select").value;
    const hours = Number(document.getElementById("att-session-hours").value) || 1;

    const entry = {
      volunteerName: data.name || "متطوع",
      volunteerMunicipality: data.municipality || "بني عباس",
      campaignTitle: campaignTitle,
      hours: hours,
      timestamp: Date.now()
    };

    if (useFirebase && db) {
      db.ref("attendance").push(entry);
    }
    
    localAttendance.push(entry);
    localStorage.setItem("ba_attendance", JSON.stringify(localAttendance));

    const fb = document.getElementById("scan-feedback");
    fb.style.display = "block";
    fb.innerHTML = `✔ تم بنجاح توثيق حضور المتطوع: <strong>${data.name}</strong> (${data.municipality || 'بني عباس'}) واحتساب (+${hours} ساعات)!`;
    
    if (stopBtn) stopBtn.click();
    updateAllUI();
  } catch (e) {
    alert("رمز QR غير صالح.");
  }
}

window.applyToCampaign = function(id, title, city) {
  alert(`تم تسجيل رغبتك بالانضمام إلى مبادرة "${title}" ببلدية ${city}.`);
};

// بدء تشغيل المنصة فور تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
  syncData();
});