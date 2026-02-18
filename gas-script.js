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
    case 'syncMonthlyData': return syncMonthlyData(e);
    case 'updatePayment': return updatePayment(e);
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
    case 'getMonthlyArchive': return getMonthlyArchive(e);
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
function syncMonthlyData(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.parameter.data || "{}");
    var bills = payload.bills; 
    var subject = payload.subject;
    
    // গ্লোবাল মেস ডেটা
    var totalMonthMeals = payload.totalMonthMeals || 0;
    var totalMonthBazar = payload.totalMonthBazar || 0;
    var globalMealRate = payload.globalMealRate || 0;

    if (!bills || !bills.length) return jsonResponse({ error: "No data received" });

    var reportSheet = ss.getSheetByName("Monthly_Archive") || ss.insertSheet("Monthly_Archive");

    // ১. প্রিসাইজ এবং রিডেবল কলাম হেডার (Bazar Slot অন্তর্ভুক্ত)
    if (reportSheet.getLastRow() === 0) {
      var headers = [
        "Year", "Month", "User ID", "Name", 
        "Total Meals (Mess)", "Total Bazar (Mess)", "Avg Rate", // গ্লোবাল সামারি
        "Is Manager", "Bazar Slot", "Slot Meals", "Slot Rate",   // বাজার ডিউটি সামারি
        "Personal Meals", "Meal Cost", "Bazar Paid"            // ব্যক্তিগত হিসাব
      ];

      // ডাইনামিক ফিক্সড কস্ট (House Rent, Maid, Electricity, etc.)
      if (bills[0].fixedCosts) {
        Object.keys(bills[0].fixedCosts).forEach(function(key) {
          headers.push(key);
        });
      }
      
      headers.push("Net Payable", "Paid Amount", "Status", "Updated At");
      
      reportSheet.appendRow(headers);
      
      // হেডার ডিজাইন
      reportSheet.getRange(1, 1, 1, headers.length)
                 .setFontWeight("bold")
                 .setBackground("#1f4e78") // ডিপ ব্লু প্রফেশনাল লুক
                 .setFontColor("white")
                 .setHorizontalAlignment("center")
                 .setVerticalAlignment("middle");
      
      reportSheet.setFrozenRows(1); // প্রথম রো ফ্রিজ করে রাখা যাতে স্ক্রল করলে হেডার দেখা যায়
    }

    var sentCount = 0;
    var existingData = reportSheet.getDataRange().getValues();
    var headersRow = existingData[0];

    bills.forEach(function(bill) {
      var now = new Date();
      var timestamp = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");

      // ২. ডেটা ম্যাপিং (Bazar Slot আপডেটসহ)
      var rowDataMap = {
        "Year": bill.year,
        "Month": bill.month,
        "User ID": bill.userId,
        "Name": bill.userName,
        
        // মেস সামারি
        "Total Meals (Mess)": totalMonthMeals,
        "Total Bazar (Mess)": totalMonthBazar,
        "Avg Rate": globalMealRate,
        
        // বাজার ম্যানেজার ডিউটি
        "Is Manager": bill.hasSlot ? "Yes" : "No",
        "Bazar Slot": bill.slotRange || "-",
        "Slot Meals": bill.mealsInSlot || 0,
        "Slot Rate": bill.slotMealRate || 0,
        
        // ইউজার হিসাব
        "Personal Meals": bill.meals,
        "Meal Cost": bill.mealCost,
        "Bazar Paid": bill.bazarPaid,
        
        "Net Payable": bill.netPayable,
        "Paid Amount": 0,          
        "Status": "Unpaid",   
        "Updated At": timestamp
      };

      if (bill.fixedCosts) {
        Object.keys(bill.fixedCosts).forEach(function(key) {
          rowDataMap[key] = bill.fixedCosts[key];
        });
      }

      var finalRowData = headersRow.map(function(h) {
        return rowDataMap[h] !== undefined ? rowDataMap[h] : 0;
      });

      // ৩. UPSERT লজিক
      var rowIndex = -1;
      var yIdx = headersRow.indexOf("Year");
      var mIdx = headersRow.indexOf("Month");
      var uIdx = headersRow.indexOf("User ID");

      for (var i = 1; i < existingData.length; i++) {
        if (existingData[i][yIdx] == bill.year && 
            existingData[i][mIdx] == bill.month && 
            existingData[i][uIdx] == bill.userId) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex > -1) {
        // পুরনো 'Paid Amount' এবং 'Status' প্রিজার্ভ করা
        var oldAmount = existingData[rowIndex-1][headersRow.indexOf("Paid Amount")] || 0;
        var oldStatus = existingData[rowIndex-1][headersRow.indexOf("Status")] || "Unpaid";
        
        finalRowData[headersRow.indexOf("Paid Amount")] = oldAmount;
        finalRowData[headersRow.indexOf("Status")] = oldStatus;
        
        reportSheet.getRange(rowIndex, 1, 1, finalRowData.length).setValues([finalRowData]);
      } else {
        reportSheet.appendRow(finalRowData);
      }

      // ৪. ইমেইল নোটিফিকেশন (Professional Structure)
      var emailBody = "Dear " + bill.userName + ",\n\n" +
                      "Your monthly bill statement for " + bill.month + " " + bill.year + " has been generated.\n\n" +
                      "--- MESS SUMMARY ---\n" +
                      "Avg Meal Rate: " + globalMealRate.toFixed(2) + " Tk\n" +
                      "Total Mess Meals: " + totalMonthMeals + "\n\n" +
                      
                      "--- YOUR ACCOUNT ---\n" +
                      "Personal Meals: " + bill.meals + "\n" +
                      "Meal Cost: " + bill.mealCost.toFixed(2) + " Tk\n" +
                      "Bazar Paid: " + bill.bazarPaid.toFixed(2) + " Tk\n";

      if (bill.hasSlot) {
        emailBody += "\n--- BAZAR MANAGER INFO ---\n" +
                     "Bazar Slot: " + bill.slotRange + "\n" +
                     "Total Meals in Slot: " + bill.mealsInSlot + "\n" +
                     "Slot Rate: " + bill.slotMealRate.toFixed(2) + " Tk\n";
      }

      emailBody += "\n------------------------------------------\n" +
                   "NET PAYABLE: " + bill.netPayable.toFixed(2) + " Tk\n" +
                   "STATUS: " + rowDataMap["Status"].toUpperCase() + "\n" +
                   "------------------------------------------\n\n" +
                   "Best regards,\nMess Management System";

      if (bill.userEmail) {
        GmailApp.sendEmail(bill.userEmail, subject, emailBody);
        sentCount++;
      }
    });

    return jsonResponse({ 
      success: true, 
      sentCount: sentCount, 
      message: "Data successfully archived with 'Bazar Slot' details!" 
    });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function sendBulkNotifications(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName("Debug_Logs") || ss.insertSheet("Debug_Logs");
  logSheet.clear(); 
  logSheet.appendRow(["Timestamp", "Message", "Data"]);

  function writeLog(msg, data) {
    logSheet.appendRow([new Date(), msg, data || ""]);
  }

  try {
    var reportSheet = ss.getSheetByName("Monthly_Archive");
    var userSheet = ss.getSheetByName("Users");

    if (!reportSheet || !userSheet) {
      writeLog("Error", "Monthly_Archive ba Users sheet pawa jayni!");
      return jsonResponse({ error: "Required sheets missing" });
    }

    var payload = JSON.parse(e.parameter.data || "{}");
    var targetYear = payload.year;   
    var targetMonth = payload.month; 
    var userIdsToSend = payload.userIds; 
    var subject = payload.subject || "মাসিক মেস বিলের বিবরণ";

    // ১. Users sheet theke ID (Capital) onujayi Email map toiri kora
    var userData = userSheet.getDataRange().getValues();
    var userHeaders = userData[0];
    var uIdIdx = userHeaders.indexOf("ID"); 
    var uEmailIdx = userHeaders.indexOf("Email");
    if (uEmailIdx === -1) uEmailIdx = userHeaders.indexOf("email");

    if (uIdIdx === -1 || uEmailIdx === -1) {
      writeLog("Error", "Users sheet-e 'ID' ba 'Email' column pawa jayni");
      return jsonResponse({ error: "Users sheet column mismatch" });
    }

    var emailMap = {};
    for (var i = 1; i < userData.length; i++) {
      var idKey = String(userData[i][uIdIdx]).trim();
      emailMap[idKey] = userData[i][uEmailIdx];
    }

    // ২. Archive sheet matching logic shoho data neya
    var data = reportSheet.getDataRange().getValues();
    var headers = data[0];
    var rows = data.slice(1);

    var yIdx = headers.indexOf("Year");
    var mIdx = headers.indexOf("Month");
    var uIdx = headers.indexOf("User ID");
    
    var idx = {
      name: headers.indexOf("Name"),
      totalBazar: headers.indexOf("Total Bazar (Mess)"),
      totalMeals: headers.indexOf("Total Meals (Mess)"),
      avgRate: headers.indexOf("Avg Rate"),
      pMeals: headers.indexOf("Personal Meals"),
      mCost: headers.indexOf("Meal Cost"),
      bPaid: headers.indexOf("Bazar Paid"),
      netPayable: headers.indexOf("Net Payable"),
      status: headers.indexOf("Status"),
      slotRange: headers.indexOf("Bazar Slot"),
      slotMeals: headers.indexOf("Slot Meals"),
      slotRate: headers.indexOf("Slot Rate")
    };

    // Dynamic Fixed Costs column gulo (Bazar Paid er por theke Net Payable er age porjonto)
    var fixedCostHeaders = headers.slice(idx.bPaid + 1, idx.netPayable);
    var sentCount = 0;

    userIdsToSend.forEach(function(id) {
      var searchId = String(id).trim();
      var userEmail = emailMap[searchId];

      if (!userEmail) {
        writeLog("Skip", "User ID " + searchId + " er email Users sheet-e pawa jayni.");
        return;
      }

      var userRow = rows.find(function(r) {
        return String(r[yIdx]).trim() === String(targetYear).trim() && 
               String(r[mIdx]).trim().toLowerCase() === String(targetMonth).trim().toLowerCase() && 
               String(r[uIdx]).trim() === searchId;
      });

      if (userRow) {
        // --- Full Detailed Body Start ---
        var emailBody = "প্রিয় " + userRow[idx.name] + ",\n\n" +
                        targetMonth + " " + targetYear + " মাসের আপনার মেস বিলের বিবরণ নিচে দেওয়া হলো:\n\n" +
                        
                        "--- মেসের মোট হিসাব (Global Summary) ---\n" +
                        "মেসের মোট বাজার: " + Number(userRow[idx.totalBazar] || 0).toFixed(2) + " টাকা\n" +
                        "মেসের মোট মিল: " + (userRow[idx.totalMeals] || 0) + "\n" +
                        "গড় মিল রেট: " + Number(userRow[idx.avgRate] || 0).toFixed(2) + " টাকা\n\n" +
                        
                        "--- আপনার ব্যক্তিগত হিসাব ---\n" +
                        "আপনার মোট মিল: " + (userRow[idx.pMeals] || 0) + "\n" +
                        "মিল খরচ: " + Number(userRow[idx.mCost] || 0).toFixed(2) + " টাকা\n" +
                        "বাজার জমা (Debit): " + Number(userRow[idx.bPaid] || 0).toFixed(2) + " টাকা\n";

        // অন্যান্য খরচ (Fixed Costs) add kora
        if (fixedCostHeaders.length > 0) {
          emailBody += "\n--- অন্যান্য খরচ (Fixed Costs) ---\n";
          fixedCostHeaders.forEach(function(h) {
            var val = userRow[headers.indexOf(h)] || 0;
            emailBody += h + ": " + Number(val).toFixed(2) + " টাকা\n";
          });
        }

        // বাজার ম্যানেজারের স্লট তথ্য (jodi thake)
        if (userRow[idx.slotRange] && userRow[idx.slotRange] !== "-" && userRow[idx.slotRange] !== "") {
          emailBody += "\n--- বাজার ম্যানেজার তথ্য ---\n" +
                       "আপনার স্লট: " + userRow[idx.slotRange] + "\n" +
                       "স্লট চলাকালীন মিল: " + (userRow[idx.slotMeals] || 0) + "\n" +
                       "স্লট রেট: " + Number(userRow[idx.slotRate] || 0).toFixed(2) + " টাকা\n";
        }

        emailBody += "\n------------------------------------------\n" +
                     "মোট দেয় বিল (Net Payable): " + Number(userRow[idx.netPayable] || 0).toFixed(2) + " টাকা\n" +
                     "পেমেন্ট স্ট্যাটাস: " + (userRow[idx.status] === "Paid" ? "পরিশোধিত" : "বাকি (Unpaid)") + "\n" +
                     "------------------------------------------\n\n" +
                     "যদি কোনো ভুল থাকে, দয়া করে ম্যানেজারের সাথে যোগাযোগ করুন।\n" +
                     "ধন্যবাদান্তে,\nমেস ম্যানেজমেন্ট সিস্টেম";
        // --- Full Detailed Body End ---

        try {
          GmailApp.sendEmail(userEmail, subject, emailBody);
          sentCount++;
          writeLog("Success", "Detailed Email sent to: " + userEmail);
        } catch (mailErr) {
          writeLog("Mail Error", userEmail + ": " + mailErr.toString());
        }
      } else {
        writeLog("Not Found", "ID: " + searchId + " er data archive-e pawa jayni.");
      }
    });

    return jsonResponse({ success: true, message: sentCount + " টি ইমেইল ব্রেকডাউনসহ সফলভাবে পাঠানো হয়েছে!" });

  } catch (err) {
    writeLog("Global Error", err.toString());
    return jsonResponse({ error: err.toString() });
  }
}

function getMonthlyArchive(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Monthly_Archive");
    
    if (!sheet) return jsonResponse({ error: "Archive sheet not found" });

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonResponse([]); // যদি শুধু হেডার থাকে বা শিট খালি থাকে

    var headers = data[0];
    var rows = data.slice(1);

    // URL প্যারামিটার থেকে ফিল্টারগুলো নেওয়া
    var filterYear = e.parameter.year; 
    var filterMonth = e.parameter.month; 
    var filterUserId = e.parameter.userId;

    // কলাম ইনডেক্সগুলো ডাইনামিকালি খুঁজে বের করা (যাতে নাম পরিবর্তনের কারণে কোড না ভাঙে)
    var yearIdx = headers.indexOf("Year");
    var monthIdx = headers.indexOf("Month");
    var userIdIdx = headers.indexOf("User ID");

    var filteredData = rows.filter(function(row) {
      var match = true;

      // ১. Year ফিল্টার
      if (filterYear && yearIdx !== -1) {
        if (String(row[yearIdx]) !== String(filterYear)) match = false;
      }
      
      // ২. Month ফিল্টার (Case-insensitive)
      if (filterMonth && monthIdx !== -1) {
        if (String(row[monthIdx]).toLowerCase() !== String(filterMonth).toLowerCase()) match = false;
      }
      
      // ৩. User ID ফিল্টার
      if (filterUserId && userIdIdx !== -1) {
        if (String(row[userIdIdx]) !== String(filterUserId)) match = false;
      }

      return match;
    });

    // ডেটাকে JSON অবজেক্ট ফরম্যাটে সাজানো
    var result = filteredData.map(function(row) {
      var obj = {};
      headers.forEach(function(header, index) {
        // ফিক্সড কস্ট এবং টাকার হিসাবগুলোকে Number হিসেবে পাঠানো (যদি সম্ভব হয়)
        var val = row[index];
        obj[header] = (typeof val === "number") ? parseFloat(val.toFixed(2)) : val;
      });
      return obj;
    });

    return jsonResponse(result);

  } catch (err) {
    return jsonResponse({ error: "Method Error: " + err.toString() });
  }
}

function updatePayment(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var archiveSheet = ss.getSheetByName("Monthly_Archive");
    var userSheet = ss.getSheetByName("Users");
    
    if (!archiveSheet || !userSheet) {
      return jsonResponse({ error: "Required sheets missing!" });
    }

    // CORS হ্যান্ডলিং এর জন্য text/plain ডেটা রিসিভ করা
    var payload = JSON.parse(e.postData.contents);
    var targetYear = String(payload.year).trim();
    var targetMonth = String(payload.month).trim();
    var targetUser = String(payload.userId).trim();
    var amountToAdd = Number(payload.amount);

    var data = archiveSheet.getDataRange().getValues();
    var headers = data[0];
    
    var yIdx = headers.indexOf("Year");
    var mIdx = headers.indexOf("Month");
    var uIdx = headers.indexOf("User ID");
    var pAmtIdx = headers.indexOf("Paid Amount");
    var statusIdx = headers.indexOf("Status");
    var netIdx = headers.indexOf("Net Payable");

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][yIdx]).trim() === targetYear && 
          String(data[i][mIdx]).trim().toLowerCase() === targetMonth.toLowerCase() && 
          String(data[i][uIdx]).trim() === targetUser) {
        
        var currentPaid = Number(data[i][pAmtIdx]) || 0;
        var netPayable = Number(data[i][netIdx]) || 0;
        var newTotalPaid = currentPaid + amountToAdd;
        
        // ১. শিট আপডেট
        archiveSheet.getRange(i + 1, pAmtIdx + 1).setValue(newTotalPaid);
        var finalStatus = (newTotalPaid >= netPayable) ? "Paid" : "Partial";
        if (statusIdx !== -1) archiveSheet.getRange(i + 1, statusIdx + 1).setValue(finalStatus);
        
        // ২. ইউজার ইমেইল খুঁজে বের করা
        var userData = userSheet.getDataRange().getValues();
        var userHeaders = userData[0];
        var uMailIdx = userHeaders.indexOf("Email");
        var uIdIdx = userHeaders.indexOf("ID");
        var uNameIdx = userHeaders.indexOf("Name");
        
        var userEmail = "";
        var userName = "Member";

        for (var j = 1; j < userData.length; j++) {
          if (String(userData[j][uIdIdx]).trim() === targetUser) {
            userEmail = userData[j][uMailIdx];
            userName = userData[j][uNameIdx];
            break;
          }
        }

        // ৩. ইমেইল পাঠানো
        if (userEmail && userEmail.includes("@")) {
          var subject = "Payment Received: " + targetMonth + " " + targetYear;
          var body = "Hi " + userName + ",\n\n" +
                     "We have received your payment of " + amountToAdd + " Tk for " + targetMonth + " " + targetYear + ".\n\n" +
                     "Current Summary:\n" +
                     "Total Paid: " + newTotalPaid + " Tk\n" +
                     "Current Status: " + finalStatus + "\n" +
                     "Remaining Due: " + (netPayable - newTotalPaid > 0 ? (netPayable - newTotalPaid) : 0) + " Tk\n\n" +
                     "Thank you!";
          MailApp.sendEmail(userEmail, subject, body);
        }

        return jsonResponse({ success: true, message: "Payment updated and email sent!" });
      }
    }
    return jsonResponse({ error: "No matching record found!" });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}