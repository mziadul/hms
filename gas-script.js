/**
 * Google Apps Script for user login, token auth, and management.
 * Logic: Configuration -> Security -> Entry Points -> API Methods -> Helpers
 */

// --- 1. CONFIGURATION ---
const TOKEN_SECRET = 'REPLACE_WITH_RANDOM_SECRET'; // আপনার গোপন পাসওয়ার্ড দিন
const TOKEN_EXPIRY_MINUTES = 60;

// --- 2. ENTRY POINTS (GET & POST) ---

function doPost(e) {
  var action = e.parameter.action;
  
  // Login is public
  if (action === 'login') return loginUser(e);

  // Security Barrier for all other POST actions
  var currentUser = getAuthorizedUser(e.parameter.token);
  if (!currentUser) return jsonResponse({ error: 'Invalid or expired token' });

  switch (action) {
    case 'addUser': return addUser(e);
    case 'addCostHead': return addCostHead(e);
    case 'updateMeals': return addOrUpdateMealsBatch(e, currentUser);
    case 'getMeals': return getMeals(e, currentUser); // consistency check
    default: return jsonResponse({ error: 'Invalid action' });
  }
}

function doGet(e) {
  var action = e.parameter.action;
  
  // Security Barrier for all GET actions
  var currentUser = getAuthorizedUser(e.parameter.token);
  if (!currentUser) return jsonResponse({ error: 'Invalid or expired token' });

  switch (action) {
    case 'getUsers': return getUsers();
    case 'getCostHeads': 
      return jsonResponse({ 
        costHeads: getCostHeads(), 
        customValues: getCustomValues() 
      });
    case 'getBazarCosts': return getBazarCosts(e);
    case 'getMeals': return getMeals(e, currentUser);
    default: return jsonResponse({ error: 'Invalid action' });
  }
}

// --- 3. SECURITY & AUTHENTICATION ---

/**
 * ইউজার লগইন এবং টোকেন ও বেসিক ইউজার ডাটা রিটার্ন
 */
function loginUser(e) {
  var email = e.parameter.email;
  var password = e.parameter.password;
  var data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users').getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] == email && data[i][3] == password) {
      return jsonResponse({ 
        token: generateToken(email),
        user: { id: data[i][0], name: data[i][1], email: data[i][2], type: data[i][4] }
      });
    }
  }
  return jsonResponse({ error: 'Invalid credentials' });
}

/**
 * টোকেন ভেরিফাই করে ইউজারের অবজেক্ট রিটার্ন করে
 */
function getAuthorizedUser(token) {
  var email = verifyToken(token);
  if (!email) return null;

  var data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users').getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === email) {
      return { id: data[i][0], name: data[i][1], type: data[i][4], email: data[i][2] };
    }
  }
  return null;
}

function generateToken(email) {
  var ts = new Date().getTime();
  var raw = email + '|' + ts;
  var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(raw, TOKEN_SECRET));
  return Utilities.base64Encode(raw + '|' + sig);
}

function verifyToken(token) {
  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    var parts = decoded.split('|');
    if (parts.length !== 3) return null;
    var raw = parts[0] + '|' + parts[1];
    var expectedSig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(raw, TOKEN_SECRET));
    if (parts[2] !== expectedSig) return null;
    if (new Date().getTime() - parseInt(parts[1]) > TOKEN_EXPIRY_MINUTES * 60 * 1000) return null;
    return parts[0];
  } catch (e) { return null; }
}

// --- 4. CORE API METHODS ---

/**
 * নতুন ইউজার অ্যাড করা
 */
function addUser(e) {
  var now = new Date();
  var userRow = [
    e.parameter.id, e.parameter.name, e.parameter.email, 
    e.parameter.password, e.parameter.type, now, now, e.parameter.updatedBy
  ];
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users').appendRow(userRow);
  return jsonResponse({ success: 'User added successfully' });
}

/**
 * সব ইউজারের লিস্ট পাওয়া
 */
function getUsers() {
  var data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users').getDataRange().getValues();
  var users = data.slice(1).map(function(r) {
    return { id: r[0], name: r[1], email: r[2], type: r[4], createdAt: r[5], updatedAt: r[6], updatedBy: r[7] };
  });
  return jsonResponse(users);
}

/**
 * মিল ডাটা রিড করা (ফিল্টারসহ)
 */
function getMeals(e, currentUser) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Meals");
  if (!sheet) return jsonResponse([]);

  var fYear = e.parameter.year, fMonth = e.parameter.month, fDate = e.parameter.date, fUserId = e.parameter.userId;
  var data = sheet.getDataRange().getValues();
  
  var meals = data.slice(1).filter(function(r) {
    var rowUserId = r[1], year = r[2], month = r[3], date = r[4];
    
    // Auth logic
    if (currentUser.type !== "admin" && rowUserId != currentUser.id) return false;
    if (currentUser.type === "admin" && fUserId && rowUserId != fUserId) return false;
    
    // Filter logic
    if (fYear && year != fYear) return false;
    if (fMonth && month != fMonth) return false;
    if (fDate && date != fDate) return false;
    
    return true;
  }).map(function(r) {
    return { id: r[0], userId: r[1], year: r[2], month: r[3], date: r[4], type: r[5], amount: r[6] };
  });

  return jsonResponse(meals);
}

/**
 * ব্যাচ মিল আপডেট বা ইনসার্ট
 */
function addOrUpdateMealsBatch(e, currentUser) {
  var records = JSON.parse(e.parameter.records || "[]");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Meals");
  var data = sheet.getDataRange().getValues();
  var updatedCount = 0, insertedCount = 0;

  records.forEach(function (rec) {
    var mealUserId = (currentUser.type === "admin" && rec.userId) ? parseInt(rec.userId) : currentUser.id;
    var found = false;

    for (var i = 1; i < data.length; i++) {
      if (data[i][1] == mealUserId && data[i][2] == rec.year && data[i][3] == rec.month && data[i][4] == rec.date && data[i][5] == rec.type) {
        sheet.getRange(i + 1, 7).setValue(parseFloat(rec.amount));
        updatedCount++;
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([data.length + insertedCount, mealUserId, rec.year, rec.month, rec.date, rec.type, parseFloat(rec.amount)]);
      insertedCount++;
    }
  });

  return jsonResponse({ success: true, inserted: insertedCount, updated: updatedCount });
}

/**
 * বাজার খরচ পাওয়া
 */
function getBazarCosts(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BazarCost');
  if (!sheet) return jsonResponse({ error: 'BazarCost sheet not found' });
  
  var f = e.parameter;
  var data = sheet.getDataRange().getValues();
  
  var results = data.slice(1).filter(function(r) {
    if (f.id && r[0] != f.id) return false;
    if (f.userId && r[1] != f.userId) return false;
    if (f.year && r[2] != f.year) return false;
    if (f.month && r[3] != f.month) return false;
    if (f.status && r[5] !== f.status) return false;
    return true;
  }).map(function(r) {
    return { id: r[0], userId: r[1], year: r[2], month: r[3], amount: r[4], status: r[5] };
  });

  return jsonResponse(results);
}

// --- 5. HELPERS ---

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function initCostHeadsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("CostHeads") || ss.insertSheet("CostHeads");
  if (sheet.getLastRow() === 0) sheet.appendRow(["id", "name", "type", "createdAt", "updatedAt"]);
  return sheet;
}

function addCostHead(e) {
  if (!e.parameter.name || !e.parameter.type) return jsonResponse({ error: "Missing name or type" });
  var sheet = initCostHeadsSheet();
  var id = sheet.getLastRow(), now = new Date();
  sheet.appendRow([id, e.parameter.name, e.parameter.type, now, now]);
  return jsonResponse({ success: "Cost head added", id: id });
}

function getCostHeads() {
  var data = initCostHeadsSheet().getDataRange().getValues();
  return data.slice(1).map(function(r) {
    return { id: r[0], name: r[1], amount: r[2], type: r[3], createdAt: r[4], updatedAt: r[5] };
  });
}

function getCustomValues() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CustomValues");
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues(), customs = {};
  for (var i = 1; i < data.length; i++) {
    var uId = String(data[i][0]);
    if (!customs[uId]) customs[uId] = {};
    customs[uId][String(data[i][1])] = parseFloat(data[i][2]);
  }
  return customs;
}