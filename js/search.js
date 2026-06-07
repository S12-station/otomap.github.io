const GAS_URL = 'https://script.google.com/macros/s/AKfycbz01EQuEGIaqjoyydvJLa-kAC2AzP0bpWr_55G4P418DoWwq7T_QwNCecCuYxlbxAqVSQ/exec';

let allWorks = [];
let masterData = { companies: [], lines: [] };

function fetchCsv(path) {
  return new Promise((resolve) => {
    Papa.parse(path, {
      download: true, header: true, dynamicTyping: true,
      complete: (results) => resolve(results.data)
    });
  });
}

// UI要素の取得
const companySelect = document.getElementById('searchCompany');
const lineSelect = document.getElementById('searchLine');
const searchInput = document.getElementById('searchInput');

async function loadData() {
  try {
    const [madsRes, stationsCsv, linesCsv, companiesCsv] = await Promise.all([
      fetch(GAS_URL).then(res => res.json()),
      fetchCsv('csv/station.csv'),
      fetchCsv('csv/line.csv'),
      fetchCsv('csv/company.csv')
    ]);

    // プルダウン用にマスタデータを保持
    masterData.companies = companiesCsv.filter(c => c.company_cd);
    masterData.lines = linesCsv.filter(l => l.line_cd);

    // 辞書作成
    const companyDict = new Map();
    masterData.companies.forEach(c => companyDict.set(String(c.company_cd), c.company_name));

    const lineDict = new Map();
    masterData.lines.forEach(l => lineDict.set(String(l.line_cd), { name: l.line_name, companyCd: l.company_cd }));

    const stationDict = new Map();
    stationsCsv.forEach(st => {
      if (st.station_cd) stationDict.set(String(st.station_cd), { name: st.station_name, lineCd: st.line_cd });
    });

    // 投稿データの結合
    allWorks = madsRes.map(mad => {
      const stInfo = stationDict.get(String(mad.station_cd));
      const lineCd = stInfo ? stInfo.lineCd : null;
      const lineInfo = lineCd ? lineDict.get(String(lineCd)) : null;
      const companyCd = lineInfo ? lineInfo.companyCd : null;

      return {
        title: mad.title || 'タイトルなし',
        url: mad.url,
        remarks: mad.remarks || '', // ← ここを追加
        category: mad.category || '不明',
        companyCd: String(companyCd), // フィルタリング用
        lineCd: String(lineCd),       // フィルタリング用
        companyName: companyCd ? companyDict.get(String(companyCd)) : '不明な事業者',
        lineName: lineInfo ? lineInfo.name : '不明な路線',
        stationName: stInfo ? stInfo.name : '不明な駅',
        searchText: `${mad.title} ${mad.category} ${stInfo ? stInfo.name : ''}`.toLowerCase()
      };
    });

    // 事業者プルダウンの初期化
    masterData.companies.sort((a, b) => a.e_sort - b.e_sort).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.company_cd;
      opt.textContent = c.company_name;
      companySelect.appendChild(opt);
    });

    applyFilters(); // 初期表示
  } catch (error) {
    document.getElementById('workList').innerHTML = '<li class="no-results">データの読み込みに失敗しました。</li>';
  }
}

// 事業者プルダウン変更イベント
companySelect.addEventListener('change', () => {
  const selectedCompany = companySelect.value;
  
  // 路線プルダウンの更新
  lineSelect.innerHTML = '<option value="">すべての路線</option>';
  if (selectedCompany) {
    lineSelect.disabled = false;
    const filteredLines = masterData.lines.filter(l => String(l.company_cd) === selectedCompany);
    filteredLines.sort((a, b) => a.e_sort - b.e_sort).forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.line_cd;
      opt.textContent = l.line_name;
      lineSelect.appendChild(opt);
    });
  } else {
    lineSelect.disabled = true; // 事業者が空なら路線も選択不可に
  }
  
  applyFilters();
});

// 路線プルダウン、テキスト入力変更イベント
lineSelect.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

// フィルタリング実行関数
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  const keywords = query ? query.split(/\s+/) : [];
  const selectedCompany = companySelect.value;
  const selectedLine = lineSelect.value;

  const filtered = allWorks.filter(work => {
    // 1. 事業者フィルタ
    if (selectedCompany && work.companyCd !== selectedCompany) return false;
    // 2. 路線フィルタ
    if (selectedLine && work.lineCd !== selectedLine) return false;
    // 3. テキストフィルタ
    if (keywords.length > 0) {
      const matchText = keywords.every(kw => work.searchText.includes(kw));
      if (!matchText) return false;
    }
    return true;
  });
  
  renderList(filtered.slice().reverse());
}

function renderList(works) {
// js/search.js 内のリストを描画する関数（例: renderList）の中に以下を追加します

function renderList(works) {
  const listEl = document.getElementById('workList');
  const countEl = document.getElementById('resultCount'); // ★追加

  // ★追加：現在の配列の長さを件数として表示
  countEl.innerText = `該当: ${works.length} 件`;

  listEl.innerHTML = ''; // リストを一旦リセット

  if (works.length === 0) {
    listEl.innerHTML = '<li class="no-results">該当する作品が見つかりません。</li>';
    return;
  }

  // ... (この下に既存の works.forEach(...) などのリスト生成処理が続きます)
    works.forEach(work => {
    const li = document.createElement('li');
    li.className = 'work-item';
    
    // 備考があれば表示
    const remarkHtml = work.remarks ? `<div style="font-size: 12px; color: #666; margin-top: 6px;">💬 ${work.remarks}</div>` : '';
    
    li.innerHTML = `
      <a href="${work.url}" target="_blank" class="work-title">${work.title} <span style="font-size: 12px; color: #666;">${work.stationName}駅</span></a>
      <div class="work-meta" style="margin-top: 4px;">
        <table style="table-layout: fixed; width: 100%; border-collapse: collapse;">
          <tr style="font-size: 14px; color: #555;">
            <td>${work.companyName}</td>
            <td>${work.lineName}</td>
            <td>${work.category}</td>
          </tr>
        </table>
      </div>
      ${remarkHtml}
    `;
    listEl.appendChild(li);
  });
}

// 実行
loadData();