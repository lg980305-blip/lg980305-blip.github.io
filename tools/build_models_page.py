#!/usr/bin/env python3
"""amf-models/models.json -> amf-models/index.html 생성기.

사용법: python3 tools/build_models_page.py
신체 치수(height_cm, weight_kg, chest_cm, waist_cm, hip_cm, shoe_mm)는
body_fictional 이 true 인 행은 페이지에 '가상 샘플'로 표시된다.
"""
import html, json, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'amf-models')
rows = json.load(open(os.path.join(ROOT, 'models.json'), encoding='utf-8'))
esc = lambda v: html.escape('' if v is None else str(v))

countries = sorted({r['country'] for r in rows}, key=lambda c: (-sum(1 for r in rows if r['country'] == c), c))
n_model = sum(1 for r in rows if r['cat'] == '모델')
n_win = len(rows) - n_model
any_fictional = any(r.get('body_fictional') for r in rows)

trs = []
for r in rows:
    q = ' '.join(str(r.get(k, '')) for k in ('name', 'country', 'note')).lower()
    fic = ' class="fic"' if r.get('body_fictional') else ''
    trs.append(f'''<tr data-cat="{esc(r['cat'])}" data-country="{esc(r['country'])}" data-q="{esc(q)}">
<td class="no">{r['no']}</td>
<td class="ph"><img src="{esc(r['photo'])}" width="120" height="160" alt="{esc(r['name'])}" loading="lazy" decoding="async"></td>
<td class="nm">{esc(r['name'])}</td>
<td>{esc(r['country'])}</td>
<td><span class="tag {'win' if r['cat'] != '모델' else ''}">{esc(r['cat'])}</span></td>
<td>{esc(r.get('sex'))}</td>
<td{fic} class="num">{esc(r.get('height_cm'))}</td>
<td{fic} class="num">{esc(r.get('weight_kg'))}</td>
<td{fic} class="num">{esc(r.get('chest_cm'))}-{esc(r.get('waist_cm'))}-{esc(r.get('hip_cm'))}</td>
<td{fic} class="num">{esc(r.get('shoe_mm'))}</td>
<td>{esc(r.get('year'))}</td>
<td class="note">{esc(r.get('note'))}</td>
</tr>''')
opts = ''.join(f'<option value="{esc(c)}">{esc(c)} ({sum(1 for r in rows if r["country"] == c)})</option>' for c in countries)
notice = ('<div class="notice"><b>안내</b> 키·몸무게·치수·신발 열은 실제 정보가 아닌 <b>가상 샘플 데이터</b>입니다. '
          '페이지 구성 확인용으로 무작위 생성했으며, 실제 프로필 데이터가 확보되면 교체합니다.</div>') if any_fictional else ''
fic_h = ' <em>(가상)</em>' if any_fictional else ''

page = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>AMF 모델 명단</title>
<meta name="description" content="아시아모델페스티벌(AMF) 모델 {n_model}명과 역대 수상자 {n_win}명의 이름·국가·구분 정리표">
<meta name="theme-color" content="#0A1A33">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<style>
:root{{
  --bg:#F2F4F7; --surface:#FFFFFF; --surface2:#F8FAFC; --line:#E2E7EF; --line2:#CBD4E1;
  --ink:#0F172A; --ink2:#475467; --ink3:#8A94A6;
  --navy:#0A1A33; --brand:#0B3A6F; --brand2:#1256A0; --brandsoft:#EAF1FA;
  --gold:#9E7B24; --goldsoft:#FBF5E6; --warn:#B54708; --warnsoft:#FEF3E6; --warnline:#F5D9B5;
  --r:6px; --r2:10px;
  --sh2:0 2px 6px rgba(16,24,40,.06),0 1px 2px rgba(16,24,40,.04);
  color-scheme:light dark;
}}
@media(prefers-color-scheme:dark){{
  :root:not([data-theme="light"]){{
    --bg:#0A1220; --surface:#111C2F; --surface2:#16233B; --line:#22314F; --line2:#2F4268;
    --ink:#E9EFF9; --ink2:#AAB9D1; --ink3:#7F90AD;
    --brand:#7FB2F0; --brand2:#A9CBF7; --brandsoft:#16233B;
    --gold:#C8A24A; --goldsoft:#2A2410; --warn:#F2B872; --warnsoft:#2A1E0F; --warnline:#5A4220;
  }}
}}
:root[data-theme="dark"]{{
  --bg:#0A1220; --surface:#111C2F; --surface2:#16233B; --line:#22314F; --line2:#2F4268;
  --ink:#E9EFF9; --ink2:#AAB9D1; --ink3:#7F90AD;
  --brand:#7FB2F0; --brand2:#A9CBF7; --brandsoft:#16233B;
  --gold:#C8A24A; --goldsoft:#2A2410; --warn:#F2B872; --warnsoft:#2A1E0F; --warnline:#5A4220;
}}
*{{box-sizing:border-box}}
html,body{{margin:0;background:var(--bg);color:var(--ink);font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",Arial,sans-serif;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1280px;margin:0 auto;padding:28px 16px 64px}}
header h1{{font-size:24px;margin:0 0 6px;letter-spacing:-.01em}}
header p{{margin:0;color:var(--ink2);font-size:14px;line-height:1.6}}
header a{{color:var(--brand)}}
.notice{{margin:14px 0 0;padding:10px 14px;border:1px solid var(--warnline);background:var(--warnsoft);color:var(--warn);border-radius:var(--r2);font-size:13px;line-height:1.6}}
.stats{{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 14px}}
.stat{{background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);padding:10px 14px;box-shadow:var(--sh2);min-width:120px}}
.stat b{{display:block;font-size:20px;color:var(--brand)}}
.stat span{{font-size:12px;color:var(--ink3)}}
.tools{{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}}
.tools input,.tools select{{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line2);border-radius:var(--r);background:var(--surface);color:var(--ink);min-width:0}}
.tools input{{flex:1 1 200px}}
.tools .count{{align-self:center;font-size:13px;color:var(--ink3);margin-left:auto}}
.tblwrap{{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);box-shadow:var(--sh2)}}
table{{border-collapse:collapse;width:100%;min-width:980px;font-size:14px}}
th,td{{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:middle;text-align:left;white-space:nowrap}}
th{{position:sticky;top:0;background:var(--surface2);color:var(--ink2);font-weight:600;font-size:12px;letter-spacing:.02em;z-index:1;user-select:none}}
th em{{font-style:normal;color:var(--warn);font-weight:500}}
th[data-sort]{{cursor:pointer}}
th[data-sort]:after{{content:" ↕";color:var(--ink3);font-size:10px}}
th.asc:after{{content:" ↑";color:var(--brand)}} th.desc:after{{content:" ↓";color:var(--brand)}}
td.no{{color:var(--ink3);font-variant-numeric:tabular-nums;width:44px}}
td.ph{{width:132px}}
td.ph img{{display:block;width:120px;height:160px;object-fit:cover;border-radius:4px;border:1px solid var(--line);background:var(--surface2)}}
td.nm{{font-weight:600}}
td.num{{font-variant-numeric:tabular-nums}}
td.fic{{color:var(--ink2)}}
td.note{{white-space:normal;color:var(--ink2);min-width:160px}}
.tag{{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:var(--brandsoft);color:var(--brand)}}
.tag.win{{background:var(--goldsoft);color:var(--gold)}}
tr.hide{{display:none}}
tbody tr:hover td{{background:var(--surface2)}}
footer{{margin-top:18px;font-size:12px;color:var(--ink3);line-height:1.7}}
@media(max-width:640px){{
  td.ph img{{width:84px;height:112px}} td.ph{{width:96px}}
  th,td{{padding:6px 8px}}
}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>AMF 모델 명단</h1>
  <p>아시아모델페스티벌(Asia Model Festival) 공식 사이트의 <a href="https://amfoc.org/amf-models/" rel="noopener" target="_blank">모델</a> 및 <a href="https://amfoc.org/foa_winners/" rel="noopener" target="_blank">역대 수상자</a> 페이지 기준 정리 (2026-09-18 수집). 사진은 얼굴 중심 3:4 증명사진 규격으로 통일했습니다.</p>
  {notice}
</header>
<div class="stats">
  <div class="stat"><b>{len(rows)}</b><span>전체 인원</span></div>
  <div class="stat"><b>{n_model}</b><span>모델</span></div>
  <div class="stat"><b>{n_win}</b><span>역대 수상자</span></div>
  <div class="stat"><b>{len(countries)}</b><span>국가/지역</span></div>
</div>
<div class="tools">
  <input id="q" type="search" placeholder="이름 · 국가 · 비고 검색" aria-label="검색">
  <select id="cat" aria-label="구분">
    <option value="">구분: 전체</option><option value="모델">모델</option><option value="역대 수상자">역대 수상자</option>
  </select>
  <select id="country" aria-label="국가/지역"><option value="">국가: 전체</option>{opts}</select>
  <span class="count" id="count"></span>
</div>
<div class="tblwrap">
<table id="tbl">
<thead><tr>
  <th data-sort="num">#</th><th>사진</th><th data-sort="text">이름</th><th data-sort="text">국가/지역</th><th data-sort="text">구분</th><th data-sort="text">성별</th>
  <th data-sort="num">키 cm{fic_h}</th><th data-sort="num">몸무게 kg{fic_h}</th><th>가슴-허리-엉덩이 cm{fic_h}</th><th data-sort="num">신발 mm{fic_h}</th>
  <th data-sort="text">연도</th><th>비고</th>
</tr></thead>
<tbody>
{chr(10).join(trs)}
</tbody>
</table>
</div>
<footer>
  원본 썸네일이 작아(모델 200×70px, 수상자 100×100px) 확대 시 화질 한계가 있습니다. 보정은 얼굴 위주 크롭, 약한 노이즈 제거, 약한 선명도만 적용해 원본 인상을 유지했습니다.<br>
  데이터: <a href="models.json">models.json</a> · 처리 도구: <a href="../tools/idphoto.py">tools/idphoto.py</a> · 페이지 생성: <a href="../tools/build_models_page.py">tools/build_models_page.py</a>
</footer>
</div>
<script>
(function(){{
  var q=document.getElementById('q'),cat=document.getElementById('cat'),co=document.getElementById('country'),cnt=document.getElementById('count');
  var rows=[].slice.call(document.querySelectorAll('#tbl tbody tr'));
  function apply(){{
    var s=q.value.trim().toLowerCase(),c=cat.value,k=co.value,n=0;
    rows.forEach(function(tr){{
      var ok=(!s||tr.dataset.q.indexOf(s)>-1)&&(!c||tr.dataset.cat===c)&&(!k||tr.dataset.country===k);
      tr.classList.toggle('hide',!ok); if(ok)n++;
    }});
    cnt.textContent=n+' / '+rows.length+'명';
  }}
  q.addEventListener('input',apply);cat.addEventListener('change',apply);co.addEventListener('change',apply);apply();
  var ths=[].slice.call(document.querySelectorAll('th[data-sort]')),tb=document.querySelector('#tbl tbody');
  ths.forEach(function(th){{
    var idx=[].indexOf.call(th.parentNode.children,th);
    th.addEventListener('click',function(){{
      var dir=th.classList.contains('asc')?'desc':'asc';
      ths.forEach(function(t){{t.classList.remove('asc','desc')}});th.classList.add(dir);
      var num=th.dataset.sort==='num';
      rows.sort(function(a,b){{
        var x=a.children[idx].textContent.trim(),y=b.children[idx].textContent.trim();
        var r=num?(+x||0)-(+y||0):x.localeCompare(y,'ko');return dir==='asc'?r:-r;
      }});
      rows.forEach(function(r){{tb.appendChild(r)}});
    }});
  }});
}})();
</script>
</body>
</html>
'''
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
print('wrote index.html', len(rows), 'rows')
