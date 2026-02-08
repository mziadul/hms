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
    case 'upsertUsers': return upsertUsers(e, currentUser);
    case 'upsertCostHeads': return upsertCostHeads(e, currentUser);
    case 'updateMeals': return addOrUpdateMealsBatch(e, currentUser);
    case 'getMeals': return getMeals(e, currentUser); // consistency check
    case 'updateBazarSlots': return addOrUpdateBazarSlots(e);
    case 'upsertBazarCosts': return upsertBazarCosts(e, currentUser);
    case 'upsertDateRanges': return upsertDateRanges(e, currentUser);
    case 'upsertCustomValues': return upsertCustomValues(e);
    case 'sendBulkNotifications': return sendBulkNotifications(e);
    case 'updateSelfPassword': return updateSelfPassword(e, currentUser);
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
    case 'getBazarSlots': return getBazarSlots(e);
    case 'getCustomValuesData': return getCustomValuesData(e);
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
  var hashedPassword = hashPassword(password); // ইনপুট পাসওয়ার্ড হ্যাশ করা হচ্ছে
  
  var data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users').getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    // ডাটাবেজের হ্যাশ করা পাসওয়ার্ডের সাথে তুলনা
    if (data[i][2] == email && data[i][3] == hashedPassword) {
      return jsonResponse({ 
        token: generateToken(email),
        user: { id: data[i][0], name: data[i][1], email: data[i][2], type: data[i][4] }
      });
    }
  }
  return jsonResponse({ error: 'Invalid credentials' });
}

/**
 * সাধারণ ইউজার শুধুমাত্র নিজের পাসওয়ার্ড আপডেট করতে পারবে।
 */
function updateSelfPassword(e, currentUser) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var payload = JSON.parse(e.parameter.data);
  var newPassword = payload.newPassword;

  if (!newPassword || newPassword.trim() === "") {
    return jsonResponse({ error: "Password cannot be empty" });
  }

  var foundIndex = -1;
  for (var i = 1; i < data.length; i++) {
    // টোকেন থেকে পাওয়া currentUser.id এর সাথে শিটের ID ম্যাচ করা হচ্ছে
    if (String(data[i][0]) === String(currentUser.id)) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex > -1) {
    // শুধুমাত্র পাসওয়ার্ড কলাম (Index 3) আপডেট হবে
    // hashPassword ফাংশনটি আগের উত্তরের মতো থাকতে হবে
    data[foundIndex][3] = hashPassword(newPassword); 
    data[foundIndex][6] = new Date(); // UpdatedAt
    data[foundIndex][7] = currentUser.name; // UpdatedBy

    sheet.getRange(foundIndex + 1, 1, 1, headers.length).setValues([data[foundIndex]]);
    return jsonResponse({ success: true, message: "Password updated successfully" });
  }

  return jsonResponse({ error: "User not found" });
}

/**
 * পাসওয়ার্ড হ্যাশ করার ফাংশন
 */
function hashPassword(password) {
  if (!password) return "";
  var signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  var hash = "";
  for (var i = 0; i < signature.length; i++) {
    var byte = signature[i];
    if (byte < 0) byte += 256;
    var byteStr = byte.toString(16);
    if (byteStr.length == 1) byteStr = '0' + byteStr;
    hash += byteStr;
  }
  return hash;
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
function upsertUsers(e, currentUser) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  var range = sheet.getDataRange();
  var data = range.getValues(); 
  var headers = data[0];
  
  var payload = JSON.parse(e.parameter.users);
  var incomingUsers = payload.users; 
  var activeIds = payload.activeIds.map(function(id) { return String(id); });

  var now = new Date();

  // 1. FILTER: Handle Deletions
  var updatedData = data.filter(function(row, index) {
    if (index === 0) return true; 
    return activeIds.indexOf(String(row[0])) !== -1;
  });

  // 2. Calculate next ID
  var lastId = 0;
  if (updatedData.length > 1) {
    lastId = Math.max.apply(Math, updatedData.slice(1).map(function(r) { 
      return parseInt(r[0]) || 0; 
    }));
  }

  // 3. UPSERT Logic
  incomingUsers.forEach(function(userInput) {
    var existingRowIndex = -1;
    
    if (userInput.id) {
      for (var i = 1; i < updatedData.length; i++) {
        if (String(updatedData[i][0]) === String(userInput.id)) {
          existingRowIndex = i;
          break;
        }
      }
    }

    if (existingRowIndex > -1) {
      // UPDATE: ID[0], Name[1], Email[2], Pass[3], Type[4], Created[5], Updated[6], By[7]
      updatedData[existingRowIndex][1] = userInput.name;
      updatedData[existingRowIndex][2] = userInput.email;
      
      // EFFECTIVE STORAGE: Only update password if a new one is typed
      if (userInput.password && userInput.password.trim() !== "") {
        updatedData[existingRowIndex][3] = hashPassword(userInput.password);
      }
      
      updatedData[existingRowIndex][4] = userInput.type;
      updatedData[existingRowIndex][6] = now;
      updatedData[existingRowIndex][7] = currentUser.name;
    } else {
      // INSERT: Generate new ID and add row
      lastId++;
      updatedData.push([
        lastId,
        userInput.name,
        userInput.email,
        hashPassword(userInput.password), // Mandatory check is handled in TSX
        userInput.type,
        now, 
        now, 
        currentUser.name
      ]);
    }
  });

  // 4. Atomic Write
  sheet.clearContents();
  sheet.getRange(1, 1, updatedData.length, headers.length).setValues(updatedData);

  return jsonResponse({ success: true });
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

  // প্যারামিটার থেকে ফিল্টারগুলো নেওয়া হচ্ছে
  var fYear = e.parameter.year, 
      fMonth = e.parameter.month, 
      fDate = e.parameter.date, 
      fUserId = e.parameter.userId;

  var data = sheet.getDataRange().getValues();
  
  var meals = data.slice(1).filter(function(r) {
    // এখানে কোনো Admin/User চেক নেই
    // যদি fUserId দেওয়া থাকে তবে শুধু সেই ইউজারের ডেটা দেখাবে, নতুবা সবারটা
    if (fUserId && String(r[1]) !== String(fUserId)) return false;
    
    // তারিখের ফিল্টারগুলো
    if (fYear && r[2] != fYear) return false;
    if (fMonth && r[3] != fMonth) return false;
    if (fDate && r[4] != fDate) return false;
    
    return true;
  }).map(function(r) {
    return { id: r[0], userId: r[1], year: r[2], month: r[3], date: r[4], type: r[5], amount: r[6] };
  });

  return jsonResponse(meals);
}

/**
 * ব্যাচ মিল আপডেট বা ইনসার্ট
 */
/**
 * ব্যাচ মিল আপডেট বা ইনসার্ট (With Create, Update, and Delete Logging)
 */
function addOrUpdateMealsBatch(e, currentUser) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    
    var records = JSON.parse(e.parameter.records || "[]");
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Meals");
    var data = sheet.getDataRange().getValues();
    
    var updatedCount = 0, insertedCount = 0, deletedCount = 0;

    records.forEach(function (rec) {
      var mealUserId = rec.userId ? String(rec.userId) : String(currentUser.id);
      var foundRowIndex = -1;
      var existingData = null;

      // ১. বিদ্যমান রেকর্ড খোঁজা
      for (var i = 1; i < data.length; i++) {
        if (
          String(data[i][1]) === mealUserId && 
          data[i][2] == rec.year && 
          data[i][3] == rec.month && 
          data[i][4] == rec.date && 
          data[i][5] == rec.type
        ) {
          foundRowIndex = i + 1;
          existingData = {
            id: data[i][0],
            userId: data[i][1],
            year: data[i][2],
            month: data[i][3],
            date: data[i][4],
            type: data[i][5],
            oldAmount: data[i][6]
          };
          break;
        }
      }

      var isValueEmpty = (rec.amount === "" || rec.amount === null || rec.amount === undefined);

      if (foundRowIndex !== -1) {
        // --- UPDATE or DELETE Logic ---
        if (isValueEmpty) {
          logMealAction("DELETE", existingData, null, currentUser);
          sheet.deleteRow(foundRowIndex);
          data = sheet.getDataRange().getValues(); 
          deletedCount++;
        } else {
          var newAmt = parseFloat(rec.amount);
          if (existingData.oldAmount != newAmt) {
            logMealAction("UPDATE", existingData, newAmt, currentUser);
          }
          sheet.getRange(foundRowIndex, 7).setValue(newAmt);
          updatedCount++;
        }
      } else if (!isValueEmpty) {
        // --- CREATE Logic ---
        var maxId = 0;
        for (var j = 1; j < data.length; j++) {
          var currentId = parseInt(data[j][0]);
          if (!isNaN(currentId) && currentId > maxId) {
            maxId = currentId;
          }
        }
        var newId = maxId + 1;
        var newAmount = parseFloat(rec.amount);

        // Append to sheet
        sheet.appendRow([
          newId, 
          mealUserId, 
          rec.year, 
          rec.month, 
          rec.date, 
          rec.type, 
          newAmount
        ]);
        
        // Log the creation
        logMealAction("CREATE", {
          id: newId,
          userId: mealUserId,
          year: rec.year,
          month: rec.month,
          date: rec.date,
          type: rec.type,
          oldAmount: 0 // No previous amount for new records
        }, newAmount, currentUser);

        data = sheet.getDataRange().getValues();
        insertedCount++;
      }
    });

    return jsonResponse({ 
      success: true, 
      inserted: insertedCount, 
      updated: updatedCount, 
      deleted: deletedCount 
    });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function logMealAction(action, oldRecord, newAmount, currentUser) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName("MealLogs");
  
  // শিট না থাকলে তৈরি করা
  if (!logSheet) {
    logSheet = ss.insertSheet("MealLogs");
    logSheet.appendRow([
      "Log ID", "Action", "Timestamp", "Performed By (Name)",
      "Meal ID", "Target User ID", "Date Info", "Type", 
      "Old Amount", "New Amount"
    ]);
    logSheet.getRange("1:1").setFontWeight("bold").setBackground("#f3f3f3");
    logSheet.setFrozenRows(1);
  }

  var logId = "LOG-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  var timestamp = new Date();
  var dateStr = oldRecord.year + "-" + oldRecord.month + "-" + oldRecord.date;
  
  // লগ ডাটা ইনসার্ট করা
  logSheet.appendRow([
    logId,
    action,
    timestamp,
    currentUser.name || ("User " + currentUser.id),
    oldRecord.id,         // Meals শিটের অরিজিনাল ID কলাম
    oldRecord.userId,     // কার মিল পরিবর্তন করা হয়েছে
    dateStr,
    oldRecord.type,
    oldRecord.oldAmount,
    newAmount === null ? "DELETED" : newAmount
  ]);
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

/**
 * Optimized Upsert for Bazar Costs
 * Matches exactly: ID, User ID, Year, Month, Amount, Status (6 Columns)
 */
function upsertBazarCosts(e, currentUser) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('BazarCost');
    if (!sheet) return jsonResponse({ error: "Sheet 'BazarCost' not found" });

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    // Parse Payload
    var payload = JSON.parse(e.parameter.data || "{}");
    var incomingItems = payload.items || []; 
    var activeIds = (payload.activeIds || []).map(function(id) { return String(id); });
    
    // Period Filters from URL params (Forced to String)
    var filterYear = String(e.parameter.year || "").trim(); 
    var filterMonth = String(e.parameter.month || "").trim();

    var finalRows = [headers];
    var updatedCount = 0;
    var insertedCount = 0;

    // 1. Process Existing Data
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowId = String(row[0]);
      var rowYear = String(row[2]).trim(); 
      var rowMonth = String(row[3]).trim();

      // Check if row belongs to current filter period
      if (rowYear === filterYear && rowMonth === filterMonth) {
        // Keep only if ID is still in UI (handles deletions)
        if (activeIds.indexOf(rowId) !== -1) {
          // Check for Updates
          var updateItem = incomingItems.find(function(item) { 
            return item.id && String(item.id) === rowId; 
          });

          if (updateItem) {
            row[1] = String(updateItem.userId);
            row[4] = Number(updateItem.amount);
            row[5] = updateItem.status;
            updatedCount++;
          }
          finalRows.push(row);
        }
      } else {
        // Keep data from all other months untouched
        finalRows.push(row);
      }
    }

    // 2. Handle New Insertions
    var maxId = 0;
    data.forEach(function(r) { 
      var id = parseInt(r[0]); 
      if (!isNaN(id) && id > maxId) maxId = id; 
    });

    incomingItems.forEach(function(item) {
      if (!item.id) { // New row if no ID
        maxId++;
        finalRows.push([
          maxId,
          String(item.userId),
          filterYear,
          filterMonth,
          Number(item.amount),
          item.status || "active"
        ]);
        insertedCount++;
      }
    });

    // 3. Save Atomic Write
    sheet.clearContents();
    sheet.getRange(1, 1, finalRows.length, 6).setValues(finalRows);

    return jsonResponse({ 
      success: true, 
      inserted: insertedCount, 
      updated: updatedCount 
    });

  } catch (err) {
    return jsonResponse({ error: "GAS Error: " + err.message });
  }
}

/**
 * Upsert for Date Ranges Sheet
 * Columns: ID, User ID, Year, Month, Start Date, End Date
 */
function upsertDateRanges(e, currentUser) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('BazarSlot'); // Ensure your sheet name matches
    if (!sheet) return jsonResponse({ error: "Sheet 'BazarSlot' not found" });

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var payload = JSON.parse(e.parameter.data || "{}");
    var incomingItems = payload.items || []; 
    var activeIds = (payload.activeIds || []).map(function(id) { return String(id); });
    
    var filterYear = String(e.parameter.year || "").trim(); 
    var filterMonth = String(e.parameter.month || "").trim();

    var finalRows = [headers];
    var updatedCount = 0;
    var insertedCount = 0;

    // 1. Separate current period
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowId = String(row[0]);
      var rowYear = String(row[2]).trim(); 
      var rowMonth = String(row[3]).trim();

      if (rowYear === filterYear && rowMonth === filterMonth) {
        if (activeIds.indexOf(rowId) !== -1) {
          var updateItem = incomingItems.find(function(item) { 
            return item.id && String(item.id) === rowId; 
          });

          if (updateItem) {
            row[1] = String(updateItem.userId);
            row[4] = updateItem.startDate; // Expecting YYYY-MM-DD
            row[5] = updateItem.endDate;   // Expecting YYYY-MM-DD
            updatedCount++;
          }
          finalRows.push(row);
        }
      } else {
        finalRows.push(row);
      }
    }

    // 2. ID Auto-increment
    var maxId = 0;
    data.forEach(function(r) { 
      var id = parseInt(r[0]); 
      if (!isNaN(id) && id > maxId) maxId = id; 
    });

    // 3. Insert New
    incomingItems.forEach(function(item) {
      if (!item.id) {
        maxId++;
        finalRows.push([
          maxId,
          String(item.userId),
          filterYear,
          filterMonth,
          item.startDate,
          item.endDate
        ]);
        insertedCount++;
      }
    });

    sheet.clearContents();
    sheet.getRange(1, 1, finalRows.length, 6).setValues(finalRows);

    return jsonResponse({ success: true, inserted: insertedCount, updated: updatedCount });

  } catch (err) {
    return jsonResponse({ error: "GAS Error: " + err.message });
  }
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

function upsertCostHeads(e, currentUser) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('CostHeads');
    if (!sheet) return jsonResponse({ error: "Sheet 'CostHeads' not found" });

    var data = sheet.getDataRange().getValues();
    var headers = data[0]; // ID, Name, Amount, Type, CreatedAt, UpdatedAt (6 columns)
    
    var payload = JSON.parse(e.parameter.data);
    var incomingHeads = payload.costHeads; 
    var activeIds = payload.activeIds.map(function(id) { return String(id); });
    var now = new Date();

    // 1. DELETE logic: Keep only active IDs
    var updatedData = data.filter(function(row, index) {
      if (index === 0) return true;
      return activeIds.indexOf(String(row[0])) !== -1;
    });

    // 2. ID calculation (Auto-increment)
    var lastId = 0;
    if (updatedData.length > 1) {
      lastId = Math.max.apply(Math, updatedData.slice(1).map(function(r) { 
        return parseInt(r[0]) || 0; 
      }));
    }

    // 3. UPSERT logic (Matching 6 columns)
    incomingHeads.forEach(function(item) {
      if (!item.name || item.amount === null) return;

      var existingRowIndex = -1;
      if (item.id) {
        for (var i = 1; i < updatedData.length; i++) {
          if (String(updatedData[i][0]) === String(item.id)) {
            existingRowIndex = i;
            break;
          }
        }
      }

      if (existingRowIndex > -1) {
        // UPDATE: [0]ID, [1]Name, [2]Amount, [3]Type, [4]CreatedAt(keep), [5]UpdatedAt
        updatedData[existingRowIndex][1] = item.name;
        updatedData[existingRowIndex][2] = Number(item.amount);
        updatedData[existingRowIndex][3] = item.type;
        updatedData[existingRowIndex][5] = now; // Updated At
      } else {
        // INSERT: [0]ID, [1]Name, [2]Amount, [3]Type, [4]CreatedAt, [5]UpdatedAt
        lastId++;
        updatedData.push([
          lastId,            // Auto Increment ID
          item.name, 
          Number(item.amount), 
          item.type, 
          now,               // Created At
          now                // Updated At
        ]);
      }
    });

    // 4. Clear and Write (Atomic update)
    sheet.clearContents();
    sheet.getRange(1, 1, updatedData.length, 6).setValues(updatedData);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
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

/**
 * BazarSlot ডাটা রিড করা (Flexible Filters)
 */
function getBazarSlots(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BazarSlot");
  if (!sheet) return jsonResponse({ error: "BazarSlot sheet not found" });

  var fYear = e.parameter.year;
  var fMonth = e.parameter.month;
  var fUserId = e.parameter.userId;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var slots = data.slice(1).filter(function(r) {
    if (fUserId && String(r[1]) !== String(fUserId)) return false;
    if (fYear && String(r[2]) !== String(fYear)) return false;
    if (fMonth && String(r[3]) !== String(fMonth)) return false;
    return true;
  }).map(function(r) {
    return {
      id: r[0],
      userId: r[1],
      year: r[2],
      month: r[3],
      startDate: r[4],
      endDate: r[5]
    };
  });

  return jsonResponse(slots);
}

/**
 * একসাথে অনেকগুলো BazarSlot অ্যাড বা আপডেট করা (Bulk/Batch)
 */
function addOrUpdateBazarSlots(e) {
  var records = JSON.parse(e.parameter.records || "[]");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BazarSlot");
  var data = sheet.getDataRange().getValues();
  
  var updatedCount = 0;
  var insertedCount = 0;

  records.forEach(function(rec) {
    var found = false;
    var rowId = String(rec.id);

    // ১. চেক করা হচ্ছে ID অলরেডি আছে কিনা (আপডেটের জন্য)
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === rowId) {
        // আপডেট ম্যাপিং: ID, UserID, Year, Month, StartDate, EndDate
        var range = sheet.getRange(i + 1, 1, 1, 6);
        range.setValues([[
          rec.id, rec.userId, rec.year, rec.month, rec.startDate, rec.endDate
        ]]);
        updatedCount++;
        found = true;
        break;
      }
    }

    // ২. যদি ID না পাওয়া যায়, তবে নতুন রো ইনসার্ট করা হবে
    if (!found) {
      sheet.appendRow([
        rec.id || (sheet.getLastRow() + 1), // যদি ID না থাকে তবে অটো জেনারেট
        rec.userId, 
        rec.year, 
        rec.month, 
        rec.startDate, 
        rec.endDate
      ]);
      insertedCount++;
    }
  });

  return jsonResponse({ 
    success: true, 
    inserted: insertedCount, 
    updated: updatedCount 
  });
}

/**
 * GET Data for Custom Assignments
 * Returns nested structure: { costHeads: [], customValues: { userId: { costId: amount } } }
 */
function getCustomValuesData(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get Cost Heads
  var sheetHeads = ss.getSheetByName('CostHeads');
  var headsData = sheetHeads ? sheetHeads.getDataRange().getValues() : [];
  var costHeads = headsData.slice(1).map(function(r) {
    return { id: String(r[0]), name: String(r[1]), amount: r[2], type: r[3] };
  });

  // 2. Get Custom Values (Mapping Table)
  var sheetValues = ss.getSheetByName('CustomValues');
  var valuesData = sheetValues ? sheetValues.getDataRange().getValues() : [];
  var customValues = {};

  for (var i = 1; i < valuesData.length; i++) {
    var uId = String(valuesData[i][0]);
    var cId = String(valuesData[i][1]);
    var amt = valuesData[i][2];
    
    if (!customValues[uId]) customValues[uId] = {};
    customValues[uId][cId] = amt;
  }

  return jsonResponse({
    costHeads: costHeads,
    customValues: customValues
  });
}

/**
 * UPSERT Custom Values
 * Overwrites the sheet to match the UI state (handles deletes automatically)
 */
function upsertCustomValues(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('CustomValues');
    if (!sheet) return jsonResponse({ error: "Sheet 'CustomValues' not found" });

    var headers = ["User ID", "Cost Head ID", "Amount"];
    var payload = JSON.parse(e.parameter.data || "{}");
    var incomingItems = payload.items || [];

    var finalData = [headers];
    incomingItems.forEach(function(item) {
      if (item.userId && item.costHeadId) {
        finalData.push([
          String(item.userId),
          String(item.costHeadId),
          Number(item.amount || 0)
        ]);
      }
    });

    sheet.clearContents();
    sheet.getRange(1, 1, finalData.length, 3).setValues(finalData);

    return jsonResponse({ success: true, count: incomingItems.length });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

/**
 * ফ্রন্টেন্ড থেকে আসা মাল্টিপল ইউজার আইডি অনুযায়ী ইমেইল পাঠানো
 */
function sendBulkNotifications(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = ss.getSheetByName('Users');
    var userData = userSheet.getDataRange().getValues();
    
    var payload = JSON.parse(e.parameter.data || "{}");
    var userIds = payload.userIds; 
    var subject = payload.subject;
    var message = payload.message; // This contains the big structured string from frontend

    if (!userIds || !userIds.length) return jsonResponse({ error: "No users selected" });

    var sentCount = 0;
    var errors = [];

    // 1. Send Emails
    userIds.forEach(function(id) {
      var foundEmail = "";
      var userName = "";
      for (var i = 1; i < userData.length; i++) {
        if (String(userData[i][0]) === String(id)) {
          userName = userData[i][1];
          foundEmail = userData[i][2];
          break;
        }
      }
      if (foundEmail) {
        try {
          var body = "Hi " + userName + ",\n\n" + message;
          GmailApp.sendEmail(foundEmail, subject, body);
          sentCount++;
        } catch (mailErr) {
          errors.push("Mail Error ID " + id + ": " + mailErr.toString());
        }
      }
    });

    // 2. Create Archive Sheet (SnapShot)
    try {
      var date = new Date();
      var sheetName = "Statement-" + date.getFullYear() + "-" + (date.getMonth() + 1);
      var reportSheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      
      reportSheet.clear(); // Clear old data if re-sending in same month
      
      // Split the big message string into rows for the sheet
      var rows = message.split("\n").map(function(line) { return [line]; });
      
      // Write data
      reportSheet.getRange(1, 1, rows.length, 1).setValues(rows);
      
      // 3. Eye-Catchy Formatting
      reportSheet.setColumnWidth(1, 600); // Make it wide
      reportSheet.getRange("A1").setFontWeight("bold").setFontSize(14).setBackground("#cfe2f3");
      
      // Highlight specific sections
      var lastRow = reportSheet.getLastRow();
      var fullRange = reportSheet.getRange(1, 1, lastRow, 1);
      fullRange.setFontFamily("Courier New"); // Monospace look for alignment
      
      // Apply alternating colors or borders
      for (var r = 1; r <= lastRow; r++) {
        var cell = reportSheet.getRange(r, 1);
        var val = cell.getValue();
        if (val.indexOf("===") > -1) cell.setFontWeight("bold").setFontColor("#cc0000");
        if (val.indexOf("NAME:") > -1) cell.setBackground("#f3f3f3").setFontWeight("bold");
        if (val.indexOf("NET PAYABLE") > -1) cell.setBackground("#d9ead3").setFontWeight("bold");
      }

    } catch (sheetErr) {
      errors.push("Sheet Archive Error: " + sheetErr.toString());
    }

    return jsonResponse({ 
      success: true, 
      sentCount: sentCount, 
      archiveName: sheetName,
      errors: errors 
    });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}