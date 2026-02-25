const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;
const TOKEN = process.env.DASHBOARD_TOKEN || '';

const STATE_DIR = '/state';
const OUTPUT_DIR = '/output';
const TOOLS_DIR = '/tools';
const LOG_DIR = '/var/log/agent';
const AGENT_DIR = '/agent';
const ENABLED_FLAG = path.join(STATE_DIR, 'agent_enabled');
const DIRECTIVES_FILE = path.join(STATE_DIR, 'directives.json');

const { createDirectivesRouter } = require('./directives');

app.use(express.json({ limit: '10kb' }));

// ── Sanitized markdown renderer ─────────────────────────────────────────

function renderMarkdown(content) {
  return DOMPurify.sanitize(marked(content));
}

// ── Authentication middleware ───────────────────────────────────────────
// Requires ?token=<TOKEN> query param or Authorization: Bearer <TOKEN> header.
// If DASHBOARD_TOKEN is empty, auth is disabled (development mode).

function auth(req, res, next) {
  if (!TOKEN) return next();
  const qToken = req.query.token;
  const hToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (qToken === TOKEN || hToken === TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized — provide ?token= or Authorization: Bearer header' });
}

// Apply auth to all /api routes
app.use('/api', auth);

// ── Directives CRUD ──────────────────────────────────────────────────────
app.use('/api', createDirectivesRouter(DIRECTIVES_FILE));

// ── Agent Model ─────────────────────────────────────────────────────────────
const AGENT_ENV_FILE = path.join(AGENT_DIR, 'agent.env');
const VALID_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'];
const MODEL_LABELS = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-opus-4-6': 'Opus',
};

app.get('/api/agent-model', (req, res) => {
  try {
    const content = fs.readFileSync(AGENT_ENV_FILE, 'utf-8');
    const match = content.match(/^AGENT_MODEL=(.+)$/m);
    const model = match ? match[1].trim() : 'claude-sonnet-4-6';
    res.json({ model, label: MODEL_LABELS[model] || model, available: VALID_MODELS });
  } catch (err) {
    res.status(500).json({ error: 'Could not read agent.env' });
  }
});

app.put('/api/agent-model', (req, res) => {
  const { model } = req.body || {};
  if (!model || !VALID_MODELS.includes(model)) {
    return res.status(400).json({ error: `model must be one of: ${VALID_MODELS.join(', ')}` });
  }
  try {
    let content = fs.readFileSync(AGENT_ENV_FILE, 'utf-8');
    content = content.replace(/^AGENT_MODEL=.+$/m, `AGENT_MODEL=${model}`);
    const tmp = AGENT_ENV_FILE + '.tmp';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, AGENT_ENV_FILE);
    res.json({ model, label: MODEL_LABELS[model] || model });
  } catch (err) {
    res.status(500).json({ error: 'Could not write agent.env' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// CORE API — The agent may add routes but must NEVER remove or break these.
// ────────────────────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  const enabled = readFile(ENABLED_FLAG).trim() === 'enabled';
  let processStatus = 'idle';
  // Check invoke PID file for running invocation
  const pidFile = '/agent/.run/invoke.pid';
  const supervisorPidFile = '/agent/.run/supervisor.pid';
  try {
    const pid = readFile(pidFile).trim();
    if (pid && fs.existsSync('/proc/' + pid)) { processStatus = 'running'; }
    else {
      // Check if supervisor is running (systemd or background) — means we're between invocations
      let supervisorRunning = false;
      try { execSync('sudo systemctl is-active agent-supervisor --quiet', { stdio: 'ignore' }); supervisorRunning = true; } catch {}
      if (!supervisorRunning) {
        const spid = readFile(supervisorPidFile).trim();
        if (spid && fs.existsSync('/proc/' + spid)) { supervisorRunning = true; }
      }
      if (supervisorRunning) { processStatus = 'sleeping'; }
    }
  } catch { /* idle */ }

  const phase = readJson(path.join(STATE_DIR, 'phase.json'));
  const health = readJson(path.join(STATE_DIR, 'health.json'));
  // Agent writes dev-objectives.json with { active, items: [...] } shape
  const devObj = readJson(path.join(STATE_DIR, 'dev-objectives.json'));
  const objectives = devObj?.items ?? readJson(path.join(STATE_DIR, 'objectives.json')) ?? [];
  const activeObjectives = Array.isArray(objectives) ? objectives.filter(o => o.status === 'active') : [];

  // Count invocations from log files
  let totalInvocations = health?.total_invocations || 0;
  if (!totalInvocations) {
    try {
      const logFiles = fs.readdirSync('/var/log/agent/').filter(f => f.startsWith('invocation_') && f.endsWith('.log'));
      totalInvocations = logFiles.length;
    } catch { /* ignore */ }
  }

  // Disk usage
  let diskUsage = null;
  try {
    const df = execSync("df -h / | tail -1 | awk '{print $3, $4, $5}'", { encoding: 'utf-8' }).trim().split(' ');
    diskUsage = { used: df[0], available: df[1], percent: df[2] };
  } catch { /* ignore */ }

  res.json({
    enabled, processStatus,
    phase: phase?.phase || null,
    // support both field names: consecutive_stalls (agent) and stall_count (legacy)
    stallCount: health?.consecutive_stalls || health?.stall_count || 0,
    totalInvocations,
    activeObjectives: activeObjectives.length,
    objectives: Array.isArray(objectives) ? objectives : [],
    currentDirectiveId: devObj?.active?.current_directive_id || null,
    diskUsage
  });
});

app.post('/api/toggle', (req, res) => {
  const current = readFile(ENABLED_FLAG).trim();
  const newState = current === 'enabled' ? 'disabled' : 'enabled';
  fs.writeFileSync(ENABLED_FLAG, newState);
  if (newState === 'enabled') {
    // Start the supervisor (try systemd, fall back to background process)
    try { execSync('sudo systemctl start agent-supervisor', { stdio: 'ignore' }); } catch {
      // Check if supervisor is already running as background process
      const spid = readFile('/agent/.run/supervisor.pid').trim();
      const alreadyRunning = spid && fs.existsSync('/proc/' + spid);
      if (!alreadyRunning) {
        try { execSync('nohup /agent/supervisor.sh >> /var/log/agent/daemon.log 2>&1 &', { stdio: 'ignore' }); } catch {}
      }
    }
  }
  res.json({ enabled: newState === 'enabled' });
});

app.get('/api/documents', (req, res) => { res.json(walkDir(OUTPUT_DIR, OUTPUT_DIR)); });
app.get('/api/state', (req, res) => { res.json(walkDir(STATE_DIR, STATE_DIR)); });

app.get('/api/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path required' });
  const resolved = path.resolve(filePath);
  const allowed = [OUTPUT_DIR, STATE_DIR, TOOLS_DIR, LOG_DIR, AGENT_DIR];
  if (!allowed.some(dir => resolved === dir || resolved.startsWith(dir + '/'))) return res.status(403).json({ error: 'Access denied' });
  if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });
  const real = fs.realpathSync(resolved);
  if (!allowed.some(dir => real.startsWith(dir + '/') || real === dir)) return res.status(403).json({ error: 'Access denied (symlink)' });
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) return res.json({ type: 'directory', files: walkDir(resolved, resolved) });
  const ext = path.extname(resolved).toLowerCase();
  const content = fs.readFileSync(resolved, 'utf-8');
  res.json({
    type: 'file', path: resolved, name: path.basename(resolved), ext,
    size: stat.size, modified: stat.mtime, content,
    html: ['.md', '.markdown'].includes(ext) ? renderMarkdown(content) : null
  });
});

app.get('/api/logs', (req, res) => {
  try {
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('invocation_')).sort().reverse().slice(0, 20);
    res.json(files.map(f => {
      const content = fs.readFileSync(path.join(LOG_DIR, f), 'utf-8').slice(-5000);
      const { format } = parseStreamJsonLog(content);
      return { name: f, content, format };
    }));
  } catch { res.json([]); }
});

app.get('/api/journal', (req, res) => {
  const p = path.join(STATE_DIR, 'journal.md');
  if (!fs.existsSync(p)) return res.json({ content: '', html: '' });
  const content = fs.readFileSync(p, 'utf-8');
  res.json({ content, html: renderMarkdown(content) });
});

// ── Summary/digest routes ───────────────────────────────────────────────

const SUMMARY_DIR = '/output/summaries';
const SUMMARY_ARCHIVE_DIR = path.join(SUMMARY_DIR, 'archive');

app.get('/api/summary', (req, res) => {
  const p = path.join(SUMMARY_DIR, 'latest.md');
  if (!fs.existsSync(p)) return res.json({ content: '', html: '', exists: false, modified: null });
  const content = fs.readFileSync(p, 'utf-8');
  const stat = fs.statSync(p);
  res.json({ content, html: renderMarkdown(content), exists: true, modified: stat.mtime });
});

app.get('/api/summary/archive', (req, res) => {
  try {
    if (!fs.existsSync(SUMMARY_ARCHIVE_DIR)) return res.json([]);
    const files = fs.readdirSync(SUMMARY_ARCHIVE_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 20);
    res.json(files.map(f => ({
      name: f,
      timestamp: f.replace('.md', ''),
      path: path.join(SUMMARY_ARCHIVE_DIR, f)
    })));
  } catch { res.json([]); }
});

// ── Live output (current invocation) ────────────────────────────────────

app.get('/api/live', (req, res) => {
  const currentLog = path.join(LOG_DIR, 'current.log');
  let running = false, logFile = null, content = '', size = 0;
  const MAX_SIZE = 512000; // 500KB for stream-json logs
  try {
    const st = fs.lstatSync(currentLog);
    if (st.isSymbolicLink()) {
      const resolved = fs.realpathSync(currentLog);
      running = true;
      logFile = path.basename(resolved);
      content = fs.readFileSync(resolved, 'utf-8');
      size = content.length;
      if (content.length > MAX_SIZE) content = content.slice(-MAX_SIZE);
    }
  } catch {}
  if (!running) {
    try {
      const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('invocation_')).sort().reverse();
      if (files.length > 0) {
        logFile = files[0];
        content = fs.readFileSync(path.join(LOG_DIR, files[0]), 'utf-8');
        size = content.length;
        if (content.length > MAX_SIZE) content = content.slice(-MAX_SIZE);
      }
    } catch {}
  }
  const parsed = parseStreamJsonLog(content);
  res.json({ running, log: logFile, content, size, format: parsed.format, events: parsed.events });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function readFile(p) { try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }

function parseStreamJsonLog(content) {
  const lines = content.split('\n');
  const events = [];
  let hasJsonEvents = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.type) { events.push(obj); hasJsonEvents = true; }
    } catch { /* skip non-JSON or truncated lines */ }
  }
  return { format: hasJsonEvents ? 'stream-json' : 'text', events: hasJsonEvents ? events : null };
}

function walkDir(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    if (entry.isDirectory()) {
      if (entry.name === 'backups' || entry.name === 'node_modules' || entry.name === 'data' || entry.name === '.venv') continue;
      results.push({ name: entry.name, path: full, type: 'directory', children: walkDir(full, base) });
    } else {
      results.push({ name: entry.name, path: full, type: 'file', size: stat.size, modified: stat.mtime, ext: path.extname(entry.name).toLowerCase() });
    }
  }
  return results.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
}

// ── Science Trends API ───────────────────────────────────────────────────

const SCI_TRENDS_DATA = '/tools/sci-trends/data';

app.get('/api/sci-trends/summary', (req, res) => {
  try {
    const fieldTrends = readJson(path.join(SCI_TRENDS_DATA, 'field_trends.json'));
    const topicGrowth = readJson(path.join(SCI_TRENDS_DATA, 'topic_growth.json'));
    const geography = readJson(path.join(SCI_TRENDS_DATA, 'geography.json'));
    const citations = readJson(path.join(SCI_TRENDS_DATA, 'citations.json'));
    const crossDisc = readJson(path.join(SCI_TRENDS_DATA, 'cross_discipline.json'));

    if (!fieldTrends) return res.status(404).json({ error: 'No sci-trends data found. Run analyze.py --all first.' });

    const fields = (fieldTrends.fields || []).map(f => ({
      name: f.field_name,
      cagr_5y: f.cagr_5y || 0,
      cagr_10y: f.cagr_10y || 0,
      works_2024: f.year_counts?.['2024'] || f.total_2024 || 0,
      abs_growth_5y: f.abs_growth_5y || 0,
    })).sort((a, b) => b.cagr_5y - a.cagr_5y);

    const topGrowing = (topicGrowth?.top_25_growing || []).slice(0, 15).map(t => ({
      name: t.topic_name, field: t.field_name,
      cagr: t.cagr_5y, works_2024: t.count_2024, works_2019: t.count_2019,
    }));

    const countries = (geography?.top_20_rankings || []).slice(0, 15).map(c => ({
      name: c.country_name, works_2024: c.total_2024,
      share_2024: c.share_2024, share_2015: c.share_2015, cagr_5y: c.cagr_5y,
    }));

    const rising = (geography?.rising_countries || []).slice(0, 10).map(c => ({
      name: c.country_name, works_2024: c.total_2024,
      cagr_10y: c.cagr_10y, rank_change: c.rank_change,
    }));

    const citationFields = (citations?.fields_by_mean_citations || []).slice(0, 15).map(f => ({
      name: f.field_name, mean: f.mean_citations,
      median: f.median_citations, works: f.total_works_2023,
    }));

    const topWorks = (citations?.top_20_most_cited_works_2023 || []).slice(0, 10).map(w => ({
      title: w.title, citations: w.cited_by_count,
      field: w.field, authors: (w.authors || []).slice(0, 2).join(', '),
    }));

    const crossTopics = (crossDisc?.top_20_most_cross_disciplinary_2024 || []).slice(0, 10).map(t => ({
      name: t.topic_name, entropy_2024: t.entropy_2024,
      field_count_2024: t.num_fields_2024, primary_field: t.primary_field,
    }));

    const emerged = (topicGrowth?.emerged || []).slice(0, 10).map(t => ({
      name: t.topic_name, field: t.field_name, works_2024: t.count_2024,
    }));

    res.json({
      generated: fieldTrends.generated_at,
      fields, topGrowing, countries, rising,
      citationFields, topWorks, crossTopics, emerged,
      globalWorks2024: fieldTrends.global_year_counts?.['2024'] || 10229260,
      countriesTracked: geography?.total_countries || 210,
      topicsTracked: topicGrowth?.summary?.total_topics || 2952,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Attention Gap API ────────────────────────────────────────────────
const ATTENTION_GAP_DATA = '/tools/attention-gap/data';
const ATTENTION_GAP_SUMMARY = '/output/research/attention-gap-analysis/summary.json';

app.get('/api/attention-gap/summary', (req, res) => {
  try {
    const summary = readJson(ATTENTION_GAP_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No attention gap data found. Run analyze.py --all first.' });

    const gapAnalysis = readJson(path.join(ATTENTION_GAP_DATA, 'gap_analysis.json'));
    const stats = gapAnalysis?.statistics || {};
    const meta = gapAnalysis?.metadata || {};

    // Build field gap chart data (sorted by gap)
    const fieldGaps = Object.entries(summary.field_gaps || {}).map(([name, d]) => ({
      name: name.length > 25 ? name.slice(0, 22) + '...' : name,
      fullName: name,
      mean: d.mean,
      count: d.count,
    })).sort((a, b) => b.mean - a.mean);

    // Top under-covered with more detail
    const underCovered = (gapAnalysis?.rankings?.under_covered_filtered || []).slice(0, 10).map(t => ({
      topic: t.topic_name, field: t.field_name, wiki: t.wikipedia_title,
      pubs: t.science_pubs_2024, views: Math.round(t.pageview_avg_monthly),
      gap: t.level_gap,
    }));

    // Top high-attention
    const highAttention = (gapAnalysis?.rankings?.over_hyped_filtered || []).slice(0, 10).map(t => ({
      topic: t.topic_name, field: t.field_name, wiki: t.wikipedia_title,
      pubs: t.science_pubs_2024, views: Math.round(t.pageview_avg_monthly),
      gap: t.level_gap,
    }));

    // Trend gaps
    const trendSciOutpacing = (gapAnalysis?.rankings?.trend_science_outpacing || []).slice(0, 10).map(t => ({
      topic: t.topic_name, sciCagr: t.science_cagr, pvCagr: t.pageview_cagr,
      trendGap: t.trend_gap,
    }));

    res.json({
      generated: summary.generated_at,
      topicsAnalyzed: summary.topics_analyzed,
      topicsFiltered: summary.topics_filtered,
      spearmanRho: summary.spearman_rho,
      meanTrendGap: stats.trend_gap?.mean || 6.3,
      fieldGaps, underCovered, highAttention, trendSciOutpacing,
      levelGapStats: stats.level_gap || {},
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve static files from /agent/dashboard/public/
app.use('/public', express.static(path.join(__dirname, 'public')));

// Attention gap page route
app.get('/attention-gap', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'attention-gap.html');
  if (!fs.existsSync(p)) return res.status(404).send('Attention gap page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// ── Climate Trends API ──────────────────────────────────────────────
const CLIMATE_DATA = '/tools/climate-trends/data/analysis';
const CLIMATE_SUMMARY = '/output/research/climate-trends/summary.json';
const CLIMATE_COLLECTION_STATE = '/tools/climate-trends/data/historical/collection_state.json';

app.get('/api/climate/summary', (req, res) => {
  try {
    const summary = readJson(CLIMATE_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No climate data found. Run report generator first.' });

    const trends = readJson(path.join(CLIMATE_DATA, 'trends.json'));
    const extremes = readJson(path.join(CLIMATE_DATA, 'extremes.json'));
    const volatility = readJson(path.join(CLIMATE_DATA, 'volatility.json'));
    const collState = readJson(CLIMATE_COLLECTION_STATE);

    // Full city trend ranking
    const cityRanking = (trends?.full_period_ranking || []).map(c => ({
      rank: c.rank, city: c.city, climate: c.climate, continent: c.continent,
      warming_rate: c.warming_rate, sen_slope: c.sen_slope, r_squared: c.r_squared,
      p_value: c.p_value, total_change: c.total_change,
      mean_temp_start: c.mean_temp_start, mean_temp_end: c.mean_temp_end,
    }));

    // Acceleration data (pre/post 1980)
    const acceleration = (trends?.acceleration || []).map(c => ({
      city: c.city, pre_1980: c.pre_1980_rate, post_1980: c.post_1980_rate,
      post_2000: c.post_2000_rate, acceleration: c.acceleration,
    }));

    // Extreme heat rankings
    const heatRanking = (extremes?.rankings?.heat_p95 || []).map(c => ({
      city: c.city, climate: c.climate, trend: c.trend_per_decade,
      significant: c.trend_significant, avg_1940s: c.mean_early, avg_2020s: c.mean_late,
    }));

    // Frost day rankings
    const frostRanking = (extremes?.rankings?.cold_0 || []).map(c => ({
      city: c.city, climate: c.climate, trend: c.trend_per_decade,
      significant: c.trend_significant, avg_1940s: c.mean_early, avg_2020s: c.mean_late,
    }));

    // Volatility rankings
    const whiplashRanking = (volatility?.rankings?.whiplash_index || []).map(c => ({
      city: c.city, climate: c.climate, whiplash_index: c.whiplash_index,
      swing_trend: c.swing_trend, dtr_trend: c.dtr_trend,
    }));

    // Threshold summary
    const thresholdSummary = extremes?.sig_summary || {};

    // Projections data
    const projections = readJson(path.join(CLIMATE_DATA, 'projections.json'));
    const projData = {};
    if (projections && projections.cities_analyzed > 0) {
      projData.citiesAnalyzed = projections.cities_analyzed;
      projData.modelPerformance = projections.model_performance || {};
      projData.continentWarming = projections.continent_projected_warming || {};
      projData.zoneBestModel = projections.climate_zone_best_model || {};
      projData.aggregate = projections.aggregate || {};
      projData.rankings = (projections.rankings?.by_projected_warming || []).map(c => ({
        rank: c.rank, city: c.city, continent: c.continent, climate: c.climate,
        warming2050: c.ensemble_warming_2050, spread: c.spread, bestModel: c.best_model,
      }));
      projData.accuracyRanking = (projections.rankings?.by_model_accuracy || []).map(c => ({
        rank: c.rank, city: c.city, bestModel: c.best_model, rmse: c.rmse,
      }));
    }

    // Collection status
    const projCollState = readJson('/tools/climate-trends/data/projections/collection_state.json');
    const collection = {
      completed: collState ? Object.keys(collState.completed_cities || {}).length : 0,
      total: 52,
      daily_limit_hit: collState?.daily_limit_hit || false,
      last_request_date: collState?.last_request_date || null,
      calls_today: collState?.calls_today || 0,
      proj_completed: projCollState ? Object.keys(projCollState.completed_cities || {}).length : 0,
      proj_total: 15,
      proj_daily_limit_hit: projCollState?.daily_limit_hit || false,
    };

    res.json({
      generated: summary.generated_at,
      isPreliminary: summary.is_preliminary,
      citiesAnalyzed: summary.cities_analyzed,
      citiesTotal: summary.cities_total,
      dataStatus: summary.data_status,
      trends: summary.trends,
      extremes: summary.extremes,
      volatility: summary.volatility,
      projections: projData,
      cityRanking, acceleration, heatRanking, frostRanking,
      whiplashRanking, thresholdSummary, collection,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sea Level Rise API ──────────────────────────────────────────────
const SEA_LEVEL_SUMMARY = '/output/research/sea-level-rise/summary.json';
const SEA_LEVEL_TRENDS = '/tools/sea-level/data/analysis/trends.json';
const SEA_LEVEL_REGIONAL = '/tools/sea-level/data/analysis/regional.json';
const SEA_LEVEL_ACCEL = '/tools/sea-level/data/analysis/acceleration.json';

app.get('/api/sea-level/summary', (req, res) => {
  try {
    const summary = readJson(SEA_LEVEL_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No sea level data found. Run report generator first.' });

    const trends = readJson(SEA_LEVEL_TRENDS);
    const regional = readJson(SEA_LEVEL_REGIONAL);
    const accel = readJson(SEA_LEVEL_ACCEL);

    // Full-record station trends
    const fullTrends = (trends?.results || []).filter(r => r.period === 'full');

    // Station ranking by rate
    const stationRanking = fullTrends
      .sort((a, b) => b.ols_slope_mm_yr - a.ols_slope_mm_yr)
      .map((r, i) => ({
        rank: i + 1,
        station_id: r.station_id,
        name: r.station_name,
        region: r.region,
        rate_mm_yr: r.ols_slope_mm_yr,
        ci_lower: r.ols_ci_lower,
        ci_upper: r.ols_ci_upper,
        sen_slope: r.sen_slope_mm_yr,
        mk_significant: r.mk_significant,
        start_year: r.start_year,
        end_year: r.end_year,
        n_years: r.n_years,
        total_change_mm: r.total_change_mm,
      }));

    // Regional stats
    const regionalStats = regional?.regional_stats || {};

    // Period comparison
    const periodComparison = regional?.period_comparison || {};

    // Acceleration summary
    const accelSummary = accel?.summary || {};

    // Top accelerating stations
    const topAccel = (accel?.top_10_accelerating || []).map(r => ({
      name: r.name,
      region: r.region,
      accel: r.accel,
      p: r.p,
      span: r.span,
    }));

    // Regional acceleration
    const regionalAccel = accelSummary.regional_acceleration || {};

    res.json({
      ...summary,
      stationRanking,
      regionalStats,
      periodComparison,
      accelSummary: {
        total_stations: accelSummary.total_stations,
        quadratic_significant: accelSummary.quadratic_significant,
        accelerating_significant: accelSummary.accelerating_significant,
        decelerating_significant: accelSummary.decelerating_significant,
        pct_significant: accelSummary.pct_significant,
        mean_accel_all: accelSummary.mean_accel_all,
        quadratic_preferred_aic: accelSummary.quadratic_preferred_aic,
        significant_acceleration_1990: accelSummary.significant_acceleration_1990,
        rate_comparison_stations: accelSummary.rate_comparison_stations,
      },
      topAccelerating: topAccel,
      regionalAccel,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Solar Cycles API ──────────────────────────────────────────────────
const SOLAR_SUMMARY = '/output/research/solar-cycles/summary.json';

app.get('/api/solar-cycles/summary', (req, res) => {
  try {
    const summary = readJson(SOLAR_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No solar cycle data found. Run report generator first.' });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Solar cycles page route
app.get('/solar-cycles', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'solar-cycles.html');
  if (!fs.existsSync(p)) return res.status(404).send('Solar cycles page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// Sea level page route
app.get('/sea-level', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'sea-level.html');
  if (!fs.existsSync(p)) return res.status(404).send('Sea level page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// ── Exoplanet Census API ────────────────────────────────────────────
const EXOPLANET_SUMMARY = '/output/research/exoplanet-census/summary.json';

app.get('/api/exoplanet-census/summary', (req, res) => {
  try {
    const summary = readJson(EXOPLANET_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No exoplanet census data found. Run report generator first.' });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Exoplanet census page route
app.get('/exoplanet-census', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'exoplanet-census.html');
  if (!fs.existsSync(p)) return res.status(404).send('Exoplanet census page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// ── COVID Attention API ─────────────────────────────────────────────
const COVID_ANALYSIS = '/tools/covid-attention/data/covid_analysis.json';
const COVID_SUMMARY = '/output/research/covid-attention/summary.json';

app.get('/api/covid-attention/summary', (req, res) => {
  try {
    const summary = readJson(COVID_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No COVID attention data found.' });

    const analysis = readJson(COVID_ANALYSIS);
    if (!analysis) return res.status(404).json({ error: 'No COVID analysis data found.' });

    const s = analysis.summary || {};
    const topics = analysis.topics || [];

    // Top retained topics (sorted by dividend desc)
    const retained = topics
      .filter(t => t.covid_dividend_pct > 10)
      .sort((a, b) => b.covid_dividend_pct - a.covid_dividend_pct)
      .slice(0, 10)
      .map(t => ({
        name: t.topic_name, field: t.field_name,
        dividend: t.covid_dividend_pct, peakRatio: t.peak_ratio,
        alignment: t.alignment_classification, peakMonth: t.peak_month,
      }));

    // Top declined topics (sorted by dividend asc)
    const declined = topics
      .filter(t => t.covid_dividend_pct < -10)
      .sort((a, b) => a.covid_dividend_pct - b.covid_dividend_pct)
      .slice(0, 15)
      .map(t => ({
        name: t.topic_name, field: t.field_name,
        dividend: t.covid_dividend_pct, peakRatio: t.peak_ratio,
        alignment: t.alignment_classification, halfLife: t.decay_half_life_months,
      }));

    // Field-level stats
    const fieldStats = Object.entries(s.field_stats || {}).map(([name, d]) => ({
      name: name.length > 30 ? name.slice(0, 27) + '...' : name,
      fullName: name,
      count: d.count, avgDividend: d.avg_dividend,
    })).sort((a, b) => b.avgDividend - a.avgDividend);

    // Alignment distribution
    const alignment = s.alignment_distribution || {};
    const attention = s.attention_distribution || {};
    const overall = s.overall || {};

    res.json({
      generated: analysis.generated_at,
      timePeriods: analysis.time_periods,
      topicsAnalyzed: s.total_analyzed,
      uniqueArticles: summary.unique_articles,
      medianDividend: overall.median_dividend_pct,
      meanDividend: overall.mean_dividend_pct,
      meanPeakRatio: overall.mean_peak_ratio,
      medianHalfLife: overall.median_half_life_months,
      positiveCount: overall.topics_with_positive_dividend,
      negativeCount: overall.topics_with_negative_dividend,
      attention, alignment,
      retained, declined, fieldStats,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// COVID attention page route
app.get('/covid-attention', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'covid-attention.html');
  if (!fs.existsSync(p)) return res.status(404).send('COVID attention page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// Climate trends page route
app.get('/climate', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'climate.html');
  if (!fs.existsSync(p)) return res.status(404).send('Climate trends page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// ── Ocean Warming API ─────────────────────────────────────────────
const OCEAN_WARMING_SUMMARY = '/output/research/ocean-warming/summary.json';

app.get('/api/ocean-warming/summary', (req, res) => {
  try {
    const summary = readJson(OCEAN_WARMING_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No ocean warming data found. Run report generator first.' });

    // Transform summary.json into the shape the HTML page expects
    const accel = summary.acceleration || {};
    const enso = summary.enso_summary || {};
    const oa = summary.ocean_atmosphere || {};
    const br = summary.basin_ranking || [];

    // Southern Ocean post-1980 rate from trends
    let soPost1980 = -0.051;
    try {
      const trends = readJson('/tools/ocean-warming/data/analysis/trends.json');
      if (trends && trends.acceleration_by_basin && trends.acceleration_by_basin['Southern Ocean']) {
        soPost1980 = trends.acceleration_by_basin['Southern Ocean'].post_1980_rate;
      }
    } catch (_) {}

    // ENSO spectral method consensus
    let ensoMethods = {};
    try {
      const ensoData = readJson('/tools/ocean-warming/data/analysis/enso.json');
      if (ensoData && ensoData.enso_period_consensus) ensoMethods = ensoData.enso_period_consensus.methods || {};
    } catch (_) {}

    const fastest = br[0] || {};
    const global = br.find(b => b.basin === 'Global Ocean') || {};

    const result = {
      key_metrics: {
        global_total_change: global.total_change_degC || 0.801,
        global_warming_rate: global.rate_degC_per_decade || 0.0512,
        fastest_basin: fastest.basin || 'South Atlantic',
        fastest_basin_rate: fastest.rate_degC_per_decade || 0.0644,
        post_1980_rate: accel.post_1980_rate || 0.085,
        acceleration_factor: (accel.acceleration_factor || 3.2) + '\u00d7',
        enso_period: enso.consensus_period_yr || 4.38,
        enso_period_std: enso.consensus_std_yr || 0.89,
        el_nino_count: enso.el_nino_count || 35,
        la_nina_count: enso.la_nina_count || 35,
        strongest_el_nino_year: '2015-16',
        strongest_el_nino_anomaly: enso.strongest_el_nino_peak || 2.573,
        acceleration_coeff: accel.quadratic_coeff || 0.007375,
        southern_ocean_post1980: soPost1980,
      },
      findings: [
        'Global ocean has warmed +' + (global.total_change_degC || 0.80).toFixed(2) + '\u00b0C since 1870 at +' + (global.rate_degC_per_decade || 0.051).toFixed(3) + '\u00b0C/decade',
        'Fastest basin: ' + (fastest.basin || 'South Atlantic') + ' at +' + (fastest.rate_degC_per_decade || 0.064).toFixed(3) + '\u00b0C/decade',
        'Warming rate has tripled: ' + (accel.acceleration_factor || 3.2) + '\u00d7 faster post-1950 vs pre-1950',
        'ENSO period: ' + (enso.consensus_period_yr || 4.38).toFixed(2) + ' \u00b1 ' + (enso.consensus_std_yr || 0.89).toFixed(2) + ' years (4-method consensus)',
        ((enso.el_nino_count || 35) + (enso.la_nina_count || 35)) + ' ENSO events detected; ENSO is intensifying (p<0.0001)',
        'Southern Ocean cooling post-1980 (' + soPost1980.toFixed(3) + '\u00b0C/decade) \u2014 Antarctic paradox',
        'Atmosphere warms ~' + (oa.ratio_european || 3.9).toFixed(1) + '\u00d7 faster than ocean surface',
      ],
      basin_ranking: br.map(b => ({ rank: b.rank, basin: b.basin, rate: b.rate_degC_per_decade, total_change: b.total_change_degC })),
      acceleration_by_period: {
        pre_1950: accel.pre_1950_rate || 0.0266,
        post_1950: accel.post_1950_rate || 0.0861,
        post_1980: accel.post_1980_rate || 0.085,
        post_2000: accel.post_2000_rate || 0.0902,
      },
      enso_consensus: { methods: ensoMethods, consensus_period_yr: enso.consensus_period_yr || 4.38, consensus_std_yr: enso.consensus_std_yr || 0.89 },
      ocean_atmosphere: {
        ocean_rate: oa.ocean_rate || 0.0512,
        atmosphere_rate: oa.atmosphere_rate_european_mean || 0.1968,
        atmosphere_cities: oa.cities_analyzed || 10,
        ratio: (oa.ratio_european || 3.9).toFixed(1) + '\u00d7',
      },
    };
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ocean warming page route
app.get('/ocean-warming', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'ocean-warming.html');
  if (!fs.existsSync(p)) return res.status(404).send('Ocean warming page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// ── UK Grid Decarbonisation ─────────────────────────────────────────────

const UK_GRID_SUMMARY = '/output/research/uk-grid-decarb/summary.json';

app.get('/api/uk-grid-decarb/summary', (req, res) => {
  try {
    const summary = readJson(UK_GRID_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No UK grid decarb data found. Run report generator first.' });

    const hs = summary.headline_stats || {};
    const reg = summary.regional || {};

    // Build annual CI array for the bar chart
    const annualCI = [];
    const ciByYear = { 2018: hs.ci_2018, 2019: 214.0, 2020: 180.3, 2021: 187.8, 2022: 182.5, 2023: 152.1, 2024: 125.1, 2025: hs.ci_2025 };
    try {
      const trends = readJson('/tools/uk-grid-decarb/data/analysis/trends.json');
      if (trends && trends.annual) {
        for (const [yr, data] of Object.entries(trends.annual)) {
          if (parseInt(yr) >= 2018 && parseInt(yr) <= 2025 && data.mean_ci) {
            ciByYear[parseInt(yr)] = data.mean_ci;
          }
        }
      }
    } catch (_) {}
    for (let y = 2018; y <= 2025; y++) {
      annualCI.push({ year: y, ci: ciByYear[y] || 0 });
    }

    // Region snapshot for bar visualization
    const regionSnapshot = [];
    try {
      const regional = readJson('/tools/uk-grid-decarb/data/analysis/regional.json');
      if (regional && regional.cross_region_divergence && regional.cross_region_divergence['2025']) {
        const regions2025 = regional.cross_region_divergence['2025'].all_regions || {};
        const names = regional.metadata?.regions || {};
        const entries = Object.entries(regions2025).map(([id, ci]) => ({ id, name: names[id] || 'Region ' + id, ci }));
        entries.sort((a, b) => a.ci - b.ci);
        regionSnapshot.push(...entries);
      }
    } catch (_) {}

    res.json({
      ...summary,
      annual_ci: annualCI,
      region_snapshot: regionSnapshot,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// US Debt Dynamics API
const US_DEBT_SUMMARY = '/output/research/us-debt-dynamics/summary.json';

app.get('/api/us-debt-dynamics/summary', (req, res) => {
  try {
    const summary = readJson(US_DEBT_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No US debt dynamics data found. Run analysis first.' });

    // Enrich with full blended rate time series if available
    try {
      const blended = readJson('/tools/us-debt-dynamics/data/analysis/blended_rate.json');
      if (blended && blended.weighted_blended_rate) {
        // Sample at yearly intervals for chart
        const yearlyRates = {};
        for (const [month, rate] of Object.entries(blended.weighted_blended_rate)) {
          if (month.endsWith('-01') || month.endsWith('-07')) {
            yearlyRates[month.slice(0, 4)] = rate;
          }
        }
        summary.blended_rate_full = yearlyRates;
      }
    } catch (_) {}

    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/us-debt-dynamics', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'us-debt-dynamics.html');
  if (!fs.existsSync(p)) return res.status(404).send('US Debt Dynamics page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// Currency contagion API
const CURRENCY_CONTAGION_SUMMARY = '/output/research/currency-contagion/summary.json';
app.get('/api/currency-contagion/summary', (req, res) => {
  try {
    const summary = readJson(CURRENCY_CONTAGION_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No currency contagion data found.' });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Currency contagion page route
app.get('/currency-contagion', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'currency-contagion.html');
  if (!fs.existsSync(p)) return res.status(404).send('Currency contagion page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// GBIF Biodiversity API
const GBIF_BIODIVERSITY_SUMMARY = '/output/research/gbif-biodiversity/summary.json';
app.get('/api/gbif-biodiversity/summary', (req, res) => {
  try {
    const summary = readJson(GBIF_BIODIVERSITY_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No GBIF biodiversity data found.' });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GBIF Biodiversity page route
app.get('/gbif-biodiversity', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'gbif-biodiversity.html');
  if (!fs.existsSync(p)) return res.status(404).send('GBIF biodiversity page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// River flow API
const RIVER_FLOW_SUMMARY = '/output/research/river-flow/summary.json';
app.get('/api/river-flow/summary', (req, res) => {
  try {
    const summary = readJson(RIVER_FLOW_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No river flow data found.' });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// River flow page route
app.get('/river-flow', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'river-flow.html');
  if (!fs.existsSync(p)) return res.status(404).send('River flow page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// Solar-seismic API
const SOLAR_SEISMIC_SUMMARY = '/output/research/solar-seismic/summary.json';
app.get('/api/solar-seismic/summary', (req, res) => {
  try {
    const summary = readJson(SOLAR_SEISMIC_SUMMARY);
    if (!summary) return res.status(404).json({ error: 'No solar-seismic data found.' });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Solar-seismic page route
app.get('/solar-seismic', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'solar-seismic.html');
  if (!fs.existsSync(p)) return res.status(404).send('Solar-seismic page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

app.get('/uk-grid-decarb', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'uk-grid-decarb.html');
  if (!fs.existsSync(p)) return res.status(404).send('UK Grid Decarb page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// Trends page route
app.get('/trends', (req, res) => {
  if (TOKEN && !req.query.token) return res.redirect('/?token=');
  if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
  const p = path.join(__dirname, 'public', 'trends.html');
  if (!fs.existsSync(p)) return res.status(404).send('Trends page not built yet');
  let html = fs.readFileSync(p, 'utf-8');
  html = html.replace('__TOKEN__', TOKEN || '');
  res.send(html);
});

// ────────────────────────────────────────────────────────────────────────────
// CORE FRONTEND — The agent may add pages but must NEVER remove or break this.
// ────────────────────────────────────────────────────────────────────────────

// Serve frontend (auth checked via token in URL, stored in sessionStorage)
app.get('/', (req, res) => {
  // If token is required but not in query, show login form
  if (TOKEN && !req.query.token) {
    return res.send(LOGIN_HTML);
  }
  if (TOKEN && req.query.token !== TOKEN) {
    return res.status(401).send(LOGIN_HTML);
  }
  res.send(FRONTEND_HTML.replace('__TOKEN__', TOKEN || ''));
});

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Dashboard — Login</title>
<style>
  body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .login { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 32px; width: 340px; }
  h2 { font-size: 16px; margin-bottom: 16px; }
  input { width: 100%; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
          color: #e6edf3; font-size: 14px; margin-bottom: 12px; box-sizing: border-box; }
  button { width: 100%; padding: 8px; background: #238636; border: none; border-radius: 6px; color: white;
           font-size: 14px; cursor: pointer; } button:hover { background: #2ea043; }
  .err { color: #f85149; font-size: 12px; display: none; margin-bottom: 8px; }
  .live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
              background: var(--dim); margin-right: 4px; vertical-align: middle; }
  .live-dot.on { background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .live-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; vertical-align: middle; }
  .live-badge.on { background: rgba(63,185,80,0.15); color: var(--green); }
  .live-badge.off { background: rgba(139,148,158,0.15); color: var(--dim); }
  .live-output { max-height: calc(100vh - 140px); overflow-y: auto; }
</style>
</head>
<body>
<div class="login">
  <h2>Agent Dashboard</h2>
  <div class="err" id="err">Invalid token</div>
  <input type="password" id="tok" placeholder="Dashboard token" autofocus>
  <button onclick="go()">Authenticate</button>
</div>
<script>
function go(){
  const t=document.getElementById('tok').value.trim();
  if(!t) return;
  window.location.href='/?token='+encodeURIComponent(t);
}
document.getElementById('tok').addEventListener('keydown',e=>{if(e.key==='Enter')go()});
if(window.location.search.includes('token=')) document.getElementById('err').style.display='block';
</script>
</body>
</html>`;

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Dashboard</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --dim: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --red: #f85149; --yellow: #d29922;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; }
  .app { display: grid; grid-template-columns: 280px 1fr; grid-template-rows: auto 1fr; height: 100vh; }

  /* Header */
  header { grid-column: 1/-1; padding: 12px 20px; border-bottom: 1px solid var(--border);
           display: flex; align-items: center; justify-content: space-between; background: var(--surface); }
  .logo { font-size: 15px; font-weight: 600; }
  .logo span { color: var(--dim); font-weight: 400; }
  .header-right { display: flex; align-items: center; gap: 16px; }
  .stats { display: flex; gap: 14px; font-size: 12px; color: var(--dim); }
  .badge { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .badge.running { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge.sleeping { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .badge.idle { background: rgba(139,148,158,0.15); color: var(--dim); }
  .badge.disabled { background: rgba(248,81,73,0.15); color: var(--red); }
  .toggle { padding: 5px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface);
            color: var(--text); cursor: pointer; font-family: var(--font); font-size: 12px; transition: 0.15s; }
  .toggle:hover { border-color: var(--accent); }
  .toggle.on { border-color: var(--red); color: var(--red); }
  .toggle.off { border-color: var(--green); color: var(--green); }
  .disk { font-size: 11px; color: var(--dim); }
  .disk.warn { color: var(--yellow); }

  /* Sidebar */
  .sidebar { border-right: 1px solid var(--border); overflow-y: auto; background: var(--surface); display: flex; flex-direction: column; }
  .tabs { display: flex; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .tab { flex: 1; padding: 8px; font-size: 11px; text-align: center; color: var(--dim); cursor: pointer;
         background: none; border: none; border-bottom: 2px solid transparent; font-family: var(--font); min-width: 60px; }
  .tab:hover { color: var(--text); }
  .tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .panel { display: none; flex: 1; overflow-y: auto; padding: 4px 0; }
  .panel.on { display: block; }

  .item { padding: 5px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;
          font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
  .item:hover { background: rgba(88,166,255,0.08); }
  .item.active { background: rgba(88,166,255,0.12); color: var(--accent); }
  .item .ico { flex-shrink: 0; width: 16px; text-align: center; font-size: 11px; }
  .dir { color: var(--dim); }
  .children { padding-left: 16px; }

  /* Main */
  .main { overflow-y: auto; padding: 24px; }
  .viewer-hd { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .viewer-hd h2 { font-size: 18px; }
  .viewer-hd .meta { font-size: 12px; color: var(--dim); margin-top: 4px; }

  .md { line-height: 1.7; }
  .md h1,.md h2,.md h3 { margin: 1.2em 0 0.6em; }
  .md h1 { font-size: 1.4em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  .md h2 { font-size: 1.2em; }
  .md p { margin: 0.5em 0; }
  .md ul,.md ol { padding-left: 2em; margin: 0.5em 0; }
  .md code { background: var(--bg); padding: 2px 5px; border-radius: 3px; font-family: var(--mono); font-size: 0.9em; }
  .md pre { background: var(--bg); padding: 14px; border-radius: 6px; overflow-x: auto; margin: 0.8em 0; }
  .md pre code { background: none; padding: 0; }
  .md blockquote { border-left: 3px solid var(--accent); padding-left: 14px; color: var(--dim); margin: 0.8em 0; }
  .md a { color: var(--accent); }
  .md table { border-collapse: collapse; margin: 0.8em 0; }
  .md th,.md td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; }
  .md th { background: var(--surface); }

  .raw { background: var(--bg); padding: 14px; border-radius: 6px; white-space: pre-wrap;
         font-family: var(--mono); font-size: 13px; line-height: 1.5; border: 1px solid var(--border); overflow-x: auto; }

  .welcome { display: flex; align-items: center; justify-content: center; height: 100%;
             color: var(--dim); font-size: 14px; text-align: center; line-height: 2; }

  /* Stream-JSON event timeline */
  .ev-list { display: flex; flex-direction: column; gap: 6px; }
  .ev { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .ev-hd { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer;
           font-size: 13px; user-select: none; }
  .ev-hd:hover { filter: brightness(1.15); }
  .ev-tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;
            letter-spacing: 0.3px; flex-shrink: 0; }
  .ev-sum { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-family: var(--mono); font-size: 12px; }
  .ev-chev { color: var(--dim); font-size: 11px; flex-shrink: 0; transition: transform 0.15s; }
  .ev.open .ev-chev { transform: rotate(90deg); }
  .ev-body { display: none; padding: 10px 12px; border-top: 1px solid var(--border); background: var(--bg);
             font-family: var(--mono); font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto; }
  .ev.open .ev-body { display: block; }
  .ev-body .ev-kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
  .ev-body .ev-kv-key { color: var(--accent); font-weight: 600; white-space: nowrap; }
  .ev-body .ev-kv-val { color: var(--text); }
  .ev-body .ev-section { margin-bottom: 8px; }
  .ev-body .ev-section-label { color: var(--dim); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .ev-body .ev-text-content { color: var(--text); line-height: 1.6; }
  .ev-body .ev-code-block { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; margin: 4px 0; overflow-x: auto; }
  .ev-body .ev-stats { display: flex; gap: 16px; flex-wrap: wrap; }
  .ev-body .ev-stat { display: flex; flex-direction: column; align-items: center; }
  .ev-body .ev-stat-val { font-size: 16px; font-weight: 700; color: var(--text); }
  .ev-body .ev-stat-label { font-size: 10px; color: var(--dim); text-transform: uppercase; }
  .ev-hd.ev-system { background: rgba(88,166,255,0.08); }
  .ev-tag.ev-system { background: rgba(88,166,255,0.15); color: var(--accent); }
  .ev-hd.ev-text { background: rgba(63,185,80,0.06); }
  .ev-tag.ev-text { background: rgba(63,185,80,0.15); color: var(--green); }
  .ev-hd.ev-tool-use { background: rgba(210,153,34,0.06); }
  .ev-tag.ev-tool-use { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .ev-hd.ev-tool-result { background: rgba(210,153,34,0.04); }
  .ev-tag.ev-tool-result { background: rgba(210,153,34,0.10); color: var(--yellow); }
  .ev-hd.ev-result { background: rgba(139,148,158,0.06); }
  .ev-tag.ev-result { background: rgba(139,148,158,0.15); color: var(--dim); }
  .ev-hd.ev-error { background: rgba(248,81,73,0.06); }
  .ev-tag.ev-error { background: rgba(248,81,73,0.15); color: var(--red); }
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="logo">Agent <span>Dashboard</span></div>
    <div class="header-right">
      <a href="/solar-cycles" id="solar-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Solar Cycles</a>
      <a href="/sea-level" id="sea-level-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Sea Level</a>
      <a href="/covid-attention" id="covid-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">COVID Attention</a>
      <a href="/climate" id="climate-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Climate Trends</a>
      <a href="/attention-gap" id="gap-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Attention Gap</a>
      <a href="/trends" id="trends-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Science Trends</a>
      <a href="/exoplanet-census" id="exoplanet-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Exoplanet Census</a>
      <a href="/ocean-warming" id="ocean-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Ocean Warming</a>
      <a href="/uk-grid-decarb" id="grid-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">UK Grid</a>
      <a href="/us-debt-dynamics" id="debt-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">US Debt</a>
      <a href="/solar-seismic" id="seismic-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Solar-Seismic</a>
      <a href="/river-flow" id="river-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">River Flow</a>
      <a href="/currency-contagion" id="currency-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">FX Contagion</a>
      <a href="/gbif-biodiversity" id="biodiversity-link" style="font-size:12px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">Biodiversity</a>
      <div class="stats" id="stats"></div>
      <span class="disk" id="disk"></span>
      <span class="badge" id="badge">&mdash;</span>
      <button class="toggle" id="tog" onclick="tog()">&mdash;</button>
    </div>
  </header>
  <div class="sidebar">
    <div class="tabs">
      <button class="tab on" data-t="docs">Docs</button>
      <button class="tab" data-t="summary">Summary</button>
      <button class="tab" data-t="journal">Journal</button>
      <button class="tab" data-t="state">State</button>
      <button class="tab" data-t="logs">Logs</button>
      <button class="tab" data-t="live"><span class="live-dot" id="live-ind"></span>Live</button>
    </div>
    <div class="panel on" id="p-docs"></div>
    <div class="panel" id="p-summary">
      <div style="padding:12px;font-size:12px;color:var(--dim)">Plain-English digest of agent activity, updated after each invocation.</div>
      <div class="item" onclick="loadSummary()"><span class="ico">&#128221;</span>Latest Summary</div>
      <div style="padding:8px 12px 4px;font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:0.3px;">Archive</div>
      <div id="summary-archive"></div>
    </div>
    <div class="panel" id="p-journal"><div class="item" onclick="viewJournal()"><span class="ico">&#128214;</span>journal.md</div></div>
    <div class="panel" id="p-state"></div>
    <div class="panel" id="p-logs"></div>
    <div class="panel" id="p-live"><div style="padding:12px;font-size:12px;color:var(--dim)">Output refreshes every 2s while this tab is active.</div></div>
  </div>
  <div class="main" id="main"><div class="welcome">Select a file from the sidebar to view it.<br>Enable the agent with the button above to begin.</div></div>
</div>
<script>
const TK='__TOKEN__';
let S={};
function ap(url){const u=new URL(url,location.origin);if(TK)u.searchParams.set('token',TK);return u.toString();}
document.getElementById('solar-link').href=ap('/solar-cycles');
document.getElementById('sea-level-link').href=ap('/sea-level');
document.getElementById('trends-link').href=ap('/trends');
document.getElementById('gap-link').href=ap('/attention-gap');
document.getElementById('climate-link').href=ap('/climate');
document.getElementById('covid-link').href=ap('/covid-attention');
document.getElementById('exoplanet-link').href=ap('/exoplanet-census');
document.getElementById('ocean-link').href=ap('/ocean-warming');
document.getElementById('grid-link').href=ap('/uk-grid-decarb');
document.getElementById('debt-link').href=ap('/us-debt-dynamics');
document.getElementById('seismic-link').href=ap('/solar-seismic');
document.getElementById('river-link').href=ap('/river-flow');
document.getElementById('biodiversity-link').href=ap('/gbif-biodiversity');

// Tabs
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
  document.getElementById('p-'+t.dataset.t).classList.add('on');
});

// Status
async function poll(){
  try{ S=await(await fetch(ap('/api/status'))).json(); }catch(e){return}
  const b=document.getElementById('badge'), g=document.getElementById('tog'), s=document.getElementById('stats'), dk=document.getElementById('disk');
  if(!S.enabled){ b.textContent='disabled'; b.className='badge disabled'; g.textContent='Enable'; g.className='toggle off'; }
  else{ b.textContent=S.processStatus; b.className='badge '+S.processStatus; g.textContent='Disable'; g.className='toggle on'; }
  let h='';
  if(S.phase) h+='<span>'+esc(S.phase)+'</span>';
  h+='<span>'+S.totalInvocations+' runs</span>';
  if(S.activeObjectives) h+='<span>'+S.activeObjectives+' obj</span>';
  if(S.stallCount) h+='<span style="color:var(--yellow)">'+S.stallCount+' stalls</span>';
  s.innerHTML=h;
  if(S.diskUsage){
    const pct=parseInt(S.diskUsage.percent)||0;
    dk.textContent='Disk: '+S.diskUsage.percent+' ('+S.diskUsage.available+' free)';
    dk.className=pct>=85?'disk warn':'disk';
  }
}
async function tog(){ await fetch(ap('/api/toggle'),{method:'POST'}); poll(); }

// Trees
async function loadDocs(){ const r=await(await fetch(ap('/api/documents'))).json(); document.getElementById('p-docs').innerHTML=tree(r); }
async function loadState(){ const r=await(await fetch(ap('/api/state'))).json(); document.getElementById('p-state').innerHTML=tree(r); }
async function loadLogs(){
  const r=await(await fetch(ap('/api/logs'))).json();
  document.getElementById('p-logs').innerHTML=r.map(l=>{
    const ts=l.name.replace('invocation_','').replace('.log','');
    return '<div class="item" onclick="viewLog(\\''+esc(l.name)+'\\')">'+
      '<span class="ico">&#128203;</span>'+esc(ts)+'</div>';
  }).join('');
  document.getElementById('p-logs')._logs=r;
}
function tree(items,d=0){
  return items.map(i=>{
    if(i.type==='directory') return '<div class="item dir" style="padding-left:'+(12+d*14)+'px"><span class="ico">&#128193;</span>'+esc(i.name)+'</div><div class="children">'+tree(i.children||[],d+1)+'</div>';
    const ic={'.md':'&#128221;','.json':'&#128202;','.py':'&#128013;','.js':'&#128220;','.sh':'&#9881;','.txt':'&#128196;','.csv':'&#128200;','.html':'&#127760;','.log':'&#128203;'}[i.ext]||'&#128196;';
    return '<div class="item" data-p="'+esc(i.path)+'" onclick="view(\\''+esc(i.path)+'\\')" style="padding-left:'+(12+d*14)+'px"><span class="ico">'+ic+'</span>'+esc(i.name)+'</div>';
  }).join('');
}

// Viewer
async function view(p){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('[data-p="'+CSS.escape(p)+'"]').forEach(e=>e.classList.add('active'));
  const d=await(await fetch(ap('/api/file?path='+encodeURIComponent(p)))).json();
  if(d.type==='directory') return;
  const sz=d.size<1024?d.size+' B':(d.size/1024).toFixed(1)+' KB';
  const dt=new Date(d.modified).toLocaleString();
  const c=d.html?'<div class="md">'+d.html+'</div>':'<pre class="raw">'+esc(d.content)+'</pre>';
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>'+esc(d.name)+'</h2><div class="meta">'+esc(d.path)+' &middot; '+sz+' &middot; '+dt+'</div></div>'+c;
}
async function viewJournal(){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  const d=await(await fetch(ap('/api/journal'))).json();
  if(!d.content){document.getElementById('main').innerHTML='<div class="welcome">No journal entries yet.</div>';return;}
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>journal.md</h2><div class="meta">/state/journal.md</div></div><div class="md">'+d.html+'</div>';
}
function viewLog(name){
  const logs=document.getElementById('p-logs')._logs;
  const l=logs?.find(x=>x.name===name);
  if(!l) return;
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  let body;
  if(l.format==='stream-json'){
    const parsed=parseStreamJsonLogClient(l.content);
    body=parsed.events?renderStreamJsonEvents(parsed.events):'<pre class="raw">'+esc(l.content)+'</pre>';
  } else {
    body='<pre class="raw">'+esc(l.content)+'</pre>';
  }
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>'+esc(name)+'</h2></div>'+body;
}

function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

function truncStr(s,n){return s&&s.length>n?s.slice(0,n)+'...':s||'';}

// Helper: extract the content array from an event, handling both
// ev.content and ev.message.content wrapper structures
function evContent(ev){
  if(ev.message&&ev.message.content) return ev.message.content;
  if(ev.content) return ev.content;
  return null;
}

function renderKvInput(input){
  if(!input)return '';
  if(typeof input==='string')return '<div class="ev-code-block">'+esc(input)+'</div>';
  let h='<div class="ev-kv">';
  for(const[k,v] of Object.entries(input)){
    const valStr=typeof v==='string'?v:JSON.stringify(v,null,2);
    const isLong=valStr.length>120;
    h+='<span class="ev-kv-key">'+esc(k)+'</span><span class="ev-kv-val">'
      +(isLong?'<div class="ev-code-block">'+esc(valStr)+'</div>':esc(valStr))+'</span>';
  }
  h+='</div>';
  return h;
}

function renderEventBody(ev){
  // system init
  if(ev.type==='system'&&ev.subtype==='init'){
    let h='<div class="ev-kv">';
    const m=ev.message||ev;
    if(m.model||ev.model)h+='<span class="ev-kv-key">Model</span><span class="ev-kv-val">'+esc(m.model||ev.model)+'</span>';
    if(ev.session_id)h+='<span class="ev-kv-key">Session</span><span class="ev-kv-val">'+esc(ev.session_id)+'</span>';
    if(ev.tools)h+='<span class="ev-kv-key">Tools</span><span class="ev-kv-val">'+esc(ev.tools.length+' available: '+ev.tools.slice(0,8).join(', ')+(ev.tools.length>8?' ...':''))+'</span>';
    if(ev.cwd)h+='<span class="ev-kv-key">Working Dir</span><span class="ev-kv-val">'+esc(ev.cwd)+'</span>';
    h+='</div>';
    return h;
  }

  const content=evContent(ev);
  const contentArr=Array.isArray(content)?content:null;

  // assistant with tool_use
  if(ev.type==='assistant'&&contentArr){
    const toolBlock=contentArr.find(c=>c.type==='tool_use');
    if(toolBlock){
      let h='<div class="ev-section"><span class="ev-section-label">Tool</span><div>'+esc(toolBlock.name||'unknown')+'</div></div>';
      if(toolBlock.input)h+='<div class="ev-section"><span class="ev-section-label">Input</span>'+renderKvInput(toolBlock.input)+'</div>';
      const texts=contentArr.filter(c=>c.type==='text').map(c=>c.text).join('');
      if(texts)h+='<div class="ev-section"><span class="ev-section-label">Message</span><div class="ev-text-content">'+esc(texts)+'</div></div>';
      return h;
    }
    // assistant with text only
    const texts=contentArr.filter(c=>c.type==='text').map(c=>c.text).join('');
    if(texts)return '<div class="ev-text-content">'+esc(texts)+'</div>';
  }
  if(ev.type==='assistant'&&typeof content==='string'&&content){
    return '<div class="ev-text-content">'+esc(content)+'</div>';
  }

  // user / tool_result
  if(ev.type==='user'&&contentArr){
    const resultBlock=contentArr.find(c=>c.type==='tool_result');
    if(resultBlock){
      const txt=typeof resultBlock.content==='string'?resultBlock.content:
        (Array.isArray(resultBlock.content)?resultBlock.content.map(c=>c.text||'').join(''):'');
      if(txt)return '<div class="ev-text-content">'+esc(txt)+'</div>';
    }
    const texts=contentArr.map(c=>c.text||'').join('');
    if(texts)return '<div class="ev-text-content">'+esc(texts)+'</div>';
  }

  // result / done
  if(ev.type==='result'){
    let h='<div class="ev-stats">';
    if(ev.num_turns)h+='<div class="ev-stat"><span class="ev-stat-val">'+esc(String(ev.num_turns))+'</span><span class="ev-stat-label">turns</span></div>';
    if(ev.cost_usd)h+='<div class="ev-stat"><span class="ev-stat-val">$'+ev.cost_usd.toFixed(4)+'</span><span class="ev-stat-label">cost</span></div>';
    if(ev.duration_ms)h+='<div class="ev-stat"><span class="ev-stat-val">'+(ev.duration_ms/1000).toFixed(1)+'s</span><span class="ev-stat-label">duration</span></div>';
    if(ev.duration_api_ms)h+='<div class="ev-stat"><span class="ev-stat-val">'+(ev.duration_api_ms/1000).toFixed(1)+'s</span><span class="ev-stat-label">api time</span></div>';
    h+='</div>';
    if(ev.result)h+='<div class="ev-section" style="margin-top:8px"><span class="ev-section-label">Result</span><div class="ev-text-content">'+esc(ev.result)+'</div></div>';
    return h;
  }

  // Fallback: nicely formatted JSON in a code block
  return '<div class="ev-code-block">'+esc(JSON.stringify(ev,null,2))+'</div>';
}

function renderEvent(ev,idx){
  let cls='',tag='',sum='';
  const content=evContent(ev);
  const contentArr=Array.isArray(content)?content:null;

  if(ev.type==='system'){
    cls='ev-system'; tag='system';
    const parts=[];
    if(ev.subtype==='init'){
      const model=(ev.message&&ev.message.model)||ev.model;
      if(model)parts.push('model: '+model);
      if(ev.session_id)parts.push('session: '+ev.session_id.slice(0,12));
      if(ev.tools)parts.push(ev.tools.length+' tools');
    }
    sum=parts.length?parts.join(' | '):(ev.subtype||'system');
  } else if(ev.type==='assistant'){
    const toolBlock=contentArr?contentArr.find(c=>c.type==='tool_use'):null;
    if(toolBlock){
      cls='ev-tool-use'; tag='tool call';
      const inputStr=toolBlock.input?(typeof toolBlock.input==='string'?toolBlock.input:JSON.stringify(toolBlock.input)):'';
      sum=(toolBlock.name||'tool')+' '+truncStr(inputStr,100);
    } else {
      cls='ev-text'; tag='text';
      const txt=contentArr?contentArr.filter(c=>c.type==='text').map(c=>c.text).join(''):(typeof content==='string'?content:'');
      sum=truncStr(txt,120);
    }
  } else if(ev.type==='user'){
    cls='ev-tool-result'; tag='tool result';
    const resultBlock=contentArr?contentArr.find(c=>c.type==='tool_result'):null;
    if(resultBlock){
      const rContent=resultBlock.content;
      const txt=typeof rContent==='string'?rContent:(Array.isArray(rContent)?rContent.map(c=>c.text||'').join(''):'');
      sum=truncStr(txt,120);
    } else {
      sum=truncStr(JSON.stringify(content),120);
    }
  } else if(ev.type==='result'){
    cls='ev-result'; tag=ev.subtype==='error'?'error':'done';
    if(ev.subtype==='error')cls='ev-error';
    const parts=[];
    if(ev.num_turns)parts.push(ev.num_turns+' turns');
    if(ev.cost_usd)parts.push('$'+ev.cost_usd.toFixed(4));
    if(ev.duration_ms)parts.push((ev.duration_ms/1000).toFixed(1)+'s');
    if(ev.duration_api_ms)parts.push('api '+(ev.duration_api_ms/1000).toFixed(1)+'s');
    sum=parts.length?parts.join(' | '):(ev.result||'done');
  } else {
    cls='ev-system'; tag=ev.type||'event';
    sum=ev.subtype||truncStr(JSON.stringify(ev),80);
  }
  const body=renderEventBody(ev);
  return '<div class="ev" data-ev-idx="'+idx+'"><div class="ev-hd '+esc(cls)+'" onclick="toggleEv(this)">'
    +'<span class="ev-tag '+esc(cls)+'">'+esc(tag)+'</span>'
    +'<span class="ev-sum">'+esc(sum)+'</span>'
    +'<span class="ev-chev">&#9654;</span>'
    +'</div><div class="ev-body">'+body+'</div></div>';
}

function renderStreamJsonEvents(events){
  if(!events||!events.length)return '<div class="welcome">No events yet.</div>';
  return '<div class="ev-list">'+events.map((ev,i)=>renderEvent(ev,i)).join('')+'</div>';
}

const openEvIndices=new Set();
function toggleEv(hd){
  const el=hd.parentElement;
  el.classList.toggle('open');
  const idx=el.getAttribute('data-ev-idx');
  if(idx!==null){
    if(el.classList.contains('open'))openEvIndices.add(idx);
    else openEvIndices.delete(idx);
  }
}

function parseStreamJsonLogClient(raw){
  const lines=raw.split('\\n');
  const events=[];
  let hasJson=false;
  for(const line of lines){
    const t=line.trim();
    if(!t||!t.startsWith('{'))continue;
    try{const o=JSON.parse(t);if(o.type){events.push(o);hasJson=true;}}catch{}
  }
  return {format:hasJson?'stream-json':'text',events:hasJson?events:null};
}

// Live output
let liveTimer=null;
async function loadLiveView(){
  try{
    const r=await(await fetch(ap('/api/live'))).json();
    const ind=document.getElementById('live-ind');
    if(ind)ind.className=r.running?'live-dot on':'live-dot';
    if(!document.querySelector('.tab[data-t="live"]').classList.contains('on'))return;
    const st=r.running?'<span class="live-badge on">&#9679; LIVE</span>':'<span class="live-badge off">&#9675; IDLE</span>';
    const nm=r.log?r.log.replace('invocation_','').replace('.log',''):'&mdash;';
    const sz=(r.size/1024).toFixed(1);
    const m=document.getElementById('main');
    const prevScroll=document.getElementById('live-pre')||document.querySelector('.ev-list');
    const wasAtBottom=prevScroll?(m.scrollHeight-m.scrollTop-m.clientHeight<50):true;
    let body;
    if(r.format==='stream-json'&&r.events&&r.events.length){
      body=renderStreamJsonEvents(r.events);
    } else {
      body='<pre class="raw live-output" id="live-pre">'+esc(r.content)+'</pre>';
    }
    // Save scroll positions of open event bodies before replacing DOM
    const evBodyScrolls={};
    openEvIndices.forEach(idx=>{
      const el=m.querySelector('[data-ev-idx="'+idx+'"] .ev-body');
      if(el)evBodyScrolls[idx]=el.scrollTop;
    });
    m.innerHTML='<div class="viewer-hd"><h2>'+st+' &nbsp;'+esc(nm)+'</h2><div class="meta">'
      +(r.running?'Auto-refreshing every 2s':'Most recent invocation (completed)')
      +' &middot; '+sz+' KB'
      +(r.format==='stream-json'&&r.events?' &middot; '+r.events.length+' events':'')
      +'</div></div>'+body;
    // Restore open/collapsed state and scroll positions for events
    openEvIndices.forEach(idx=>{
      const el=m.querySelector('[data-ev-idx="'+idx+'"]');
      if(el){
        el.classList.add('open');
        if(evBodyScrolls[idx]!==undefined){
          const bd=el.querySelector('.ev-body');
          if(bd)bd.scrollTop=evBodyScrolls[idx];
        }
      }
    });
    if(wasAtBottom)m.scrollTop=m.scrollHeight;
  }catch(e){console.error('live:',e);}
}
function startLive(){loadLiveView();if(liveTimer)clearInterval(liveTimer);liveTimer=setInterval(loadLiveView,2000);}
function stopLive(){if(liveTimer){clearInterval(liveTimer);liveTimer=null;}}
document.querySelector('.tab[data-t="live"]').addEventListener('click',startLive);
document.querySelectorAll('.tab:not([data-t="live"])').forEach(t=>t.addEventListener('click',stopLive));
// Poll live indicator even when not on live tab
setInterval(async()=>{try{const r=await(await fetch(ap('/api/live'))).json();const ind=document.getElementById('live-ind');if(ind)ind.className=r.running?'live-dot on':'live-dot';}catch{}},5000);

// Summary
async function loadSummary(){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  const d=await(await fetch(ap('/api/summary'))).json();
  if(!d.exists){document.getElementById('main').innerHTML='<div class="welcome">No summary yet. One will appear after the first research invocation completes.</div>';return;}
  const dt=new Date(d.modified).toLocaleString();
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>Agent Summary</h2><div class="meta">Updated: '+dt+'</div></div><div class="md">'+d.html+'</div>';
}
async function loadSummaryArchive(){
  try{
    const r=await(await fetch(ap('/api/summary/archive'))).json();
    const el=document.getElementById('summary-archive');
    if(!el)return;
    el.innerHTML=r.map(a=>{
      const ts=a.timestamp;
      return '<div class="item" onclick="viewSummaryArchive(\\''+esc(a.path)+'\\',\\''+esc(ts)+'\\')"><span class="ico">&#128196;</span>'+esc(ts)+'</div>';
    }).join('')||'<div style="padding:4px 12px;font-size:12px;color:var(--dim)">No archive entries yet.</div>';
  }catch{}
}
async function viewSummaryArchive(p,ts){
  document.querySelectorAll('.item').forEach(e=>e.classList.remove('active'));
  const d=await(await fetch(ap('/api/file?path='+encodeURIComponent(p)))).json();
  if(d.type==='directory')return;
  const dt=new Date(d.modified).toLocaleString();
  const c=d.html?'<div class="md">'+d.html+'</div>':'<pre class="raw">'+esc(d.content)+'</pre>';
  document.getElementById('main').innerHTML='<div class="viewer-hd"><h2>Summary: '+esc(ts)+'</h2><div class="meta">'+esc(d.path)+' &middot; '+dt+'</div></div>'+c;
}
// Auto-load summary when clicking summary tab
document.querySelector('.tab[data-t="summary"]').addEventListener('click',()=>{loadSummary();loadSummaryArchive();});

poll(); loadDocs(); loadState(); loadLogs(); loadSummaryArchive();
setInterval(poll,5000);
setInterval(()=>{loadDocs();loadState();loadLogs();loadSummaryArchive();},15000);
</script>
</body>
</html>`;

app.listen(PORT, '0.0.0.0', () => {
  console.log('Agent dashboard: http://0.0.0.0:' + PORT);
});
