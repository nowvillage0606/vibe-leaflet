import yaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

const presetPath = new URLSearchParams(location.search).get('preset')
  || '../presets/card_unconsciousness.yml';

// YAML取得→パース
const res = await fetch(presetPath, { cache: 'no-store' });
if(!res.ok){ console.error('YAML fetch failed:', res.status, presetPath); }
const data = yaml.load(await res.text());

// ===== FRONT =====
document.title = `${data?.meta?.title ?? 'Card'} - Card`;

const $visual   = document.getElementById('visual');
const $hero     = document.getElementById('hero');
const $titleBox = document.getElementById('titleBox');
const $titleBg  = document.getElementById('titleBg');
const $titleTxt = document.getElementById('titleText');

if (data?.front?.hero_image)   $hero.src = data.front.hero_image;
if (data?.front?.background) {
  $visual.style.backgroundImage   = `url(${data.front.background})`;
  $visual.style.backgroundSize    = 'cover';
  $visual.style.backgroundPosition= 'center';
}

// タイトル文字
const t = data?.front?.title_text ?? data?.meta?.title ?? '';
$titleTxt.textContent = t;

// フォント読込（Google Fonts等のCSSをlinkで追加）
const st = data?.front?.title_style ?? {};
if (st.font_url){
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = st.font_url;
  document.head.appendChild(link);
}
if (st.font_family) $titleTxt.style.fontFamily   = st.font_family;
if (st.weight)      $titleTxt.style.fontWeight   = st.weight;
if (typeof st.tracking_em === 'number') $titleTxt.style.letterSpacing = `${st.tracking_em}em`;
if (st.size_clamp)  $titleTxt.style.fontSize     = st.size_clamp;
if (st.fill)        $titleTxt.style.color        = st.fill;
if (st.shadow)      $titleTxt.style.textShadow   = st.shadow;
if (st.bg && st.bg !== ''){ $titleBg.style.display = 'block'; $titleBg.style.background = st.bg; }

// 配置
const align = (st.align || 'left-bottom').toLowerCase();
$titleBox.classList.remove('align-center','align-left-top','align-right-bottom');
if (align === 'center')       $titleBox.classList.add('align-center');
if (align === 'left-top')     $titleBox.classList.add('align-left-top');
if (align === 'right-bottom') $titleBox.classList.add('align-right-bottom');

// ===== BACK（歌詞2段＋クレジット＋背景） =====
const $back    = document.getElementById('back');
const $lyrics  = document.getElementById('lyrics');
const $credits = document.getElementById('creditsBlock');

// 背景
if (data?.back?.background){
  $back.classList.add('bg-cover');
  $back.style.backgroundImage = `url(${data.back.background})`;
  if (data?.back?.bg_panel) $lyrics.classList.add('backdrop');
}

// タイポ設定
const typ = data?.back?.typography ?? {};
if (typ.font_size_pt)  $lyrics.style.fontSize   = `${typ.font_size_pt}pt`;
if (typ.line_height)   $lyrics.style.lineHeight = typ.line_height;
if (typ.columns)       $lyrics.style.columns    = typ.columns;
if (typ.column_gap_mm) $lyrics.style.columnGap  = `${typ.column_gap_mm}mm`;

// 歌詞描画
const sections = data?.back?.sections ?? [];
$lyrics.innerHTML = sections.map(sec => renderSection(sec)).join('\n');

// クレジット描画
const credits = data?.back?.credits ?? [];
$credits.innerHTML = credits.length
  ? `<div><strong>Credits</strong></div><div>${credits.map(c=>escapeHtml(c)).join('<br>')}</div>`
  : '';

// クレジット分の下余白（歌詞が被らないように）
requestAnimationFrame(()=>{
  const ch = $credits.getBoundingClientRect().height;
  const curPB = parseFloat(getComputedStyle($lyrics).paddingBottom) || 0;
  $lyrics.style.paddingBottom = `${curPB + ch + 8}px`;

  // 収まりきらない場合は自動縮小
  if (typ.autoshrink){
    autoShrinkToFit({
      container: $back,
      content: $lyrics,
      creditsHeight: ch + 8,
      fontPtStart: parseFloat(typ.font_size_pt || 10.5),
      fontPtMin: parseFloat(typ.min_font_pt || 8.0),
      lhStart: parseFloat(typ.line_height || 1.35),
      lhMin: parseFloat(typ.min_line_height || 1.25),
      step: 0.5
    });
  }
});

// ===== util: セクション描画（lyrics or lines両対応）
function renderSection(sec){
  const h = sec?.heading ? `<div class="heading">${escapeHtml(sec.heading)}</div>` : '';
  if (sec?.lyrics) {
    return `${h}<div style="white-space:pre-wrap">${escapeHtml(sec.lyrics)}</div><div style="height:8px"></div>`;
  }
  if (Array.isArray(sec?.lines)) {
    const body = sec.lines.map(line => {
      const cls = line.glitch ? 'glitch' : (line.alt ? 'alt' : '');
      return `<div class="${cls}">${escapeHtml(line.text ?? '')}</div>`;
    }).join('');
    return `${h}${body}<div style="height:8px"></div>`;
  }
  return h;
}

function escapeHtml(s=''){
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

// ===== 自動縮小：収まるまでフォントと行高を少しずつ下げる
function autoShrinkToFit(opts){
  const { container, content, creditsHeight, fontPtStart, fontPtMin, lhStart, lhMin, step } = opts;
  let f = fontPtStart, lh = lhStart;
  const getOverflow = () => {
    // 利用可能高さ（シート全高から下余白＆クレジット分を除外）
    const avail = container.clientHeight - creditsHeight;
    return content.scrollHeight - avail;
  };
  let guard=0;
  while (getOverflow() > 0 && guard < 50){
    if (f > fontPtMin){ f = +(f - step).toFixed(2); content.style.fontSize = `${f}pt`; }
    else if (lh > lhMin){ lh = +(lh - 0.02).toFixed(2); content.style.lineHeight = lh; }
    else { console.warn('autoshrink reached minimums'); break; }
    guard++;
  }
}