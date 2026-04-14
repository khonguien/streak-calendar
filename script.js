// --- CONFIG FIREBASE (Dựa trên ảnh của bạn) ---
const firebaseConfig = {
    apiKey: "AIzaSyBBk5N2H_z6pLOM-YB9_nKWUBn0qox9N0o",
    authDomain: "teamtracker-edeee.firebaseapp.com",
    databaseURL: "https://teamtracker-edeee-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "teamtracker-edeee",
    storageBucket: "teamtracker-edeee.firebasestorage.app",
    messagingSenderId: "424800634605",
    appId: "1:424800634605:web:6e613bdfa5f3d7e2886ee4"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE GLOBAL ---
let usersList = ["Khoi Nguyen", "Khách"]; 
let currentUser = localStorage.getItem('appCurrentUser') || "Khoi Nguyen"; // Lưu user đang chọn ở máy này
let currentSelectedDay = new Date().getDate();
let tasksData = {};
let waterData = { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: new Date().toDateString() };

const defaultSuggestedTasks = [
    "💧 Uống đủ 2L nước",
    "🚫 Không uống đồ ngọt",
    "🚶 Đi đủ 7000 bước",
    "🕗 Không ăn sau 20H",
    "🏃‍♂️ Vận động > 30P",
    "🏋️‍♂️ Tập Gym > 1H"
];

// --- KHỞI TẠO & ĐỒNG BỘ REAL-TIME ---
function initAuth() {
    // 1. Đồng bộ danh sách User từ Global
    db.ref('appUsersList').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) usersList = data;
        else db.ref('appUsersList').set(usersList);
        renderUserDropdown();
    });

    // 2. Đồng bộ Tasks từ Global (Mọi người đều thấy)
    db.ref('global_calendarTasks_v2').on('value', (snapshot) => {
        tasksData = snapshot.val() || {};
        renderCalendar();
        renderTasks(currentSelectedDay);
    });

    // 3. Khởi tạo Giao diện ban đầu
    loadWaterData();
    renderSuggestedTasks();
}

// --- QUẢN LÝ USER ---
function renderUserDropdown() {
    const select = document.getElementById('userSelect');
    if (!select) return;
    select.innerHTML = '';
    usersList.forEach(user => {
        select.innerHTML += `<option value="${user}" ${user === currentUser ? 'selected' : ''}>${user}</option>`;
    });
    select.innerHTML += `<option value="ADD_NEW">➕ Thêm User mới...</option>`;
    document.getElementById("userNameDisplay").textContent = currentUser;
}

function handleUserChange() {
    const select = document.getElementById('userSelect');
    if (select.value === "ADD_NEW") {
        const newName = prompt("Nhập tên người dùng mới:");
        if (newName && newName.trim() !== "" && !usersList.includes(newName.trim())) {
            usersList.push(newName.trim());
            db.ref('appUsersList').set(usersList); // Cập nhật lên Global
            currentUser = newName.trim();
        } 
    } else {
        currentUser = select.value;
    }
    localStorage.setItem('appCurrentUser', currentUser);
    renderUserDropdown();
    loadWaterData(); // Tải dữ liệu nước của User mới
}

function deleteCurrentUser() {
    if (usersList.length <= 1) return alert("Không thể xóa user cuối cùng!");
    if (confirm(`Xóa vĩnh viễn [${currentUser}] khỏi hệ thống?`)) {
        db.ref(`waterData/${currentUser}`).remove(); // Xóa dữ liệu nước trên Cloud
        usersList = usersList.filter(u => u !== currentUser);
        db.ref('appUsersList').set(usersList);
        currentUser = usersList[0];
        localStorage.setItem('appCurrentUser', currentUser);
        renderUserDropdown();
        loadWaterData();
    }
}

// --- QUẢN LÝ LỊCH & TASKS ---
function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    if(!calendarGrid) return;
    calendarGrid.innerHTML = ''; 
    for(let i = 22; i <= 28; i++) calendarGrid.innerHTML += `<div class="day muted">${i}</div>`;
    for(let i = 1; i <= 31; i++) {
        let activeClass = (i === currentSelectedDay) ? "active" : "";
        calendarGrid.innerHTML += `<div class="day ${activeClass}" onclick="selectDay(this, ${i})">${i}</div>`;
    }
}

function selectDay(element, dayNumber) {
    currentSelectedDay = dayNumber; 
    document.querySelectorAll('.day').forEach(d => d.classList.remove('active'));
    element.classList.add('active');
    renderTasks(dayNumber);
}

function renderProgressBars(tasksArray) {
    const container = document.getElementById('progressBarsContainer');
    if(!container) return;
    container.innerHTML = "";
    if (tasksArray.length === 0) return;

    const colors = ['#3498db', '#af52de', '#ff9500', '#2ecc71', '#e74c3c'];
    usersList.forEach((user, index) => {
        const uTasks = tasksArray.filter(t => t.owner === user);
        if (uTasks.length === 0) return;
        const done = uTasks.filter(t => t.completed).length;
        const percent = Math.round((done / uTasks.length) * 100);
        
        container.innerHTML += `
            <div class="user-progress-item">
                <div class="user-progress-label"><span>${user}</span><span>${percent}%</span></div>
                <div class="user-progress-track"><div class="user-progress-fill" style="width: ${percent}%; background-color: ${colors[index % colors.length]}"></div></div>
            </div>`;
    });
}

function renderTasks(dayNumber) {
    const taskList = document.getElementById('taskList');
    if(!taskList) return;
    
    const dayData = tasksData[dayNumber] || {};
    const tasksArray = Object.values(dayData);
    renderProgressBars(tasksArray);

    taskList.innerHTML = ""; 

    if (tasksArray.length === 0) {
        taskList.innerHTML = `<div class="task-item empty"><p class="task-title" style="color: var(--text-muted); font-size: 15px;">Chưa có công việc nào.</p></div>`;
        return;
    }

    // Duyệt qua object của Firebase (có key)
    for (let key in dayData) {
        const task = dayData[key];
        const isChecked = task.completed ? "checked" : "";
        const opacity = (task.owner === currentUser) ? "1" : "0.5";
        const delBtn = (task.owner === currentUser) ? `<button class="delete-btn" onclick="deleteTask(${dayNumber}, '${key}')">✕</button>` : "";

        taskList.innerHTML += `
            <div class="task-item ${task.color}" style="opacity: ${opacity}">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="${key}" ${isChecked} onchange="toggleTask(${dayNumber}, '${key}')">
                </div>
                <div class="task-content">
                    <div class="task-info"><label for="${key}" class="task-title">${task.title}</label></div>
                    ${delBtn}
                </div>
            </div>`;
    }
}

function addSpecificTask(titleText) {
    const newTask = { 
        id: "t_" + Date.now(), 
        color: "blue", 
        title: `${titleText} của ${currentUser}`, 
        owner: currentUser, 
        completed: false 
    };
    db.ref(`global_calendarTasks_v2/${currentSelectedDay}`).push(newTask);
}

function addTask() {
    const inputField = document.getElementById('newTaskInput');
    const title = inputField.value.trim(); 
    if (title === "") return; 
    addSpecificTask(title);
    inputField.value = ""; 
}

function toggleTask(dayNumber, taskKey) {
    const task = tasksData[dayNumber][taskKey];
    db.ref(`global_calendarTasks_v2/${dayNumber}/${taskKey}`).update({
        completed: !task.completed
    });
}

function deleteTask(dayNumber, taskKey) {
    if (confirm("Xóa công việc này?")) {
        db.ref(`global_calendarTasks_v2/${dayNumber}/${taskKey}`).remove();
    }
}

function handleKeyPress(event) { 
    if (event.key === "Enter") addTask(); 
}

function renderSuggestedTasks() {
    const container = document.getElementById('suggestedTasksContainer');
    if (!container) return;
    container.innerHTML = '';
    defaultSuggestedTasks.forEach(taskStr => {
        const btn = document.createElement('button');
        btn.className = 'suggested-task-btn';
        btn.textContent = "+ " + taskStr;
        btn.onclick = () => addSpecificTask(taskStr);
        container.appendChild(btn);
    });
}

// --- QUẢN LÝ NƯỚC (DỮ LIỆU RIÊNG TỪNG USER TRÊN CLOUD) ---
function loadWaterData() {
    db.ref(`waterData/${currentUser}`).on('value', (snapshot) => {
        const data = snapshot.val();
        const today = new Date().toDateString();
        
        if (data) {
            waterData = data;
            // Kiểm tra qua ngày mới
            if (waterData.lastDate !== today) {
                waterData.consumedLiters = 0;
                waterData.history = [];
                waterData.lastDate = today;
                db.ref(`waterData/${currentUser}`).set(waterData);
            }
        } else {
            waterData = { goalLiters: 0, bottleVolLiters: 0, consumedLiters: 0, history: [], lastDate: today };
        }
        
        // Update UI
        if (waterData.goalLiters > 0) {
            document.getElementById('goalText').textContent = waterData.goalLiters.toFixed(1);
            document.getElementById('btnBottleVol').textContent = waterData.bottleVolLiters * 1000;
            updateWaterUI(); 
            renderWaterHistory();
            showWaterScreen('screen-tracker');
        } else {
            showWaterScreen('screen-goal');
        }
    });
}

function toggleWaterModal() { document.getElementById('waterModalOverlay').classList.toggle('open'); }
function showWaterScreen(id) { document.querySelectorAll('.water-screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }

function calculateGoal() {
    const weight = parseFloat(document.getElementById('weightInput').value);
    if (isNaN(weight) || weight <= 0) { document.getElementById('weightError').style.display = 'block'; return; }
    document.getElementById('weightError').style.display = 'none';

    const minL = weight * 0.03; const maxL = weight * 0.04;
    document.getElementById('waterRecommendationText').innerHTML = `💡 Cần uống từ <b>${minL.toFixed(1)}L - ${maxL.toFixed(1)}L</b> mỗi ngày.`;

    const select = document.getElementById('goalSelect'); select.innerHTML = ''; 
    for (let i = Math.ceil(minL * 10); i <= Math.floor(maxL * 10); i++) select.innerHTML += `<option value="${(i / 10).toFixed(1)}">${(i / 10).toFixed(1)} L</option>`;
    document.getElementById('goalSelectionArea').style.display = 'block';
}

function goToScreenBottle() {
    waterData.goalLiters = parseFloat(document.getElementById('goalSelect').value);
    db.ref(`waterData/${currentUser}`).set(waterData); 
    showWaterScreen('screen-bottle');
}

function goToScreenTracker() {
    const bottleMl = parseInt(document.getElementById('bottleInput').value);
    if (isNaN(bottleMl) || bottleMl <= 0) { document.getElementById('bottleError').style.display = 'block'; return; }
    document.getElementById('bottleError').style.display = 'none';
    waterData.bottleVolLiters = bottleMl / 1000;
    db.ref(`waterData/${currentUser}`).set(waterData);
    document.getElementById('btnBottleVol').textContent = bottleMl;
    document.getElementById('goalText').textContent = waterData.goalLiters.toFixed(1);
    updateWaterUI(); showWaterScreen('screen-tracker');
}

function addBottle() {
    waterData.consumedLiters += waterData.bottleVolLiters;
    const now = new Date(); 
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if(!waterData.history) waterData.history = [];
    waterData.history.unshift({ text: `💦 Đã uống ${waterData.bottleVolLiters * 1000}ml`, time: time });
    db.ref(`waterData/${currentUser}`).set(waterData);
}

function updateWaterUI() {
    const consumedTxt = document.getElementById('consumedText');
    const progress = document.getElementById('progressBar');
    if(!consumedTxt || !progress) return;

    consumedTxt.textContent = waterData.consumedLiters.toFixed(2);
    let p = (waterData.consumedLiters / waterData.goalLiters) * 100;
    progress.style.width = Math.min(p, 100) + '%';
    progress.style.backgroundColor = (p >= 100) ? '#2ecc71' : 'var(--water-primary)'; 
}

function renderWaterHistory() {
    const container = document.getElementById('historyContainer');
    const list = document.getElementById('historyList');
    if(!container || !list) return;

    if (!waterData.history || waterData.history.length === 0) return container.style.display = 'none';
    container.style.display = 'block'; 
    list.innerHTML = waterData.history.map(i => `<li><span>${i.text}</span> <span class="time-badge">${i.time}</span></li>`).join('');
}

function resetWaterApp() {
    if(confirm(`Cài đặt lại app nước của [${currentUser}]?`)) { 
        db.ref(`waterData/${currentUser}`).remove();
        document.getElementById('goalSelectionArea').style.display = 'none';
        showWaterScreen('screen-goal');
    }
}

// Chạy khởi tạo
window.onload = initAuth;