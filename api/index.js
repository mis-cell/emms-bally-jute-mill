// ── CONFIGURATION ────────────────────────────────────────────
const SUPABASE_URL  = "https://yksrbucnboocbeqspbfo.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrc3JidWNuYm9vY2JlcXNwYmZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE5MDkyNSwiZXhwIjoyMDkwNzY2OTI1fQ.c_myWAzQz4jzZTM843lXCWBTIyFh3YEzhKZl7sbX3qs"; 
const RESEND_KEY    = "sb_publishable_7hHGKm7Hpb6FoL9C02ZDkA_s_EpVYFo"; 

// ── CORS headers ──────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k, v));

  try {
    let action, data;

    if (req.method === 'GET') {
      action = req.query.action;
      data   = req.query.data ? JSON.parse(decodeURIComponent(req.query.data)) : {};
    } else {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      action = body.action;
      data   = body.data || {};
    }

    if (!action) return res.status(400).json({ success: false, message: 'No action specified' });

    const result = await route(action, data);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Router ────────────────────────────────────────────────────
async function route(action, data) {
  switch (action) {
    case 'login':                    return login(data);
    case 'getUsers':                 return getUsers();
    case 'addUser':                  return addUser(data);
    case 'updateUser':               return updateUser(data);
    case 'deleteUser':               return deleteUser(data);
    case 'getWorkers':               return getWorkers(data);
    case 'addWorker':                return addWorker(data);
    case 'updateWorker':             return updateWorker(data);
    case 'deleteWorker':             return deleteWorker(data);
    case 'getMeters':                return getMeters(data);
    case 'addMeter':                 return addMeter(data);
    case 'updateMeter':              return updateMeter(data);
    case 'deleteMeter':              return deleteMeter(data);
    case 'getReadings':              return getReadings(data);
    case 'addReading':               return addReading(data);
    case 'updateReading':            return updateReading(data);
    case 'deleteReading':            return deleteReading(data);
    case 'getMasterReadings':        return getMasterReadings();
    case 'addMasterReading':         return addMasterReading(data);
    case 'getDashboardData':         return getDashboardData();
    case 'getYearlyConsumption':     return getYearlyConsumption(data);
    case 'getAnomalies':             return getAnomalies(data);
    case 'getInactiveWithConsumption': return getInactiveWithConsumption();
    case 'getReport':                return getReport(data);
    case 'getSettings':              return getSettings();
    case 'saveSettings':             return saveSettings(data);
    case 'sendAlertEmail':           return sendAlertEmail(data);
    case 'getAlertLog':              return getAlertLog();
    default: return { success: false, message: 'Unknown action: ' + action };
  }
}

// ── Supabase REST helper ──────────────────────────────────────
async function sb(path, method = 'GET', body = null, extra = '') {
  const url = `${SUPABASE_URL}/rest/v1/${path}${extra}`;
  const opts = {
    method,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        method === 'GET' ? 'count=exact' : 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  if (!text) return [];
  try { return JSON.parse(text); } catch { return []; }
}

function hashPass(p) {
  const { createHash } = require('crypto');
  return createHash('sha256').update(p).digest('hex');
}

// ── AUTH ──────────────────────────────────────────────────────
async function login({ username, password }) {
  const hashed = hashPass(password);
  const rows = await sb(`users?username=eq.${encodeURIComponent(username)}&password=eq.${hashed}&status=eq.active&select=id,username,role,full_name,email`);
  if (!rows.length) return { success: false, message: 'Invalid credentials or account inactive' };
  const u = rows[0];
  await sb(`users?id=eq.${u.id}`, 'PATCH', { last_login: new Date().toISOString() });
  // Map fields to match HTML (full_name -> fullName)
  return { success: true, user: { id: u.id, username: u.username, role: u.role, fullName: u.full_name, email: u.email } };
}

// ── USERS ─────────────────────────────────────────────────────
async function getUsers() {
  const rows = await sb('users?select=id,username,role,full_name,email,phone,status,created_at,last_login&order=created_at.asc');
  // MAPPING: Ensure DB keys match Frontend table headers
  const mappedData = rows.map(u => ({
    UserID: u.id,
    Username: u.username,
    Role: u.role,
    FullName: u.full_name,
    Email: u.email,
    Phone: u.phone,
    Status: u.status,
    CreatedAt: u.created_at,
    LastLogin: u.last_login
  }));
  return { success: true, data: mappedData };
}
async function addUser({ username, password, role, fullName, email, phone }) {
  const row = await sb('users', 'POST', { username, password: hashPass(password), role, full_name: fullName||'', email:email||'', phone:phone||'', status:'active' });
  return { success: true, message: 'User added', data: row };
}
async function updateUser({ id, role, fullName, email, phone, status, password }) {
  const patch = { role, full_name: fullName, email, phone, status };
  if (password) patch.password = hashPass(password);
  await sb(`users?id=eq.${id}`, 'PATCH', patch);
  return { success: true, message: 'User updated' };
}
async function deleteUser({ id }) {
  await sb(`users?id=eq.${id}`, 'DELETE');
  return { success: true, message: 'User deleted' };
}

// ── WORKERS ───────────────────────────────────────────────────
async function getWorkers({ status } = {}) {
  let q = 'workers?select=*&order=created_at.asc';
  if (status) q += `&status=eq.${status}`;
  const rows = await sb(q);
  // MAPPING
  const mapped = rows.map(w => ({
    WorkerID: w.id,
    EmployeeCode: w.employee_code,
    Name: w.name,
    Department: w.department,
    Designation: w.designation,
    Phone: w.phone,
    Email: w.email,
    JoiningDate: w.joining_date,
    Status: w.status,
    Address: w.address,
    MeterNumber: w.meter_number,
    CreatedAt: w.created_at
  }));
  return { success: true, data: mapped };
}
async function addWorker(d) {
  const row = await sb('workers', 'POST', {
    employee_code: d.EmployeeCode||d.employee_code||'',
    name: d.Name||d.name,
    department: d.Department||d.department||'',
    designation: d.Designation||d.designation||'',
    phone: d.Phone||d.phone||'',
    email: d.Email||d.email||'',
    joining_date: d.JoiningDate||d.joining_date||null,
    status: d.Status||d.status||'active',
    address: d.Address||d.address||'',
    meter_number: d.MeterNumber||d.meter_number||''
  });
  return { success: true, message: 'Worker added', data: row };
}
async function updateWorker(d) {
  const id = d.id || d.WorkerID;
  await sb(`workers?id=eq.${id}`, 'PATCH', {
    employee_code: d.EmployeeCode||d.employee_code,
    name: d.Name||d.name,
    department: d.Department||d.department,
    designation: d.Designation||d.designation,
    phone: d.Phone||d.phone,
    email: d.Email||d.email,
    joining_date: d.JoiningDate||d.joining_date||null,
    status: d.Status||d.status,
    address: d.Address||d.address,
    meter_number: d.MeterNumber||d.meter_number
  });
  return { success: true, message: 'Worker updated' };
}
async function deleteWorker({ id, WorkerID }) {
  await sb(`workers?id=eq.${id||WorkerID}`, 'DELETE');
  return { success: true, message: 'Worker deleted' };
}

// ── METERS ────────────────────────────────────────────────────
async function getMeters({ status } = {}) {
  let q = 'meters?select=*&order=meter_number.asc';
  if (status) q += `&status=eq.${status}`;
  const rows = await sb(q);
  // MAPPING
  const mapped = rows.map(m => ({
    MeterID: m.id,
    MeterNumber: m.meter_number,
    Location: m.location,
    WorkerID: m.worker_id,
    WorkerName: m.worker_name,
    InstallDate: m.install_date,
    Status: m.status,
    MaxLoad: m.max_load,
    Phase: m.phase,
    Remarks: m.remarks,
    CreatedAt: m.created_at
  }));
  return { success: true, data: mapped };
}
async function addMeter(d) {
  const row = await sb('meters', 'POST', {
    meter_number: d.MeterNumber||d.meter_number,
    location: d.Location||d.location||'',
    worker_id: d.WorkerID||d.worker_id||null,
    worker_name: d.WorkerName||d.worker_name||'',
    install_date: d.InstallDate||d.install_date||null,
    status: d.Status||d.status||'active',
    max_load: d.MaxLoad||d.max_load||10,
    phase: d.Phase||d.phase||'1-Phase',
    remarks: d.Remarks||d.remarks||''
  });
  return { success: true, message: 'Meter added', data: row };
}
async function updateMeter(d) {
  const id = d.id || d.MeterID;
  await sb(`meters?id=eq.${id}`, 'PATCH', {
    meter_number: d.MeterNumber||d.meter_number,
    location: d.Location||d.location,
    worker_id: d.WorkerID||d.worker_id||null,
    worker_name: d.WorkerName||d.worker_name,
    status: d.Status||d.status,
    max_load: d.MaxLoad||d.max_load,
    phase: d.Phase||d.phase,
    remarks: d.Remarks||d.remarks
  });
  return { success: true, message: 'Meter updated' };
}
async function deleteMeter({ id, MeterID }) {
  await sb(`meters?id=eq.${id||MeterID}`, 'DELETE');
  return { success: true, message: 'Meter deleted' };
}

// ── READINGS ──────────────────────────────────────────────────
async function getReadings({ meter_id, worker_id, month, year } = {}) {
  let q = 'meter_readings?select=*&order=reading_date.desc';
  if (meter_id)  q += `&meter_id=eq.${meter_id}`;
  if (worker_id) q += `&worker_id=eq.${worker_id}`;
  if (month)     q += `&month=eq.${month}`;
  if (year)      q += `&year=eq.${year}`;
  const rows = await sb(q);
  // MAPPING
  const mapped = rows.map(r => ({
    ReadingID: r.id,
    MeterID: r.meter_id,
    MeterNumber: r.meter_number,
    WorkerID: r.worker_id,
    WorkerName: r.worker_name,
    ReadingDate: r.reading_date,
    ReadingValue: r.reading_value,
    PreviousReading: r.previous_reading,
    Consumption: r.consumption,
    Month: r.month,
    Year: r.year,
    EnteredBy: r.entered_by,
    IsAnomaly: r.is_anomaly ? 'true' : 'false', // Frontend checks for string 'true'
    AnomalyReason: r.anomaly_reason,
    CreatedAt: r.created_at
  }));
  return { success: true, data: mapped };
}

async function addReading(d) {
  const readingDate = d.ReadingDate || d.reading_date || new Date().toISOString().split('T')[0];
  const dt = new Date(readingDate);
  const month = dt.getMonth() + 1;
  const year  = dt.getFullYear();

  const row = await sb('meter_readings', 'POST', {
    meter_id:         d.MeterID   || d.meter_id,
    meter_number:     d.MeterNumber || d.meter_number,
    worker_id:        d.WorkerID  || d.worker_id || null,
    worker_name:      d.WorkerName || d.worker_name || '',
    reading_date:     readingDate,
    reading_value:    parseFloat(d.ReadingValue  || d.reading_value),
    previous_reading: parseFloat(d.PreviousReading || d.previous_reading || 0),
    month, year,
    entered_by: d.EnteredBy || d.entered_by || 'user'
  });

  const consumption = parseFloat(d.ReadingValue||d.reading_value) - parseFloat(d.PreviousReading||d.previous_reading||0);
  checkAnomaly(d.MeterID||d.meter_id, d.MeterNumber||d.meter_number, d.WorkerID||d.worker_id, d.WorkerName||d.worker_name, consumption, month, year);

  return { success: true, message: 'Reading added', data: row };
}

async function updateReading(d) {
  const id = d.id || d.ReadingID;
  await sb(`meter_readings?id=eq.${id}`, 'PATCH', {
    reading_value:    parseFloat(d.ReadingValue||d.reading_value),
    previous_reading: parseFloat(d.PreviousReading||d.previous_reading||0),
    reading_date:     d.ReadingDate||d.reading_date,
    entered_by:       d.EnteredBy||d.entered_by
  });
  return { success: true, message: 'Reading updated' };
}

async function deleteReading({ id, ReadingID }) {
  await sb(`meter_readings?id=eq.${id||ReadingID}`, 'DELETE');
  return { success: true, message: 'Reading deleted' };
}

// ── MASTER METER ──────────────────────────────────────────────
async function getMasterReadings() {
  const rows = await sb('master_meter_readings?select=*&order=reading_date.desc&limit=50');
  // MAPPING
  const mapped = rows.map(m => ({
    ReadingID: m.id,
    ReadingDate: m.reading_date,
    ReadingValue: m.reading_value,
    PreviousReading: m.previous_reading,
    Consumption: m.consumption,
    Month: m.month,
    Year: m.year,
    EnteredBy: m.entered_by,
    Remarks: m.remarks,
    CreatedAt: m.created_at
  }));
  return { success: true, data: mapped };
}
async function addMasterReading(d) {
  const readingDate = d.ReadingDate||d.reading_date||new Date().toISOString().split('T')[0];
  const dt = new Date(readingDate);
  const row = await sb('master_meter_readings', 'POST', {
    reading_date:     readingDate,
    reading_value:    parseFloat(d.ReadingValue||d.reading_value),
    previous_reading: parseFloat(d.PreviousReading||d.previous_reading||0),
    month: dt.getMonth()+1, year: dt.getFullYear(),
    entered_by: d.EnteredBy||d.entered_by||'admin',
    remarks: d.Remarks||d.remarks||''
  });
  return { success: true, message: 'Master reading added', data: row };
}

// ── DASHBOARD ─────────────────────────────────────────────────
async function getDashboardData() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const lastMonth = month === 1 ? 12 : month - 1;
  const lastYear  = month === 1 ? year - 1 : year;

  const [workers, meters, anomalies, thisMonthR, lastMonthR, masterR] = await Promise.all([
    sb('workers?select=id,status'),
    sb('meters?select=id,status'),
    sb('anomalies?select=id,status&status=eq.open'),
    sb(`meter_readings?select=id,consumption,meter_number,worker_name,month,year&month=eq.${month}&year=eq.${year}`),
    sb(`meter_readings?select=consumption&month=eq.${lastMonth}&year=eq.${lastYear}`),
    sb('master_meter_readings?select=reading_value,reading_date&order=reading_date.desc&limit=1')
  ]);

  const totalThisMonth = thisMonthR.reduce((s,r) => s + parseFloat(r.consumption||0), 0);
  const totalLastMonth = lastMonthR.reduce((s,r) => s + parseFloat(r.consumption||0), 0);
  const change = totalLastMonth > 0 ? (((totalThisMonth - totalLastMonth) / totalLastMonth) * 100).toFixed(1) : 0;

  const monthlyTrend = [];
  for (let i = 11; i >= 0; i--) {
    const d  = new Date(year, now.getMonth() - i, 1);
    const m2 = d.getMonth() + 1;
    const y2 = d.getFullYear();
    const rows = await sb(`meter_readings?select=consumption&month=eq.${m2}&year=eq.${y2}`);
    const total = rows.reduce((s,r) => s + parseFloat(r.consumption||0), 0);
    monthlyTrend.push({ month: m2, year: y2, label: d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}), consumption: total, count: rows.length });
  }

  const yearReadings = await sb(`meter_readings?select=consumption,worker_id&year=eq.${year}`);
  const allWorkers   = await sb('workers?select=id,department');
  const workerDeptMap = Object.fromEntries(allWorkers.map(w => [w.id, w.department]));
  const deptConsumption = {};
  yearReadings.forEach(r => {
    const dept = workerDeptMap[r.worker_id] || 'Unknown';
    deptConsumption[dept] = (deptConsumption[dept]||0) + parseFloat(r.consumption||0);
  });

  const topConsumers = thisMonthR
    .map(r => ({ MeterNumber: r.meter_number, WorkerName: r.worker_name, Consumption: r.consumption, Month: r.month, Year: r.year }))
    .sort((a,b) => parseFloat(b.Consumption)-parseFloat(a.Consumption))
    .slice(0,10);

  return {
    success: true,
    data: {
      summary: {
        totalMeters:              meters.length,
        activeMeters:             meters.filter(m=>m.status==='active').length,
        inactiveWorkers:          workers.filter(w=>w.status==='inactive').length,
        totalReadingsThisMonth:   thisMonthR.length,
        totalConsumptionThisMonth: totalThisMonth.toFixed(2),
        totalConsumptionLastMonth: totalLastMonth.toFixed(2),
        consumptionChange:         change,
        openAnomalies:             anomalies.length,
        totalWorkers:              workers.length,
        activeWorkers:             workers.filter(w=>w.status==='active').length,
        masterMeterReadings:       masterR.length
      },
      monthlyTrend, topConsumers, deptConsumption
    }
  };
}

async function getYearlyConsumption({ year }) {
  const y = year || new Date().getFullYear();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const result = [];
  for (let m = 1; m <= 12; m++) {
    const rows = await sb(`meter_readings?select=consumption&month=eq.${m}&year=eq.${y}`);
    const total = rows.reduce((s,r) => s + parseFloat(r.consumption||0), 0);
    result.push({ month: m, label: months[m-1], total, count: rows.length });
  }
  return { success: true, data: result };
}

// ── ANOMALIES ─────────────────────────────────────────────────
async function getAnomalies({ type, year } = {}) {
  let q = 'anomalies?select=*&order=created_at.desc';
  if (type) q += `&type=eq.${type}`;
  if (year) q += `&year=eq.${year}`;
  const rows = await sb(q);
  // MAPPING
  const mapped = rows.map(a => ({
    AnomalyID: a.id,
    MeterID: a.meter_id,
    MeterNumber: a.meter_number,
    WorkerID: a.worker_id,
    WorkerName: a.worker_name,
    Month: a.month,
    Year: a.year,
    Consumption: a.consumption,
    AverageConsumption: a.average_consumption,
    DeviationPercent: a.deviation_percent,
    Type: a.type,
    Status: a.status,
    AlertSent: a.alert_sent ? 'true' : 'false',
    CreatedAt: a.created_at
  }));
  return { success: true, data: mapped };
}

async function checkAnomaly(meterId, meterNumber, workerId, workerName, consumption, month, year) {
  try {
    const past = await sb(`meter_readings?meter_id=eq.${meterId}&select=consumption&order=reading_date.desc&limit=6`);
    if (past.length < 2) return;
    const avg = past.reduce((s,r)=>s+parseFloat(r.consumption||0),0) / past.length;
    if (avg === 0) return;

    const settingsRes = await getSettings();
    const settings = settingsRes.data || {};
    const highT = parseFloat(settings.alert_threshold_high||150);
    const lowT  = parseFloat(settings.alert_threshold_low||20);
    const deviation = ((consumption - avg) / avg) * 100;

    let type = null;
    if (deviation > highT)                         type = 'HIGH';
    else if (consumption < (avg * lowT / 100))     type = 'LOW';
    if (!type) return;

    await sb('anomalies', 'POST', {
      meter_id: meterId, meter_number: meterNumber,
      worker_id: workerId, worker_name: workerName,
      month, year, consumption, average_consumption: avg,
      deviation_percent: deviation.toFixed(2), type, status: 'open'
    });

    await sb(`meter_readings?meter_id=eq.${meterId}&month=eq.${month}&year=eq.${year}`,
      'PATCH', { is_anomaly: true, anomaly_reason: `${type} consumption — ${deviation.toFixed(1)}% vs avg ${avg.toFixed(0)}` });

    const emails = (settings.supervisor_emails||'').split(',').map(e=>e.trim()).filter(Boolean);
    if (emails.length) {
      sendAlertEmail({
        to: emails.join(','),
        subject: `⚠️ EMMS Alert: ${type} Consumption — ${workerName} (${meterNumber})`,
        body: `Anomaly detected:\nWorker: ${workerName}\nMeter: ${meterNumber}\nMonth: ${month}/${year}\nConsumption: ${consumption} units\nAverage: ${avg.toFixed(0)} units\nDeviation: ${deviation.toFixed(1)}%\n\n— EMMS Bally Jute Mill`
      });
    }
  } catch(e) { console.error('anomaly check:', e.message); }
}

async function getInactiveWithConsumption() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const inactive = await sb('workers?status=eq.inactive&select=id,name,department,phone,meter_number');
  if (!inactive.length) return { success: true, data: [] };
  const ids = inactive.map(w=>`'${w.id}'`).join(',');
  const readings = await sb(`meter_readings?worker_id=in.(${ids})&month=eq.${month}&year=eq.${year}&consumption=gt.0&select=*`);
  // MAPPING
  const result = readings.map(r => {
    const w = inactive.find(w=>w.id===r.worker_id)||{};
    return {
      MeterNumber: r.meter_number,
      WorkerName: w.name || r.worker_name,
      Month: r.month,
      Year: r.year,
      Consumption: r.consumption,
      Department: w.department,
      WorkerPhone: w.phone
    };
  });
  return { success: true, data: result };
}

// ── REPORTS ───────────────────────────────────────────────────
async function getReport({ reportType, filters = {} }) {
  let q = 'meter_readings?select=*';
  switch (reportType) {
    case 'monthly':      q += `&month=eq.${filters.month}&year=eq.${filters.year}`; break;
    case 'yearly':       q += `&year=eq.${filters.year}`; break;
    case 'quarterly': {
      const qm = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};
      const ms = (qm[filters.quarter]||[1,2,3]).join(',');
      q += `&month=in.(${ms})&year=eq.${filters.year}`; break;
    }
    case 'half_yearly': {
      const ms = filters.half==1 ? '1,2,3,4,5,6' : '7,8,9,10,11,12';
      q += `&month=in.(${ms})&year=eq.${filters.year}`; break;
    }
    case 'daily':        q += `&reading_date=eq.${filters.date}`; break;
    case 'meter_wise':   if (filters.meterNumber) q += `&meter_number=eq.${filters.meterNumber}`; break;
    case 'worker_wise':  if (filters.workerID)    q += `&worker_id=eq.${filters.workerID}`; break;
    case 'anomalies':    return getAnomalies(filters);
    case 'inactive_consuming': return getInactiveWithConsumption();
  }
  q += '&order=reading_date.desc';
  if (filters.weekStart) {
    const ws = new Date(filters.weekStart);
    const we = new Date(ws); we.setDate(we.getDate()+6);
    q = `meter_readings?select=*&reading_date=gte.${ws.toISOString().split('T')[0]}&reading_date=lte.${we.toISOString().split('T')[0]}&order=reading_date.desc`;
  }
  const rows = await sb(q);
  // MAPPING FOR REPORT TABLE
  const mapped = rows.map(r => ({
    MeterNumber: r.meter_number,
    WorkerName: r.worker_name,
    ReadingDate: r.reading_date,
    PreviousReading: r.previous_reading,
    ReadingValue: r.reading_value,
    Consumption: r.consumption,
    Month: r.month,
    Year: r.year,
    IsAnomaly: r.is_anomaly ? 'true' : 'false'
  }));
  return { success: true, data: mapped, count: mapped.length };
}

// ── SETTINGS ──────────────────────────────────────────────────
async function getSettings() {
  const rows = await sb('settings?select=key,value');
  const data = Object.fromEntries(rows.map(r=>[r.key,r.value]));
  return { success: true, data };
}
async function saveSettings(data) {
  for (const [key, value] of Object.entries(data)) {
    await sb(`settings?key=eq.${key}`, 'PATCH', { value, updated_at: new Date().toISOString() });
  }
  return { success: true, message: 'Settings saved' };
}

// ── EMAIL (Resend API) ────────────────────
async function sendAlertEmail({ to, subject, body }) {
  if (RESEND_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'EMMS <alerts@yourdomain.com>', to: to.split(','), subject, text: body })
      });
      const result = await r.json();
      await sb('alert_log', 'POST', { alert_type:'EMAIL', recipient:to, subject, message:body, status: r.ok?'sent':'failed' });
      return { success: r.ok, message: r.ok ? 'Email sent' : result.message };
    } catch(e) {
      return { success: false, message: e.message };
    }
  }
  await sb('alert_log', 'POST', { alert_type:'EMAIL', recipient:to, subject, message:body, status:'no_provider' });
  return { success: false, message: 'No email provider configured.' };
}

async function getAlertLog() {
  const rows = await sb('alert_log?select=*&order=sent_at.desc&limit=50');
  // MAPPING
  const mapped = rows.map(l => ({
    AlertType: l.alert_type,
    RecipientEmail: l.recipient,
    Status: l.status,
    SentAt: l.sent_at
  }));
  return { success: true, data: mapped };
}
