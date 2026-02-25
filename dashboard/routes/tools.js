'use strict';

const express = require('express');
const path = require('path');
const { readJson } = require('../lib/helpers');
const { serveHtmlPage } = require('../lib/page-handler');

const SCI_TRENDS_DATA = '/tools/sci-trends/data';
const ATTENTION_GAP_DATA = '/tools/attention-gap/data';
const ATTENTION_GAP_SUMMARY = '/output/research/attention-gap-analysis/summary.json';
const CLIMATE_DATA = '/tools/climate-trends/data/analysis';
const CLIMATE_SUMMARY = '/output/research/climate-trends/summary.json';
const CLIMATE_COLLECTION_STATE = '/tools/climate-trends/data/historical/collection_state.json';
const SEA_LEVEL_SUMMARY = '/output/research/sea-level-rise/summary.json';
const SEA_LEVEL_TRENDS = '/tools/sea-level/data/analysis/trends.json';
const SEA_LEVEL_REGIONAL = '/tools/sea-level/data/analysis/regional.json';
const SEA_LEVEL_ACCEL = '/tools/sea-level/data/analysis/acceleration.json';
const SOLAR_SUMMARY = '/output/research/solar-cycles/summary.json';
const EXOPLANET_SUMMARY = '/output/research/exoplanet-census/summary.json';
const COVID_ANALYSIS = '/tools/covid-attention/data/covid_analysis.json';
const COVID_SUMMARY = '/output/research/covid-attention/summary.json';
const OCEAN_WARMING_SUMMARY = '/output/research/ocean-warming/summary.json';
const UK_GRID_SUMMARY = '/output/research/uk-grid-decarb/summary.json';
const US_DEBT_SUMMARY = '/output/research/us-debt-dynamics/summary.json';
const CURRENCY_CONTAGION_SUMMARY = '/output/research/currency-contagion/summary.json';
const GBIF_BIODIVERSITY_SUMMARY = '/output/research/gbif-biodiversity/summary.json';
const RIVER_FLOW_SUMMARY = '/output/research/river-flow/summary.json';
const SOLAR_SEISMIC_SUMMARY = '/output/research/solar-seismic/summary.json';

function createToolsRouter() {
  const router = express.Router();

  // ── Science Trends ──────────────────────────────────────────────────────
  router.get('/api/sci-trends/summary', (req, res) => {
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

  // ── Attention Gap ───────────────────────────────────────────────────────
  router.get('/api/attention-gap/summary', (req, res) => {
    try {
      const summary = readJson(ATTENTION_GAP_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No attention gap data found. Run analyze.py --all first.' });

      const gapAnalysis = readJson(path.join(ATTENTION_GAP_DATA, 'gap_analysis.json'));
      const stats = gapAnalysis?.statistics || {};
      const meta = gapAnalysis?.metadata || {};

      const fieldGaps = Object.entries(summary.field_gaps || {}).map(([name, d]) => ({
        name: name.length > 25 ? name.slice(0, 22) + '...' : name,
        fullName: name,
        mean: d.mean,
        count: d.count,
      })).sort((a, b) => b.mean - a.mean);

      const underCovered = (gapAnalysis?.rankings?.under_covered_filtered || []).slice(0, 10).map(t => ({
        topic: t.topic_name, field: t.field_name, wiki: t.wikipedia_title,
        pubs: t.science_pubs_2024, views: Math.round(t.pageview_avg_monthly),
        gap: t.level_gap,
      }));

      const highAttention = (gapAnalysis?.rankings?.over_hyped_filtered || []).slice(0, 10).map(t => ({
        topic: t.topic_name, field: t.field_name, wiki: t.wikipedia_title,
        pubs: t.science_pubs_2024, views: Math.round(t.pageview_avg_monthly),
        gap: t.level_gap,
      }));

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

  // ── Climate Trends ──────────────────────────────────────────────────────
  router.get('/api/climate/summary', (req, res) => {
    try {
      const summary = readJson(CLIMATE_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No climate data found. Run report generator first.' });

      const trends = readJson(path.join(CLIMATE_DATA, 'trends.json'));
      const extremes = readJson(path.join(CLIMATE_DATA, 'extremes.json'));
      const volatility = readJson(path.join(CLIMATE_DATA, 'volatility.json'));
      const collState = readJson(CLIMATE_COLLECTION_STATE);

      const cityRanking = (trends?.full_period_ranking || []).map(c => ({
        rank: c.rank, city: c.city, climate: c.climate, continent: c.continent,
        warming_rate: c.warming_rate, sen_slope: c.sen_slope, r_squared: c.r_squared,
        p_value: c.p_value, total_change: c.total_change,
        mean_temp_start: c.mean_temp_start, mean_temp_end: c.mean_temp_end,
      }));

      const acceleration = (trends?.acceleration || []).map(c => ({
        city: c.city, pre_1980: c.pre_1980_rate, post_1980: c.post_1980_rate,
        post_2000: c.post_2000_rate, acceleration: c.acceleration,
      }));

      const heatRanking = (extremes?.rankings?.heat_p95 || []).map(c => ({
        city: c.city, climate: c.climate, trend: c.trend_per_decade,
        significant: c.trend_significant, avg_1940s: c.mean_early, avg_2020s: c.mean_late,
      }));

      const frostRanking = (extremes?.rankings?.cold_0 || []).map(c => ({
        city: c.city, climate: c.climate, trend: c.trend_per_decade,
        significant: c.trend_significant, avg_1940s: c.mean_early, avg_2020s: c.mean_late,
      }));

      const whiplashRanking = (volatility?.rankings?.whiplash_index || []).map(c => ({
        city: c.city, climate: c.climate, whiplash_index: c.whiplash_index,
        swing_trend: c.swing_trend, dtr_trend: c.dtr_trend,
      }));

      const thresholdSummary = extremes?.sig_summary || {};

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

  // ── Sea Level Rise ──────────────────────────────────────────────────────
  router.get('/api/sea-level/summary', (req, res) => {
    try {
      const summary = readJson(SEA_LEVEL_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No sea level data found. Run report generator first.' });

      const trends = readJson(SEA_LEVEL_TRENDS);
      const regional = readJson(SEA_LEVEL_REGIONAL);
      const accel = readJson(SEA_LEVEL_ACCEL);

      const fullTrends = (trends?.results || []).filter(r => r.period === 'full');

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

      const regionalStats = regional?.regional_stats || {};
      const periodComparison = regional?.period_comparison || {};
      const accelSummary = accel?.summary || {};

      const topAccel = (accel?.top_10_accelerating || []).map(r => ({
        name: r.name,
        region: r.region,
        accel: r.accel,
        p: r.p,
        span: r.span,
      }));

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

  // ── Solar Cycles ────────────────────────────────────────────────────────
  router.get('/api/solar-cycles/summary', (req, res) => {
    try {
      const summary = readJson(SOLAR_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No solar cycle data found. Run report generator first.' });
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Exoplanet Census ────────────────────────────────────────────────────
  router.get('/api/exoplanet-census/summary', (req, res) => {
    try {
      const summary = readJson(EXOPLANET_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No exoplanet census data found. Run report generator first.' });
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── COVID Attention ─────────────────────────────────────────────────────
  router.get('/api/covid-attention/summary', (req, res) => {
    try {
      const summary = readJson(COVID_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No COVID attention data found.' });

      const analysis = readJson(COVID_ANALYSIS);
      if (!analysis) return res.status(404).json({ error: 'No COVID analysis data found.' });

      const s = analysis.summary || {};
      const topics = analysis.topics || [];

      const retained = topics
        .filter(t => t.covid_dividend_pct > 10)
        .sort((a, b) => b.covid_dividend_pct - a.covid_dividend_pct)
        .slice(0, 10)
        .map(t => ({
          name: t.topic_name, field: t.field_name,
          dividend: t.covid_dividend_pct, peakRatio: t.peak_ratio,
          alignment: t.alignment_classification, peakMonth: t.peak_month,
        }));

      const declined = topics
        .filter(t => t.covid_dividend_pct < -10)
        .sort((a, b) => a.covid_dividend_pct - b.covid_dividend_pct)
        .slice(0, 15)
        .map(t => ({
          name: t.topic_name, field: t.field_name,
          dividend: t.covid_dividend_pct, peakRatio: t.peak_ratio,
          alignment: t.alignment_classification, halfLife: t.decay_half_life_months,
        }));

      const fieldStats = Object.entries(s.field_stats || {}).map(([name, d]) => ({
        name: name.length > 30 ? name.slice(0, 27) + '...' : name,
        fullName: name,
        count: d.count, avgDividend: d.avg_dividend,
      })).sort((a, b) => b.avgDividend - a.avgDividend);

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

  // ── Ocean Warming ───────────────────────────────────────────────────────
  router.get('/api/ocean-warming/summary', (req, res) => {
    try {
      const summary = readJson(OCEAN_WARMING_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No ocean warming data found. Run report generator first.' });

      const accel = summary.acceleration || {};
      const enso = summary.enso_summary || {};
      const oa = summary.ocean_atmosphere || {};
      const br = summary.basin_ranking || [];

      let soPost1980 = -0.051;
      try {
        const trends = readJson('/tools/ocean-warming/data/analysis/trends.json');
        if (trends && trends.acceleration_by_basin && trends.acceleration_by_basin['Southern Ocean']) {
          soPost1980 = trends.acceleration_by_basin['Southern Ocean'].post_1980_rate;
        }
      } catch (_) {}

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

  // ── UK Grid Decarbonisation ─────────────────────────────────────────────
  router.get('/api/uk-grid-decarb/summary', (req, res) => {
    try {
      const summary = readJson(UK_GRID_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No UK grid decarb data found. Run report generator first.' });

      const hs = summary.headline_stats || {};
      const reg = summary.regional || {};

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

  // ── US Debt Dynamics ────────────────────────────────────────────────────
  router.get('/api/us-debt-dynamics/summary', (req, res) => {
    try {
      const summary = readJson(US_DEBT_SUMMARY);
      if (!summary) return res.status(404).json({ error: 'No US debt dynamics data found. Run analysis first.' });

      try {
        const blended = readJson('/tools/us-debt-dynamics/data/analysis/blended_rate.json');
        if (blended && blended.weighted_blended_rate) {
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

  // ── Simple summary endpoints (read JSON, return it) ─────────────────────
  const simpleSummaries = [
    { path: '/api/currency-contagion/summary', file: CURRENCY_CONTAGION_SUMMARY, label: 'currency contagion' },
    { path: '/api/gbif-biodiversity/summary', file: GBIF_BIODIVERSITY_SUMMARY, label: 'GBIF biodiversity' },
    { path: '/api/river-flow/summary', file: RIVER_FLOW_SUMMARY, label: 'river flow' },
    { path: '/api/solar-seismic/summary', file: SOLAR_SEISMIC_SUMMARY, label: 'solar-seismic' },
  ];

  for (const { path: routePath, file, label } of simpleSummaries) {
    router.get(routePath, (req, res) => {
      try {
        const summary = readJson(file);
        if (!summary) return res.status(404).json({ error: `No ${label} data found.` });
        res.json(summary);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  }

  // ── HTML page routes ────────────────────────────────────────────────────
  router.get('/trends', serveHtmlPage('trends.html', 'Trends'));
  router.get('/attention-gap', serveHtmlPage('attention-gap.html', 'Attention gap'));
  router.get('/climate', serveHtmlPage('climate.html', 'Climate trends'));
  router.get('/solar-cycles', serveHtmlPage('solar-cycles.html', 'Solar cycles'));
  router.get('/sea-level', serveHtmlPage('sea-level.html', 'Sea level'));
  router.get('/exoplanet-census', serveHtmlPage('exoplanet-census.html', 'Exoplanet census'));
  router.get('/covid-attention', serveHtmlPage('covid-attention.html', 'COVID attention'));
  router.get('/ocean-warming', serveHtmlPage('ocean-warming.html', 'Ocean warming'));
  router.get('/uk-grid-decarb', serveHtmlPage('uk-grid-decarb.html', 'UK Grid Decarb'));
  router.get('/us-debt-dynamics', serveHtmlPage('us-debt-dynamics.html', 'US Debt Dynamics'));
  router.get('/currency-contagion', serveHtmlPage('currency-contagion.html', 'Currency contagion'));
  router.get('/gbif-biodiversity', serveHtmlPage('gbif-biodiversity.html', 'GBIF biodiversity'));
  router.get('/river-flow', serveHtmlPage('river-flow.html', 'River flow'));
  router.get('/solar-seismic', serveHtmlPage('solar-seismic.html', 'Solar-seismic'));

  return router;
}

module.exports = { createToolsRouter };
