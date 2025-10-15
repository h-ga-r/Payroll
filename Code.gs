// Webアプリとして公開されたときに実行される
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

// スプレッドシートからスタッフ名のリストを取得する
function getStaffNames() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = spreadsheet.getSheetByName('スタッフ情報');
  const lastRow = staffSheet.getLastRow();
  // ヘッダー行を除いてA列のデータを取得
  if (lastRow <= 1) return []; // データがない場合は空の配列を返す
  const staffNames = staffSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  return staffNames;
}

// 給与計算とスプレッドシートへの保存（formDataから受け取ったものを分解して関数に入れる）
function calculateAndSave(formData) {
  const {
    staffName,//スタッフ名
    employmentType,//雇用形態
    weekdayHours,//平日の勤務時間
    weekdayNightHours,//平日の深夜勤務時間
    weekendHours,//週末の勤務時間
    weekendNightHours,//週末の深夜勤務時間
    workDays//勤務日数
  } = formData;

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();//紐づいてるスプレッドシートを取得
  const staffSheet = spreadsheet.getSheetByName('スタッフ情報');//スプレッドシートの中のスタッフ情報を取得
  const staffData = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 6).getValues();//セル範囲を指定して二次元配列として受け取る

  // 1. スプレッドシートからスタッフの時給情報を取得
  const targetStaff = staffData.find(row => row[0] === staffName);//取得した名前から入力された名前を探す
  if (!targetStaff) {
    return {
      message: `エラー: ${staffName}さんの情報が見つかりません。`
    };
  }
  //名前が見つかれば給与計算に必要な数値を取り出し、代入
  const baseHourlyWage = targetStaff[1];//基本時給２列目
  const nightRate = targetStaff[2];//深夜割増率３列目
  const weekendBonus = targetStaff[3];         // D列 (土日祝割増手当)
  const transportationExpenses = targetStaff[5];//F列(交通費)

  const weekendRate = baseHourlyWage + weekendBonus; // 週末時給の計算　基本給+手当

  
  // 3. 各労働時間の給与を計算
  const weekdayPay = Math.ceil(weekdayHours * baseHourlyWage);//平日の時間計算

  const weekNight = Math.ceil(baseHourlyWage * nightRate);//平日の夜時給
  const weekdayNightPay = Math.ceil(weekdayNightHours * weekNight);//平日の深夜計算
  
  const weekendPay = Math.ceil(weekendHours *  weekendRate);//土日祝の昼間
  const weekendNight = Math.ceil(baseHourlyWage * nightRate) + weekendBonus;//土日祝の夜時給

  const weekendNightPay = Math.ceil(weekendNightHours * weekendNight);//土日祝の深夜
  const transportationExpensesPay = transportationExpenses * workDays; //交通費

  // 4. 合計給与の計算
  let totalPay = weekdayPay + weekdayNightPay + weekendPay + weekendNightPay + transportationExpensesPay;//上記で出したすべての額を合計にする（letなのであとから変更可）

  // スタッフの場合、総支給額から0.6%を引く
  if (employmentType === 'staff') {
    totalPay = totalPay * (1 - 0.006); // 0.6% = 0.006
  }

  // 5. 計算結果を「勤務記録」シートに保存
  const recordSheet = spreadsheet.getSheetByName('勤務記録') || spreadsheet.insertSheet('勤務記録');
  recordSheet.appendRow([
   // 【A. 基本情報】
   new Date(),                // A列: 記録日時
   staffName,                 // B列: スタッフ名
   employmentType,            // C列: 雇用形態
  
   // 【B. 勤務時間】
   workDays,                  // D列: 勤務日数 (勤務時間の前に移動)
   weekdayHours,              // E列: 平日昼時間
   weekdayNightHours,         // F列: 平日深夜時間
   weekendHours,              // G列: 週末昼時間
   weekendNightHours,         // H列: 週末深夜時間
  
   // 【C. 個別給与額】
   weekdayPay,                // I列: 平日昼給与
   weekdayNightPay,           // J列: 平日深夜給与
   weekendPay,                // K列: 週末昼給与
   weekendNightPay,           // L列: 週末深夜給与
   transportationExpensesPay, //M列：交通費
  
   // 【D. 総額】
   totalPay,                  // N列: 総支給額

   baseHourlyWage,            //o列:基本給
   weekNight,                 //P列：平日の夜時給
   weekendRate,             //Q列：土日祝の昼時給
   weekendNight,              //R列：土日夜時給
  ]);

  // 6. 結果をHTMLに返す
  return {
    message: `${staffName}さんの今月の給与は ${Math.round(totalPay)}円 です。`
  };
}



