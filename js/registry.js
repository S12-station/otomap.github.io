// GASのウェブアプリURLをここに設定
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz01EQuEGIaqjoyydvJLa-kAC2AzP0bpWr_55G4P418DoWwq7T_QwNCecCuYxlbxAqVSQ/exec';

// プレビューマップの初期化 (初期表示は日本全体)
const map = L.map('previewMap', { zoomControl: false, dragging: false }).setView([36.2048, 138.2529], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let currentMarker = null;

// マスタデータを格納するグローバル変数
let masterData = {
  companies: [],
  lines: [],
  stations: []
};

// 要素
const comSelect = document.getElementById('companySelect');
const lineSelect = document.getElementById('lineSelect');
const stSelect = document.getElementById('stationSelect');

// CSVパース用ヘルパー
function fetchCsv(path) {
  return new Promise((resolve) => {
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => resolve(results.data)
    });
  });
}

// マスタデータを格納するグローバル変数の上に以下を追加
let existingWorks = [];

// 起動時に全CSVと既存作品データを読み込む (initMasterData関数を修正)
async function initMasterData() {
  const [comRes, lineRes, stRes, madsRes] = await Promise.all([
    fetchCsv('csv/company.csv'),
    fetchCsv('csv/line.csv'),
    fetchCsv('csv/station.csv'),
    fetch(GAS_URL).then(res => res.json()).catch(() => []) // ★GASデータも取得
  ]);

  masterData.companies = comRes.filter(c => c.company_cd);
  masterData.lines = lineRes.filter(l => l.line_cd);
  masterData.stations = stRes.filter(s => s.station_cd);
  existingWorks = madsRes; // ★既存作品を保存

  // 事業者セレクトボックスを構築
  comSelect.innerHTML = '<option value="">選択してください</option>';
  masterData.companies.sort((a, b) => a.e_sort - b.e_sort).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.company_cd;
    opt.textContent = c.company_name;
    comSelect.appendChild(opt);
  });
}

// 事業者変更 -> 路線の絞り込み (ラグなし)
comSelect.addEventListener('change', () => {
  lineSelect.innerHTML = '<option value="">選択してください</option>';
  stSelect.innerHTML = '<option value="">路線を選択</option>';
  stSelect.disabled = true;

  if (!comSelect.value) {
    lineSelect.disabled = true;
    return;
  }
  
  lineSelect.disabled = false;
  const targetCompany = String(comSelect.value);
  
  const filteredLines = masterData.lines.filter(l => String(l.company_cd) === targetCompany);
  filteredLines.sort((a, b) => a.e_sort - b.e_sort).forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.line_cd;
    opt.textContent = l.line_name;
    lineSelect.appendChild(opt);
  });
});

// 路線変更 -> 駅の絞り込み (ラグなし)
lineSelect.addEventListener('change', () => {
  stSelect.innerHTML = '<option value="">選択してください</option>';
  
  if (!lineSelect.value) {
    stSelect.disabled = true;
    return;
  }

  stSelect.disabled = false;
  const targetLine = String(lineSelect.value);

  const filteredStations = masterData.stations.filter(s => String(s.line_cd) === targetLine);
  filteredStations.sort((a, b) => a.e_sort - b.e_sort).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.station_cd;
    opt.textContent = s.station_name;
    // 座標データを保持
    opt.dataset.lat = s.lat;
    opt.dataset.lon = s.lon;
    stSelect.appendChild(opt);
  });
});

// 駅変更 -> 地図移動 ＆ サジェスト表示
stSelect.addEventListener('change', () => {
  const selectedOpt = stSelect.options[stSelect.selectedIndex];
  const suggestionBox = document.getElementById('suggestionBox');
  const suggestionList = document.getElementById('suggestionList');

  // 未選択に戻された場合は非表示にする
  if (!selectedOpt.value) {
    suggestionBox.style.display = 'none';
    return;
  }

  const targetStationCd = selectedOpt.value;
  const lat = parseFloat(selectedOpt.dataset.lat);
  const lon = parseFloat(selectedOpt.dataset.lon);

  // マップの移動処理
  if (currentMarker) map.removeLayer(currentMarker);
  currentMarker = L.marker([lat, lon]).addTo(map);
  map.setView([lat, lon], 15);

  // 既存作品の検索とサジェスト表示
  const alreadyRegistered = existingWorks.filter(work => String(work.station_cd) === String(targetStationCd));

  if (alreadyRegistered.length > 0) {
    suggestionList.innerHTML = '';
    alreadyRegistered.forEach(work => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="${work.url}" target="_blank" style="color: var(--ios-blue); text-decoration: none;">${work.title}</a> <span style="color:#666; font-size:12px;">[${work.category}]</span>`;
      suggestionList.appendChild(li);
    });
    suggestionBox.style.display = 'block'; // 一致したら表示
  } else {
    suggestionBox.style.display = 'none'; // 無ければ隠す
  }
});

// 送信処理
document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const urlInput = document.getElementById('url').value;

  // 1. URLのドメイン制限バリデーション
  try {
    const urlObj = new URL(urlInput);
    const hostname = urlObj.hostname;
    
    // 許可するドメイン（SoundCloudを追加）
    const isValid = 
      hostname.includes('youtube.com') || 
      hostname.includes('youtu.be') || 
      hostname.includes('nicovideo.jp') || 
      hostname.includes('nico.ms') ||
      hostname.includes('bilibili.com') ||
      hostname.includes('b23.tv') ||
      hostname.includes('soundcloud.com'); 

    if (!isValid) {
      alert('エラー: YouTube、ニコニコ動画、Bilibili、SoundCloudのURLのみ登録可能です。');
      return; // 処理をここで中断
    }
  } catch (err) {
    alert('エラー: 正しいURL形式で入力してください。');
    return; // URLとして認識できない文字列を中断
  }

  // 2. 送信処理
  btn.disabled = true;
  btn.innerText = '送信中...';

  // 選択されている駅の「テキスト（駅名）」を取得
  const selectedOpt = stSelect.options[stSelect.selectedIndex];
  const stationName = selectedOpt.textContent;

  const payload = {
    station_cd: stSelect.value,
    station_name: stationName, // ★ここを追加
    title: document.getElementById('title').value,
    url: urlInput,
    remarks: document.getElementById('remarks').value,
    category: document.getElementById('category').value
  };

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    
    if (result.status === 'success') {
      alert('登録が完了しました。');
      // 成功時にマップ画面へ戻す場合はここのコメントアウトを外してください
      // window.location.href = 'index.html';
    } else {
      alert('エラー: ' + result.message);
    }
  } catch (err) {
    alert('通信に失敗しました。');
  } finally {
    btn.disabled = false;
    btn.innerText = '登録する';
  }
});

// 実行
initMasterData();