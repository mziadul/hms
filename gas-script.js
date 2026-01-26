/**
 * Google Apps Script for user login, token auth, and user add
 *
 * Usage:
 * - POST action=login, email, password => returns {token} if valid
 * - POST action=addUser, ...fields..., token => adds user if token valid
 * - GET  action=getUsers => returns all users
 */

const TOKEN_SECRET = 'REPLACE_WITH_RANDOM_SECRET'; // Change this!
const TOKEN_EXPIRY_MINUTES = 60;

function doPost(e) {
  var action = e.parameter.action;
  if (action === 'login') {
    return loginUser(e);
  }

  var token = e.parameter.token;
  if (!token) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var email = verifyToken(token);
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid or expired token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'addUser') {
    return addUser(e);
  } else if (action === "addCostHead") {
    return addCostHead(e);
  } else if (action === "getMeals") {
    return getMeals(e);
  } else if (action === "updateMeals") {
    return addOrUpdateMealsBatch(e);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e.parameter.action;
  var token = e.parameter.token;
  if (!token) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var email = verifyToken(token);
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid or expired token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getUsers') {
    return getUsers();
  }
  if (action === "getCostHeads") {
    var costHeadsData = getCostHeads();
    var customs = getCustomValues();
    var result = { 
      costHeads: costHeadsData, 
      customValues: customs 
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "getBazarCosts") {
    return getBazarCosts(e);
  }
  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function loginUser(e) {
  var email = e.parameter.email;
  var password = e.parameter.password;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] == email && data[i][3] == password) {
      var token = generateToken(email);
      return ContentService.createTextOutput(JSON.stringify({ token: token }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid credentials' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function addUser(e) {
  var id = e.parameter.id;
  var name = e.parameter.name;
  var userEmail = e.parameter.email;
  var password = e.parameter.password;
  var type = e.parameter.type;
  var updatedBy = e.parameter.updatedBy;
  var now = new Date();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  var userRow = [id, name, userEmail, password, type, now, now, updatedBy];
  sheet.appendRow(userRow);
  return ContentService.createTextOutput(JSON.stringify({ success: 'User added successfully' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getUsers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    var user = {
      id: data[i][0],
      name: data[i][1],
      email: data[i][2],
      password: data[i][3],
      type: data[i][4],
      createdAt: data[i][5],
      updatedAt: data[i][6],
      updatedBy: data[i][7]
    };
    users.push(user);
  }
  return ContentService.createTextOutput(JSON.stringify(users))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateToken(email) {
  var ts = new Date().getTime();
  var raw = email + '|' + ts;
  var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(raw, TOKEN_SECRET));
  var token = Utilities.base64Encode(raw + '|' + sig);
  return token;
}

function verifyToken(token) {
  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    var parts = decoded.split('|');
    if (parts.length !== 3) return null;
    var email = parts[0];
    var ts = parseInt(parts[1], 10);
    var sig = parts[2];
    var raw = email + '|' + ts;
    var expectedSig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(raw, TOKEN_SECRET));
    if (sig !== expectedSig) return null;
    var now = new Date().getTime();
    if (now - ts > TOKEN_EXPIRY_MINUTES * 60 * 1000) return null;
    return email;
  } catch (e) {
    return null;
  }
}

function initCostHeadsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("CostHeads");
  if (!sheet) {
    sheet = ss.insertSheet("CostHeads");
    sheet.appendRow(["id", "name", "type", "createdAt", "updatedAt"]);
  }
  return sheet;
}

function addCostHead(e) {
  var name = e.parameter.name;
  var type = e.parameter.type;

  if (!name || !type) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Missing name or type" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = initCostHeadsSheet();
  var data = sheet.getDataRange().getValues();

  // Generate id (incremental)
  var id = data.length; // row 1 is headers
  var now = new Date();

  sheet.appendRow([id, name, type, now, now]);

  return ContentService.createTextOutput(
    JSON.stringify({ success: "Cost head added", id: id })
  ).setMimeType(ContentService.MimeType.JSON);
}

function getCostHeads() {
  var sheet = initCostHeadsSheet();
  var data = sheet.getDataRange().getValues();
  var costHeads = [];

  for (var i = 1; i < data.length; i++) {
    costHeads.push({
      id: data[i][0],
      name: data[i][1],
      amount: data[i][2],
      type: data[i][3],
      createdAt: data[i][4],
      updatedAt: data[i][5],
    });
  }

  return costHeads;
}

function getMeals(e) {
  var token = e.parameter.token;
  if (!token) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing token" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var email = verifyToken(token);
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid or expired token" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Get logged-in user info
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName("Users");
  var userData = userSheet.getDataRange().getValues();
  var currentUser = null;
  for (var i = 1; i < userData.length; i++) {
    if (userData[i][2] === email) {
      currentUser = {
        id: userData[i][0],
        name: userData[i][1],
        type: userData[i][4],
      };
      break;
    }
  }
  if (!currentUser) {
    return ContentService.createTextOutput(JSON.stringify({ error: "User not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Optional filters
  var filterYear = e.parameter.year ? parseInt(e.parameter.year, 10) : null;
  var filterMonth = e.parameter.month ? parseInt(e.parameter.month, 10) : null;
  var filterDate = e.parameter.date ? parseInt(e.parameter.date, 10) : null;
  var filterUserId = e.parameter.userId ? parseInt(e.parameter.userId, 10) : null;

  var sheet = ss.getSheetByName("Meals");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify([]))
                      .setMimeType(ContentService.MimeType.JSON);

  var data = sheet.getDataRange().getValues();
  var meals = [];

  for (var i = 1; i < data.length; i++) {
    var row = {
      id: data[i][0],
      userId: data[i][1],
      year: data[i][2],
      month: data[i][3],
      date: data[i][4],
      type: data[i][5],
      amount: data[i][6]
    };

    // Skip rows that don't match rules
    if (currentUser.type !== "admin" && row.userId != currentUser.id) continue;
    if (currentUser.type === "admin" && filterUserId && row.userId != filterUserId) continue;
    if (filterYear && row.year != filterYear) continue;
    if (filterMonth && row.month != filterMonth) continue;
    if (filterDate && row.date != filterDate) continue;

    meals.push(row);
  }

  return ContentService.createTextOutput(JSON.stringify(meals))
    .setMimeType(ContentService.MimeType.JSON);
}

function getCustomValues() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("CustomValues");
  if (!sheet) return {};
  
  var data = sheet.getDataRange().getValues();
  var customs = {}; // ফরম্যাট: { "userId": { "headId": value } }

  for (var i = 1; i < data.length; i++) {
    var userId = String(data[i][0]);
    var costHeadId = String(data[i][1]);
    var amount = parseFloat(data[i][2]);
    
    if (!customs[userId]) customs[userId] = {};
    customs[userId][costHeadId] = amount;
  }
  return customs;
}

function addOrUpdateMealsBatch(e) {
  var token = e.parameter.token;
  if (!token) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing token" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var email = verifyToken(token);
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid or expired token" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName("Users");
  var userData = userSheet.getDataRange().getValues();
  var currentUser = null;
  for (var i = 1; i < userData.length; i++) {
    if (userData[i][2] === email) {
      currentUser = {
        id: userData[i][0],
        name: userData[i][1],
        type: userData[i][4],
      };
      break;
    }
  }
  if (!currentUser) {
    return ContentService.createTextOutput(JSON.stringify({ error: "User not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!e.parameter.records) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing records" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var records;
  try {
    records = JSON.parse(e.parameter.records);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid JSON for records" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = ss.getSheetByName("Meals");
  var data = sheet.getDataRange().getValues();
  var updatedCount = 0;
  var insertedCount = 0;

  records.forEach(function (rec) {
    var year = parseInt(rec.year, 10);
    var month = parseInt(rec.month, 10);
    var date = parseInt(rec.date, 10);
    var type = rec.type;
    var amount = parseFloat(rec.amount);

    if (!year || !month || !date || !type || isNaN(amount)) {
      return; // Skip invalid record
    }

    // Determine which user this meal belongs to
    var mealUserId = currentUser.id;
    if (currentUser.type === "admin" && rec.userId) {
      mealUserId = parseInt(rec.userId, 10);
    }

    // Check if the meal already exists
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (
        data[i][1] == mealUserId &&
        data[i][2] == year &&
        data[i][3] == month &&
        data[i][4] == date &&
        data[i][5] == type
      ) {
        // Update existing meal
        sheet.getRange(i + 1, 7).setValue(amount);
        updatedCount++;
        found = true;
        break;
      }
    }

    if (!found) {
      // Insert new meal
      var newId = data.length + insertedCount; // avoid collision in same batch
      sheet.appendRow([newId, mealUserId, year, month, date, type, amount]);
      insertedCount++;
    }
  });

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    inserted: insertedCount,
    updated: updatedCount
  })).setMimeType(ContentService.MimeType.JSON);
}

function getBazarCosts(e) {
  // Authentication check
  var token = e.parameter.token;
  if (!token) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var email = verifyToken(token);
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid or expired token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Get user info for permission check (optional)
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName('Users');
  var userData = userSheet.getDataRange().getValues();
  var currentUser = null;
  
  for (var i = 1; i < userData.length; i++) {
    if (userData[i][2] === email) {
      currentUser = {
        id: userData[i][0],
        name: userData[i][1],
        type: userData[i][4],
      };
      break;
    }
  }
  
  if (!currentUser) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'User not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Collect filter parameters (all optional)
  var filters = {
    id: e.parameter.id ? parseInt(e.parameter.id, 10) : null,
    userId: e.parameter.userId ? parseInt(e.parameter.userId, 10) : null,
    year: e.parameter.year ? parseInt(e.parameter.year, 10) : null,
    month: e.parameter.month ? parseInt(e.parameter.month, 10) : null,
    amount: e.parameter.amount ? parseFloat(e.parameter.amount) : null,
    status: e.parameter.status || null  // String comparison
  };
  
  // Get BazarCost sheet data
  var sheet = ss.getSheetByName('BazarCost');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'BazarCost sheet not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var data = sheet.getDataRange().getValues();
  var bazarCosts = [];
  
  // Skip header row (index 0)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    // Skip empty rows
    if (!row[0] && !row[1] && !row[2] && !row[3] && !row[4] && !row[5]) {
      continue;
    }
    
    // Extract row values based on your column structure:
    // ID, User ID, Year, Month, Amount, Status
    var record = {
      id: row[0],
      userId: row[1],
      year: row[2],
      month: row[3],
      amount: row[4],
      status: row[5]
    };
    
    // Apply flexible filtering
    var shouldInclude = true;
    
    // Check each filter - only apply if filter is provided
    if (filters.id !== null && record.id != filters.id) {
      shouldInclude = false;
    }
    if (filters.userId !== null && record.userId != filters.userId) {
      shouldInclude = false;
    }
    if (filters.year !== null && record.year != filters.year) {
      shouldInclude = false;
    }
    if (filters.month !== null && record.month != filters.month) {
      shouldInclude = false;
    }
    if (filters.amount !== null && record.amount != filters.amount) {
      shouldInclude = false;
    }
    if (filters.status !== null && record.status !== filters.status) {
      shouldInclude = false;
    }
    
    // Add to results if all filters pass
    if (shouldInclude) {
      bazarCosts.push(record);
    }
  }
  
  // Return JSON response
  return ContentService.createTextOutput(JSON.stringify(bazarCosts))
    .setMimeType(ContentService.MimeType.JSON);
}
