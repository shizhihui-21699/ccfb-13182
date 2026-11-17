import React, { useState } from 'react';

const DEMO_PAGES = [
  ['hidden-type', 'type=hidden'],
  ['offscreen', '移出屏幕'],
  ['opacity', '透明'],
  ['tiny', '1px 像素'],
  ['overlay', '遮挡层'],
  ['collapsed', '折叠容器'],
  ['combo', '综合版'],
];

const LEVEL_STYLE = {
  none: { bg: '#dcfce7', fg: '#166534', label: '安全' },
  low: { bg: '#fef9c3', fg: '#854d0e', label: '低风险' },
  medium: { bg: '#ffedd5', fg: '#9a3412', label: '中风险' },
  high: { bg: '#fee2e2', fg: '#991b1b', label: '高风险' },
};

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [shotTab, setShotTab] = useState('annotated');

  async function scan(target) {
    const u = (target ?? url).trim();
    if (!u) return;
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setReport(json);
      setShotTab('annotated');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const lvl = report ? LEVEL_STYLE[report.risk.level] : null;

  return (
    <div className="wrap">
      <header>
        <h1>🛡️ Autofill Guard</h1>
        <p>
          在无头浏览器中加载页面,找出被隐藏却声明了 <code>autocomplete</code> 类别的输入框,
          并模拟一次自动填充,列出实际会被带走的字段。
        </p>
      </header>

      <div className="scanbar">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && scan()}
          placeholder="https://example.com/signup"
        />
        <button onClick={() => scan()} disabled={loading}>
          {loading ? '扫描中…' : '扫描'}
        </button>
      </div>

      <div className="demos">
        <span>试试演示页面:</span>
        {DEMO_PAGES.map(([name, label]) => {
          const u = `${location.origin}/demo/${name}.html`;
          return (
            <span key={name} className="chip-group">
              <button className="chip" onClick={() => { setUrl(u); scan(u); }} disabled={loading}>
                {label}
              </button>
              <a className="chip-open" href={u} target="_blank" rel="noreferrer" title="在新标签页打开(可手动触发浏览器自动填充)">↗</a>
            </span>
          );
        })}
      </div>

      {error && <div className="error">扫描失败:{error}</div>}

      {report && (
        <div className="report">
          <div className="risk" style={{ background: lvl.bg, color: lvl.fg }}>
            <div className="risk-score">{report.risk.score}</div>
            <div>
              <div className="risk-level">{lvl.label}</div>
              <ul>
                {report.risk.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>

          {report.error && <div className="error">页面加载错误:{report.error}</div>}

          {report.page && (
            <>
              <div className="stats">
                <div><b>{report.page.fields.length}</b><span>自动填充相关字段</span></div>
                <div><b>{report.page.visibleFieldCount}</b><span>可见</span></div>
                <div className={report.page.hiddenFieldCount ? 'bad' : ''}>
                  <b>{report.page.hiddenFieldCount}</b><span>被隐藏</span>
                </div>
                <div className={report.page.hiddenSensitiveCount ? 'bad' : ''}>
                  <b>{report.page.hiddenSensitiveCount}</b><span>隐藏且敏感</span>
                </div>
              </div>

              <div className="tabs">
                <button className={shotTab === 'annotated' ? 'on' : ''} onClick={() => setShotTab('annotated')}>标注截图</button>
                <button className={shotTab === 'original' ? 'on' : ''} onClick={() => setShotTab('original')}>原始截图</button>
              </div>
              <img
                className="shot"
                src={shotTab === 'annotated' ? report.annotatedScreenshot : report.screenshot}
                alt="页面截图"
              />

              <h2>字段清单</h2>
              <table className="fields">
                <thead>
                  <tr>
                    <th></th><th>字段</th><th>autocomplete</th><th>位置/尺寸</th>
                    <th>隐藏手法</th><th>模拟填充结果</th>
                  </tr>
                </thead>
                <tbody>
                  {report.page.fields.map((f) => (
                    <tr key={f.index} className={f.hidden ? 'hidden-row' : ''}>
                      <td>{f.hidden ? '🚩' : '✅'}</td>
                      <td>
                        <code>{f.name || f.id || f.type}</code>
                        {f.label && <div className="muted">{f.label}</div>}
                        {f.placeholder && <div className="muted">placeholder: {f.placeholder}</div>}
                      </td>
                      <td><code>{f.token || '—'}</code>{f.sensitive && <span className="tag">敏感</span>}</td>
                      <td className="muted">({f.rect.x}, {f.rect.y}) {f.rect.width}×{f.rect.height}</td>
                      <td>
                        {f.hidingSignals.length
                          ? f.hidingSignals.map((s, i) => <div key={i} className="signal">{s}</div>)
                          : <span className="muted">可见</span>}
                      </td>
                      <td>
                        {f.capturedValue
                          ? <code className={f.hidden ? 'stolen' : ''}>{f.capturedValue}</code>
                          : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {report.page.forms.map((form) => (
                <div key={form.index} className="formdump">
                  <h2>表单 #{form.index} 提交内容 <code>{form.method} {form.action}</code></h2>
                  {form.submittedEntries.length ? (
                    <table className="fields">
                      <thead><tr><th></th><th>name</th><th>提交值</th></tr></thead>
                      <tbody>
                        {form.submittedEntries.map((e, i) => (
                          <tr key={i} className={e.hidden ? 'hidden-row' : ''}>
                            <td>{e.hidden ? '🚩' : '✅'}</td>
                            <td><code>{e.name}</code></td>
                            <td><code className={e.hidden ? 'stolen' : ''}>{e.value || '(空)'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="muted">(无命名字段)</p>}
                </div>
              ))}

              <p className="muted meta">
                {report.finalUrl} · 耗时 {report.durationMs}ms · {report.scannedAt}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
